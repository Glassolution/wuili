// mp-trial-convert
// Cron-invoked job that converts finished paid trials into recurring
// subscriptions. Selects rows in `subscriptions` where is_trial=true and
// next_charge_at <= now(), creates a Mercado Pago preapproval for the
// stored next_charge_amount, and flips the row to the post-trial plan.
//
// Called daily by a pg_cron job (see migration scheduling this endpoint).
// Idempotent per row: after conversion is_trial=false, so re-runs skip it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const appUrl = Deno.env.get("APP_URL") ?? "https://wuili.lovable.app";

    if (!MP_ACCESS_TOKEN || !supabaseUrl || !serviceKey) {
      return json({ error: "Configuração ausente." }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const nowIso = new Date().toISOString();
    const { data: due, error: dueErr } = await admin
      .from("subscriptions")
      .select("id, user_id, plan, post_trial_plan, next_charge_amount, next_charge_at, mp_subscription_id")
      .eq("is_trial", true)
      .lte("next_charge_at", nowIso)
      .in("status", ["trialing", "active"])
      .limit(200);

    if (dueErr) {
      console.error("Query due trials failed:", dueErr);
      return json({ error: "Falha ao consultar trials." }, 500);
    }

    if (!due || due.length === 0) {
      return json({ processed: 0, message: "Nenhum trial pendente." });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const sub of due) {
      const rowId = sub.id as string;
      const userId = sub.user_id as string;
      const amount = Number(sub.next_charge_amount ?? 0);
      const postPlan = (sub.post_trial_plan as string) || (sub.plan as string) || "pro";

      if (!amount || amount <= 0) {
        results.push({ id: rowId, skipped: "amount inválido" });
        continue;
      }

      try {
        // Get payer email from auth.users
        const { data: userData } = await admin.auth.admin.getUserById(userId);
        const payerEmail = userData?.user?.email;
        if (!payerEmail) {
          results.push({ id: rowId, skipped: "sem email" });
          continue;
        }

        // Create a MP preapproval (auto-recurring monthly) starting immediately
        const preapprovalPayload = {
          reason: `Velo ${postPlan === "business" ? "Business" : "Pro"} — assinatura mensal`,
          external_reference: `sub_${rowId}`,
          payer_email: payerEmail,
          back_url: `${appUrl}/dashboard/planos?from=trial_convert`,
          auto_recurring: {
            frequency: 1,
            frequency_type: "months",
            transaction_amount: amount,
            currency_id: "BRL",
          },
          status: "pending",
        };

        const mpResp = await fetch("https://api.mercadopago.com/preapproval", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": `trial-convert-${rowId}`,
          },
          body: JSON.stringify(preapprovalPayload),
        });
        const mpData = await mpResp.json();

        if (!mpResp.ok) {
          console.error("MP preapproval failed:", rowId, JSON.stringify(mpData));
          await admin
            .from("subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("id", rowId);
          results.push({ id: rowId, error: "mp_preapproval_failed", details: mpData });
          continue;
        }

        // Flip the row: no longer trialing, next recurring charge scheduled.
        const nextPeriodStart = new Date();
        const nextPeriodEnd = new Date(nextPeriodStart);
        nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1);

        await admin
          .from("subscriptions")
          .update({
            plan: postPlan,
            status: "active",
            is_trial: false,
            trial_ends_at: null,
            next_charge_amount: null,
            next_charge_at: null,
            post_trial_plan: null,
            amount,
            mp_subscription_id: String(mpData.id ?? sub.mp_subscription_id ?? ""),
            current_period_start: nextPeriodStart.toISOString(),
            current_period_end: nextPeriodEnd.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", rowId);

        await admin
          .from("profiles")
          .update({ plano: postPlan })
          .eq("user_id", userId);

        await admin.from("notifications").insert({
          user_id: userId,
          title: "Seu trial terminou 🎉",
          message: `Sua assinatura mensal de R$ ${amount.toFixed(2).replace(".", ",")} foi ativada.`,
          type: "billing",
          metadata: { subscription_id: rowId, mp_id: mpData.id },
        });

        results.push({ id: rowId, converted: true, mp_id: mpData.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("Convert trial error:", rowId, message);
        results.push({ id: rowId, error: message });
      }
    }

    return json({ processed: results.length, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("mp-trial-convert error:", message);
    return json({ error: message }, 500);
  }
});
