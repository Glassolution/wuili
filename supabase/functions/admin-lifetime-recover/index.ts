// Temporária, só admin: confere na ValidaPay as compras vitalícias pendentes/expiradas
// e (com apply=true) libera as que estão pagas com o valor esperado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { isConfirmedPayment, lookupPaymentStatus, validaPayFetch } from "../_shared/validapay.ts";
import { recoverLifetimePurchases } from "../_shared/lifetimeCharge.ts";
import { lifetimePaymentMatches, lifetimePeriod } from "../_shared/lifetimePlans.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const auth = req.headers.get("Authorization") ?? "";
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
  if (!u?.user) return json({ error: "401" }, 401);
  const { data: isAdm } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
  if (!isAdm) return json({ error: "403" }, 403);
  const body = await req.json().catch(() => ({}));
  if (body.probe) {
    try { return json({ r: await validaPayFetch(body.probe, { method: body.method ?? "GET", scope: body.scope ?? "checkouts/read pix.cob/read accounts/read", ...(body.payload ? { body: JSON.stringify(body.payload) } : {}) }) }); }
    catch (e) { return json({ e: String(e) }); }
  }
  if (body.recover) return json({ activated: await recoverLifetimePurchases(admin) });
  const { data: subs } = await admin.from("subscriptions")
    .select("id,user_id,plan,amount,status,validapay_subscription_id,validapay_charge_id")
    .eq("purchase_kind", "lifetime").in("status", ["pending", "expired"]);
  const out = [];
  for (const s of subs ?? []) {
    const ref = s.validapay_charge_id ?? s.validapay_subscription_id;
    let raw: unknown = null;
    try { raw = await validaPayFetch(`/v1/checkout-sessions/${ref}`, { method: "GET", scope: "checkouts/read pix.cob/read accounts/read" }); } catch (e) { raw = String(e); }
    const info = ref ? await lookupPaymentStatus(ref) : null;
    const ok = isConfirmedPayment(info) && lifetimePaymentMatches(Number(s.amount), info?.amount ?? null);
    if (ok && body.apply) {
      const now = new Date().toISOString();
      await admin.from("subscriptions").update({ status: "active", validapay_charge_id: info?.chargeId ?? null, payment_method: (info?.paymentMethod ?? "pix").toString().toLowerCase(), current_period_start: now, ...lifetimePeriod, origin_paid_at: now, updated_at: now }).eq("id", s.id);
      await admin.from("profiles").update({ plano: s.plan }).eq("user_id", s.user_id);
    }
    out.push({ id: s.id, plan: s.plan, amount: s.amount, ok, info, raw: body.raw ? raw : undefined });
  }
  return json({ out });
});
