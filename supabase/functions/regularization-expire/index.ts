// Cron 24h: quem ficou em "pending_regularization" sem pagamento confirmado
// vira "cancelled_unpaid" definitivamente (o bloqueio de acesso continua).
// Quem pagou nesse meio-tempo é reativado.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isConfirmedPayment, lookupPaymentStatus } from "../_shared/validapay.ts";

const GRACE_MS = 24 * 60 * 60 * 1000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const result = { checked: 0, recovered: 0, cancelled: 0 };

  try {
    const { data: subs } = await admin
      .from("subscriptions")
      .select("id,user_id,plan,validapay_charge_id,validapay_subscription_id,updated_at")
      .eq("status", "pending_regularization")
      .lte("updated_at", new Date(Date.now() - GRACE_MS).toISOString())
      .limit(300);

    for (const sub of subs ?? []) {
      result.checked++;

      // Pagou depois do aviso? Em qualquer assinatura ativa dele, mantemos o acesso.
      const { data: paid } = await admin
        .from("subscriptions")
        .select("id,plan")
        .eq("user_id", sub.user_id)
        .eq("status", "active")
        .not("validapay_charge_id", "is", null)
        .limit(1)
        .maybeSingle();

      let confirmed = !!paid;
      const reference = sub.validapay_charge_id ?? sub.validapay_subscription_id;
      if (!confirmed && reference) {
        try {
          confirmed = isConfirmedPayment(await lookupPaymentStatus(reference));
        } catch (err) {
          console.error("regularization-expire: lookup falhou", sub.id, String(err));
        }
      }

      if (confirmed) {
        const now = new Date();
        const periodEnd = new Date(now);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        await admin.from("subscriptions").update({
          status: "active",
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          updated_at: now.toISOString(),
        }).eq("id", sub.id);
        await admin.from("profiles").update({ plano: sub.plan }).eq("user_id", sub.user_id);
        result.recovered++;
        continue;
      }

      await admin.from("subscriptions").update({
        status: "cancelled_unpaid",
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
      await admin.from("profiles").update({ plano: "gratis" }).eq("user_id", sub.user_id);
      result.cancelled++;
    }

    console.log("regularization-expire:", JSON.stringify(result));
    return json({ ok: true, ...result });
  } catch (err) {
    console.error("regularization-expire: erro fatal", String(err));
    return json({ error: "Falha ao expirar regularizações" }, 500);
  }
});
