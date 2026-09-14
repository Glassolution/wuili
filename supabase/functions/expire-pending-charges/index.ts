// Expira cobranças pendentes: assinaturas em "pending" há mais de 30 minutos
// sem confirmação real de pagamento viram "expired".
//
// Antes de expirar, fazemos uma última verificação no gateway — se a cobrança
// estiver realmente paga (webhook perdido), ativamos em vez de expirar.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isConfirmedPayment, lookupPaymentStatus } from "../_shared/validapay.ts";

const EXPIRE_AFTER_MS = 30 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const addMonths = (date: Date, months: number) => {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const result = { checked: 0, activated: 0, expired: 0 };

  try {
    const { data: pendings } = await admin
      .from("subscriptions")
      .select("id,user_id,plan,validapay_charge_id,validapay_subscription_id,created_at")
      .eq("status", "pending")
      .lte("created_at", new Date(Date.now() - EXPIRE_AFTER_MS).toISOString())
      .order("created_at", { ascending: true })
      .limit(200);

    for (const sub of pendings ?? []) {
      result.checked++;
      const reference = sub.validapay_charge_id ?? sub.validapay_subscription_id;

      if (reference) {
        try {
          const info = await lookupPaymentStatus(reference);
          if (isConfirmedPayment(info) && info) {
            const now = new Date();
            await admin.from("subscriptions").update({
              status: "active",
              provider: "validapay",
              payment_method: (info.paymentMethod ?? "pix").toString().toLowerCase(),
              validapay_charge_id: info.chargeId ?? sub.validapay_charge_id,
              current_period_start: now.toISOString(),
              current_period_end: addMonths(now, 1).toISOString(),
              updated_at: now.toISOString(),
            }).eq("id", sub.id);
            await admin.from("profiles").update({ plano: sub.plan }).eq("user_id", sub.user_id);
            result.activated++;
            continue;
          }
        } catch (err) {
          console.error("expire-pending-charges: verificação falhou", sub.id, String(err));
        }
      }

      await admin.from("subscriptions").update({
        status: "expired",
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id).eq("status", "pending");
      result.expired++;
    }

    console.log("expire-pending-charges:", JSON.stringify(result));
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("expire-pending-charges: erro fatal", String(err));
    return json({ error: "Falha ao expirar cobranças pendentes" }, 500);
  }
});
