// Reconcilia estornos que ficaram travados em PROCESSING na ValidaPay.
// Consulta o status real de cada estorno e atualiza o registro na Velo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getRefundStatus, ValidaPayError } from "../_shared/validapay.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-repair-token, x-cron-token",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const DONE = ["CONFIRMED", "COMPLETED", "SUCCESS", "SUCCEEDED", "REFUNDED", "APPROVED"];
const FAILED = ["FAILED", "ERROR", "CANCELLED", "CANCELED", "REJECTED"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    const expected = Deno.env.get("ML_REPAIR_TOKEN") ?? Deno.env.get("CRON_SECRET");
    if (!supabaseUrl || !anonKey || !serviceKey || !dbUrl) {
      return json({ error: "Configuracao do servidor incompleta" }, 500);
    }

    const admin = createClient(dbUrl, serviceKey, { auth: { persistSession: false } });
    const token = req.headers.get("x-repair-token") ?? req.headers.get("x-cron-token");

    if (!(expected && token && token === expected)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData } = await userClient.auth.getUser();
      if (!userData?.user) return json({ error: "Token invalido" }, 401);
      const { data: role } = await admin
        .from("user_roles").select("role")
        .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
      if (!role) return json({ error: "Acesso restrito a admins" }, 403);
    }

    const body = await req.json().catch(() => ({})) as { dryRun?: boolean; limit?: number };
    const dryRun = body.dryRun === true;
    const limit = Math.min(Number(body.limit ?? 100), 200);

    const { data: rows, error } = await admin
      .from("refund_requests")
      .select("id,user_id,status,refund_amount,charge_id,provider_response,subscription_id")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return json({ error: error.message }, 500);

    const pendentes = (rows ?? []).filter((r) => {
      const pr = (r.provider_response ?? {}) as Record<string, unknown>;
      const s = String(pr.status ?? "").toUpperCase();
      return s === "PROCESSING" || s === "PENDING" || s === "IN_PROCESS";
    }).slice(0, limit);

    const results: Array<Record<string, unknown>> = [];
    let confirmados = 0, aindaProcessando = 0, falhos = 0;

    for (const r of pendentes) {
      const pr = (r.provider_response ?? {}) as Record<string, unknown>;
      const refundId = String(pr.refundId ?? pr.id ?? pr.reference ?? "").trim();
      if (!refundId) {
        results.push({ id: r.id, skip: "sem_refund_id" });
        continue;
      }
      try {
        const info = await getRefundStatus(refundId) as Record<string, unknown>;
        const node = (info?.data ?? info) as Record<string, unknown>;
        const item = Array.isArray((node as { items?: unknown[] }).items)
          ? ((node as { items: Record<string, unknown>[] }).items[0] ?? {})
          : {};
        const status = String(node.status ?? item.status ?? "").toUpperCase();
        const done = DONE.includes(status) || node.success === true;
        const failed = FAILED.includes(status);

        if (done) confirmados++;
        else if (failed) falhos++;
        else aindaProcessando++;

        results.push({ id: r.id, refundId, status, done, failed, amount: r.refund_amount });

        if (!dryRun && (done || failed)) {
          const nowIso = new Date().toISOString();
          await admin.from("refund_requests").update({
            status: done ? "processed" : "failed",
            processed_at: done ? nowIso : null,
            provider_response: { ...pr, status, reconciled_at: nowIso, reconciled_payload: info },
            updated_at: nowIso,
          }).eq("id", r.id);

          if (done && r.subscription_id) {
            await admin.from("subscriptions").update({
              status: "refunded",
              updated_at: nowIso,
            }).eq("id", r.subscription_id);
          }
        }
      } catch (err) {
        const detail = err instanceof ValidaPayError
          ? `${err.status} ${err.message}`
          : err instanceof Error ? err.message : String(err);
        results.push({ id: r.id, refundId, error: detail });
      }
    }

    return json({
      ok: true,
      dryRun,
      verificados: pendentes.length,
      confirmados,
      aindaProcessando,
      falhos,
      results,
    });
  } catch (err) {
    console.error("validapay-refund-status erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
