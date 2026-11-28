import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendUtmifyOrder, utmifyHistoricalEvidence, utmifyIsMetaAds } from "../_shared/utmify.ts";
import { backfillAuthorized, parseBackfillInput } from "./policy.ts";

// Manual only. No cron, automatic retry or invocation during setup.
Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Configuração indisponível." }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  try {
    const allowed = await backfillAuthorized(token, key, async () => {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : data.user?.id ?? null;
    }, async userId => {
      const { data, error } = await admin.rpc("is_admin", { _user_id: userId });
      return !error && data === true;
    });
    if (!allowed) return json({ error: "Acesso não autorizado." }, 403);
    let raw: unknown;
    try { raw = await req.json(); } catch { return json({ error: "JSON inválido." }, 400); }
    const input = parseBackfillInput(raw);
    if (!input) return json({ error: "days deve ser inteiro entre 1 e 7; dry_run deve ser booleano." }, 400);
    const since = new Date(Date.now() - input.days * 86_400_000).toISOString();
    const orders: Array<{ subscriptionId: string; status: "paid" | "refunded"; approvedAt: string; refundedAt?: string }> = [];
    const skipped: Array<{ order_id: string; reason: string }> = [];
    // Complete reads with deterministic tie-breaking. Fetch everything before any send.
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await admin.from("subscriptions")
        .select("id,user_id,plan,amount,payment_method,purchase_kind,created_at,status,provider,validapay_subscription_id,validapay_charge_id")
        .eq("provider", "validapay").in("status", ["active", "cancel_scheduled", "refunded"])
        .gte("created_at", since).order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 99);
      if (error) throw new Error("candidate_read_failed");
      const userIds = [...new Set((data ?? []).map(sub => sub.user_id))];
      const { data: profiles, error: profilesError } = userIds.length
        ? await admin.from("profiles").select("user_id,utm_source,utm_medium,utm_campaign").in("user_id", userIds)
        : { data: [], error: null };
      if (profilesError) throw new Error("profile_attribution_read_failed");
      const metaUsers = new Set((profiles ?? []).filter(utmifyIsMetaAds).map(profile => profile.user_id));
      for (const sub of data ?? []) {
        if (!metaUsers.has(sub.user_id)) { skipped.push({ order_id: sub.id, reason: "non_meta_ads" }); continue; }
        const payment = await utmifyHistoricalEvidence(admin, sub);
        if (!payment) { skipped.push({ order_id: sub.id, reason: "missing_first_payment_evidence" }); continue; }
        if (sub.status === "refunded") {
          const { data: refunds, error: refundError } = await admin.from("refund_requests").select("processed_at")
            .eq("subscription_id", sub.id).eq("charge_id", payment.chargeId).eq("status", "processed")
            .eq("keep_access", false).order("processed_at", { ascending: false }).limit(1);
          if (refundError) throw new Error("refund_evidence_read_failed");
          const refundedAt = refunds?.[0]?.processed_at;
          if (!refundedAt || !Number.isFinite(Date.parse(refundedAt))) { skipped.push({ order_id: sub.id, reason: "missing_confirmed_refund_evidence" }); continue; }
          orders.push({ subscriptionId: sub.id, status: "refunded", approvedAt: payment.approvedAt, refundedAt });
        } else orders.push({ subscriptionId: sub.id, status: "paid", approvedAt: payment.approvedAt });
      }
      if ((data?.length ?? 0) < 100) break;
    }
    if (input.dry_run) return json({ dry_run: true, count: orders.length, order_ids: orders.map(o => o.subscriptionId), skipped });
    const results = [];
    for (const order of orders) results.push({ order_id: order.subscriptionId,
      ...await sendUtmifyOrder(admin, { ...order, triggerSource: "backfill" }) });
    return json({ dry_run: false, count: results.length, results, skipped });
  } catch { return json({ error: "Falha técnica na integração; nenhuma operação financeira foi realizada." }, 500); }
});