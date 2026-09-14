import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  sendSubscriptionConfirmationEmailOnce,
  type SubscriptionEmailInput,
} from "../_shared/transactional-email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizePlan = (value: unknown) => {
  const plan = String(value ?? "base").toLowerCase();
  if (plan === "plus") return "pro";
  return ["base", "pro", "business"].includes(plan) ? plan : "base";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Hybrid deployment: DB may live on a different project than the functions
    const dbUrl = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("APP_URL") ?? "https://www.velods.com.br";
    const adminClient = createClient(dbUrl, dbKey);

    // Pega assinatura mais recente do usuário.
    let { data: sub } = await adminClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub) {
      // Recuperação automática: o pagamento pode ter sido criado no Mercado Pago
      // antes de uma falha de persistência local. A identidade vem exclusivamente
      // do JWT validado e do metadata.user_id gravado no pagamento.
      const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
      if (MP_ACCESS_TOKEN) {
        const beginDate = new Date(Date.now() - 45 * 86400000).toISOString();
        const searchUrl = new URL("https://api.mercadopago.com/v1/payments/search");
        searchUrl.searchParams.set("sort", "date_created");
        searchUrl.searchParams.set("criteria", "desc");
        searchUrl.searchParams.set("range", "date_created");
        searchUrl.searchParams.set("begin_date", beginDate);
        searchUrl.searchParams.set("end_date", new Date().toISOString());
        searchUrl.searchParams.set("limit", "100");

        const searchRes = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
        });
        const searchBody = await searchRes.json();
        const recoveredPayment = Array.isArray(searchBody?.results)
          ? searchBody.results.find((payment: Record<string, unknown>) => {
              const metadata = payment.metadata as Record<string, unknown> | undefined;
              return payment.status === "approved" && String(metadata?.user_id ?? "") === userId;
            })
          : null;

        if (recoveredPayment?.id) {
          const now = new Date();
          const periodStart = recoveredPayment.date_approved
            ? new Date(recoveredPayment.date_approved)
            : now;
          const periodEnd = new Date(periodStart);
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          const recoveredPlan = normalizePlan(recoveredPayment.metadata?.plan);

          const { data: recoveredSub, error: recoveryError } = await adminClient
            .from("subscriptions")
            .upsert({
              user_id: userId,
              plan: recoveredPlan,
              status: "active",
              mp_payment_id: String(recoveredPayment.id),
              payment_method: recoveredPayment.payment_method_id ?? "unknown",
              amount: Number(recoveredPayment.transaction_amount ?? 0),
              current_period_start: periodStart.toISOString(),
              current_period_end: periodEnd.toISOString(),
              updated_at: now.toISOString(),
            }, { onConflict: "mp_payment_id" })
            .select("*")
            .maybeSingle();

          if (recoveryError) {
            console.error("Approved payment recovery failed:", JSON.stringify({ user_id: userId, payment_id: recoveredPayment.id, error: recoveryError }));
          } else {
            sub = recoveredSub;
            console.log("Approved payment recovered:", JSON.stringify({ user_id: userId, payment_id: recoveredPayment.id, plan: recoveredPlan }));
          }
        }
      }

      if (!sub) {
        return new Response(JSON.stringify({ status: "not_found" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Já ativa? Retorna direto
    if (sub.status === "active") {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ plano: sub.plan })
        .eq("user_id", userId);
      if (profileError) {
        console.error("Active subscription profile sync failed:", JSON.stringify({ user_id: userId, plan: sub.plan, error: profileError }));
      }
      const emailResult = await sendSubscriptionConfirmationEmailOnce({
        adminClient,
        subscription: sub as SubscriptionEmailInput,
        resendApiKey,
        siteUrl,
      });
      if (!emailResult.sent && !("skipped" in emailResult && emailResult.skipped)) {
        console.error("Subscription confirmation email failed:", JSON.stringify(emailResult));
      }
      return new Response(JSON.stringify({ status: "active", plan: sub.plan }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Consulta MP para confirmar pagamento
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN || !sub.mp_payment_id) {
      return new Response(JSON.stringify({ status: sub.status, plan: sub.plan }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${sub.mp_payment_id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (!mpRes.ok) {
      console.error("MP fetch error:", JSON.stringify(payment));
      return new Response(JSON.stringify({ status: sub.status, plan: sub.plan }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "approved") {
      const { data: updatedSubscription } = await adminClient.from("subscriptions")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", sub.id)
        .select("id,user_id,plan,amount,payment_method,current_period_start,current_period_end,next_charge_at,confirmation_email_sent_at")
        .maybeSingle();
      const { error: profileError } = await adminClient
        .from("profiles")
        .update({ plano: sub.plan })
        .eq("user_id", userId);
      if (profileError) {
        console.error("Approved payment profile sync failed:", JSON.stringify({ user_id: userId, plan: sub.plan, error: profileError }));
      }
      const emailResult = await sendSubscriptionConfirmationEmailOnce({
        adminClient,
        subscription: (updatedSubscription ?? sub) as SubscriptionEmailInput,
        resendApiKey,
        siteUrl,
      });
      if (!emailResult.sent && !("skipped" in emailResult && emailResult.skipped)) {
        console.error("Subscription confirmation email failed:", JSON.stringify(emailResult));
      }
      return new Response(JSON.stringify({ status: "active", plan: sub.plan }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payment.status === "rejected" || payment.status === "cancelled") {
      await adminClient.from("subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", sub.id);
      return new Response(JSON.stringify({ status: "cancelled", plan: sub.plan }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: "pending", plan: sub.plan, mp_status: payment.status }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("verify error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
