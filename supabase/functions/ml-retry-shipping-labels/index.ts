/**
 * ml-retry-shipping-labels
 * ------------------------
 * Rotina horaria: tenta novamente baixar a etiqueta do Mercado Livre dos
 * pedidos que ainda estao sem `etiqueta_ml_url` e que ja estao prontos para
 * envio. Quando o ML responde `invoice_pending` (nota fiscal ainda nao
 * emitida) isso e apenas registrado como aviso, nunca como erro critico.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveShippingLabel } from "../_shared/mlShippingLabel.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-worker-token, x-cron-token",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const BATCH_LIMIT = 40;
const READY_STATUSES = new Set(["ready_to_ship", "handling", "shipped"]);
// Janela: pedidos criados no ML nos ultimos 3 dias (ontem/hoje + folga)
const LOOKBACK_DAYS = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: "Configuracao do servidor incompleta" }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Autorizacao: token interno / admin liberam execucao imediata (forcada).
  const expectedToken = Deno.env.get("DROPSHIP_WORKER_TOKEN") ?? Deno.env.get("CRON_SECRET");
  const internalToken = req.headers.get("x-worker-token") ?? req.headers.get("x-cron-token");
  let privileged = !!(expectedToken && internalToken && internalToken === expectedToken);

  if (!privileged) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) {
        const { data: role } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", userData.user.id)
          .eq("role", "admin")
          .maybeSingle();
        privileged = !!role;
      }
    }
  }

  // Single-flight: mesmo sem credencial privilegiada (chamada do cron), a rotina
  // so roda uma vez a cada 10 minutos.
  const JOB = "ml-retry-shipping-labels";
  const LEASE_MINUTES = 10;
  if (!privileged) {
    const nowIso = new Date().toISOString();
    const { data: lock } = await admin
      .from("job_locks")
      .select("locked_until")
      .eq("job", JOB)
      .maybeSingle();

    if (lock?.locked_until && new Date(lock.locked_until as string) > new Date()) {
      return json({ success: true, skipped: "execucao_recente" });
    }

    await admin.from("job_locks").upsert(
      {
        job: JOB,
        locked_until: new Date(Date.now() + LEASE_MINUTES * 60 * 1000).toISOString(),
        last_run_at: nowIso,
      },
      { onConflict: "job" },
    );
  }

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: pending, error: pendingError } = await admin
    .from("dropship_orders")
    .select("id, ml_order_id, user_id, order_number")
    .eq("needs_shipping_label", true)
    .is("etiqueta_ml_url", null)
    .not("ml_order_id", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(BATCH_LIMIT * 3);

  if (pendingError) return json({ error: pendingError.message }, 500);

  let resolvidas = 0;
  let invoicePending = 0;
  let naoProntos = 0;
  let semPedido = 0;
  const erros: Array<{ ml_order_id: string; motivo: string }> = [];
  let processados = 0;

  for (const row of pending ?? []) {
    if (processados >= BATCH_LIMIT) break;
    const mlOrderId = String(row.ml_order_id);

    const { data: orderRow } = await admin
      .from("orders")
      .select("raw, user_id")
      .eq("ml_order_id", mlOrderId)
      .maybeSingle();

    // deno-lint-ignore no-explicit-any -- payload cru do Mercado Livre
    const raw = (orderRow?.raw ?? null) as any;
    if (!raw) {
      semPedido++;
      continue;
    }

    const shippingStatus = String(raw?.shipping?.status ?? "");
    const shipmentId = raw?.shipping?.id ?? null;
    if (!shipmentId || !READY_STATUSES.has(shippingStatus)) {
      naoProntos++;
      continue;
    }

    processados++;
    const userId = String(row.user_id ?? orderRow?.user_id ?? "");
    if (!userId) {
      erros.push({ ml_order_id: mlOrderId, motivo: "pedido sem usuario vinculado" });
      continue;
    }

    try {
      const { url, path } = await resolveShippingLabel(admin, {
        mlOrderId,
        userId,
        mlOrder: raw,
      });

      if (url && path) {
        const { error: updErr } = await admin
          .from("dropship_orders")
          .update({
            etiqueta_ml_url: url,
            etiqueta_ml_path: path,
            needs_shipping_label: false,
            shipping_label_wait_alerted_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updErr) {
          erros.push({ ml_order_id: mlOrderId, motivo: updErr.message });
        } else {
          resolvidas++;
          console.log(`[etiqueta-retry] pedido ${mlOrderId} pronto para o bot`);
        }
      } else {
        // Sem etiqueta ainda: quase sempre nota fiscal pendente no ML.
        invoicePending++;
        console.log(
          `[etiqueta-retry] pedido ${mlOrderId} ainda sem etiqueta (provavel invoice_pending) — nova tentativa na proxima hora`,
        );
      }
    } catch (e) {
      erros.push({ ml_order_id: mlOrderId, motivo: (e as Error).message });
    }
  }

  const resumo = {
    success: true,
    candidatos: pending?.length ?? 0,
    processados,
    resolvidas,
    aguardando_nota_fiscal: invoicePending,
    nao_prontos_para_envio: naoProntos,
    sem_pedido_ml: semPedido,
    erros,
  };
  console.log("[etiqueta-retry] resumo:", JSON.stringify(resumo));
  return json(resumo);
});
