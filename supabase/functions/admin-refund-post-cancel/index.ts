// Estorna cobranças de renovação que ocorreram DEPOIS do cancelamento.
// Uso: POST { dry_run?: boolean, subscription_ids?: string[] } — restrito a admins.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { refundCharge, validaPayFetch, ValidaPayError } from "../_shared/validapay.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// deno-lint-ignore no-explicit-any -- payload do gateway não é tipado
type Any = any;

const PAID = ["PAID", "CONFIRMED", "APPROVED", "COMPLETED", "SETTLED"];


type ChargeItem = {
  chargeId: string;
  subscriptionId?: string | null;
  status?: string | null;
  amount?: number | null;
  createdAt?: string | null;
  paymentType?: string | null;
  email?: string | null;
};

/**
 * A ValidaPay ignora o filtro ?subscriptionId no /v1/charges, então varremos as
 * páginas mais recentes e filtramos localmente.
 */
async function listRecentCharges(sinceIso: string, maxPages = 40): Promise<ChargeItem[]> {
  const since = new Date(sinceIso).getTime();
  const out: ChargeItem[] = [];
  let lastKey: string | null = null;
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (lastKey) qs.set("lastKey", lastKey);
    const data = await validaPayFetch<Any>(`/v1/charges?${qs.toString()}`, {
      method: "GET",
      scope: "checkouts/read pix.cob/read accounts/read wallet/read",
    });
    const items: Any[] = data?.items ?? [];
    if (!items.length) break;
    for (const it of items) {
      out.push({
        chargeId: String(it.chargeId ?? it.id),
        subscriptionId: it.subscriptionId ?? null,
        status: it.status ?? null,
        amount: it.amount ?? null,
        createdAt: it.createdAt ?? null,
        paymentType: it.paymentType ?? null,
        email: it.email ?? null,
      });
    }
    const oldest = items[items.length - 1]?.createdAt;
    if (oldest && new Date(oldest).getTime() < since) break;
    lastKey = data?.pagination?.lastKey ?? null;
    if (!lastKey || data?.pagination?.hasMore === false) break;
  }
  return out;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Token inválido" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Acesso restrito a administradores" }, 403);

    const body = await req.json().catch(() => ({})) as {
      dry_run?: boolean;
      subscription_ids?: string[];
    };
    const dryRun = body.dry_run === true;

    // Renovações cobradas depois do cancelamento.
    const { data: events } = await admin
      .from("validapay_webhook_events")
      .select("subscription_id, created_at")
      .eq("event", "subscription.renewed")
      .order("created_at", { ascending: false })
      .limit(500);

    const results: Array<Record<string, unknown>> = [];
    const seen = new Set<string>();

    for (const ev of events ?? []) {
      const vpSubId = ev.subscription_id as string | null;
      if (!vpSubId || seen.has(vpSubId)) continue;

      const { data: sub } = await admin
        .from("subscriptions").select("*")
        .eq("validapay_subscription_id", vpSubId).maybeSingle();
      if (!sub?.cancelled_at) continue;
      if (new Date(ev.created_at as string) <= new Date(sub.cancelled_at)) continue;
      if (body.subscription_ids?.length && !body.subscription_ids.includes(sub.id)) continue;
      seen.add(vpSubId);

      // Já estornado antes?
      const { data: prior } = await admin
        .from("refund_requests").select("id,status")
        .eq("subscription_id", sub.id)
        .in("status", ["processed", "pending"])
        .maybeSingle();
      if (prior) {
        results.push({ subscription_id: sub.id, skipped: "refund_ja_registrado" });
        continue;
      }

      const { ids, raw } = await findSubscriptionCharges(vpSubId);
      // Ignora a cobrança inicial já conhecida — queremos a da renovação.
      const renewalIds = ids.filter((c) => c !== sub.validapay_charge_id);
      const target = renewalIds[0] ?? ids[0] ?? sub.validapay_charge_id;

      if (dryRun) {
        results.push({
          subscription_id: sub.id,
          validapay_subscription_id: vpSubId,
          renewed_at: ev.created_at,
          cancelled_at: sub.cancelled_at,
          amount: sub.amount,
          initial_charge: sub.validapay_charge_id,
          charges_found: ids,
          target_charge: target,
          raw,
        });
        continue;
      }

      if (!target) {
        results.push({ subscription_id: sub.id, ok: false, error: "cobrança não localizada" });
        continue;
      }

      let providerResponse: Record<string, unknown> | null = null;
      let ok = false;
      try {
        const result = await refundCharge(
          target,
          Number(sub.amount ?? 0),
          "CUSTOMER_REQUEST",
        ) as Record<string, unknown>;
        const st = String(result?.status ?? "").toUpperCase();
        ok = ["CONFIRMED", "COMPLETED", "SUCCESS", "PROCESSING"].includes(st) || result?.success === true;
        providerResponse = { provider: "validapay", chargeId: target, ...result };
      } catch (e) {
        const err = e as ValidaPayError;
        providerResponse = { provider: "validapay", chargeId: target, error: err.message, details: err.details ?? null };
        console.error("refund_logs", JSON.stringify({
          origin: "admin-refund-post-cancel", outcome: "error",
          subscription_id: sub.id, chargeId: target, message: err.message,
        }));
      }

      const now = new Date().toISOString();
      await admin.from("refund_requests").insert({
        user_id: sub.user_id,
        subscription_id: sub.id,
        payment_id: sub.mp_payment_id,
        charge_id: target,
        reason: "Cobrança indevida após cancelamento",
        reason_details: "Renovação cobrada mesmo após o cliente ter cancelado a assinatura. Estorno automático pelo suporte.",
        status: ok ? "processed" : "rejected",
        refund_amount: Number(sub.amount ?? 0),
        provider_response: providerResponse,
        requested_at: now,
        processed_at: now,
        automated: true,
        refund_kind: "post_cancel_charge",
      });

      if (ok) {
        await admin.from("subscriptions").update({
          status: "cancelled",
          cancel_at_period_end: true,
          updated_at: now,
        }).eq("id", sub.id);

        await admin.from("notifications").insert({
          user_id: sub.user_id,
          title: "Cobrança estornada",
          message: "Identificamos uma cobrança feita após o cancelamento da sua assinatura e já enviamos o estorno. O valor volta em até 30 dias, conforme o banco emissor.",
          type: "refund",
        });
      }

      results.push({ subscription_id: sub.id, charge_id: target, ok, provider: providerResponse });
    }

    return json({ ok: true, dry_run: dryRun, count: results.length, results });
  } catch (err) {
    console.error("admin-refund-post-cancel", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
