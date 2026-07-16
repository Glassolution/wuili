import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  sendSubscriptionConfirmationEmailOnce,
  type SubscriptionEmailInput,
} from "../_shared/transactional-email-templates.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    // Mercado Pago sends notifications with type and data
    if (body.type !== "payment" && body.action !== "payment.updated" && body.action !== "payment.created") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      return new Response(JSON.stringify({ error: "No payment ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    }

    // Fetch payment details from MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const payment = await mpRes.json();

    if (!mpRes.ok) {
      console.error("Failed to fetch payment:", JSON.stringify(payment));
      return new Response(JSON.stringify({ error: "Failed to fetch payment" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = payment.metadata?.user_id;
    const plan = payment.metadata?.plan;
    const affiliateRef = payment.metadata?.affiliate_ref ?? payment.external_reference;
    const paymentKind = payment.metadata?.kind;

    // Hybrid deployment: DB may live on a different project than the functions
    const dbUrl = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const siteUrl = Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("APP_URL") ?? "https://www.velods.com.br";
    const adminClient = createClient(dbUrl, dbKey);

    // ── Store orders (pedidos da loja do vendedor) ──────────────────────────
    // Pedidos vindos de páginas de vendas publicadas — kind === 'store_order'.
    // Nunca tratamos como assinatura; atualizamos o pedido pelo external_reference.
    if (paymentKind === "store_order") {
      const extRef = payment.external_reference ?? payment.metadata?.store_order_id;
      if (extRef) {
        const newStatus =
          payment.status === "approved"
            ? "approved"
            : payment.status === "rejected" || payment.status === "cancelled"
            ? "rejected"
            : payment.status === "refunded"
            ? "refunded"
            : "pending";

        const query = adminClient
          .from("store_orders")
          .update({
            payment_status: newStatus,
            mp_payment_id: String(paymentId),
            updated_at: new Date().toISOString(),
          });

        const filter = String(extRef).startsWith("store_")
          ? query.eq("mp_external_reference", String(extRef))
          : query.eq("id", String(extRef));

        const { error: updErr } = await filter;
        if (updErr) console.error("store_orders update failed:", updErr);
      }

      return new Response(JSON.stringify({ ok: true, kind: "store_order" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Affiliate sales tracking (influencer commissions) ───────────────────
    // If this payment has an affiliate ref, we register it as an affiliate sale.
    // Payout status starts as "pending" and can be marked "paid" by admins later.
    if (affiliateRef) {
      try {
        const { data: affiliateProfile } = await adminClient
          .from("profiles")
          .select("user_id, ref")
          .eq("ref", String(affiliateRef))
          .maybeSingle();

        if (affiliateProfile?.user_id) {
          const planPrice =
            Number(payment.metadata?.plan_price ?? payment.transaction_amount ?? 147.9) || 147.9;
          const commissionRate =
            Number(payment.metadata?.commission_rate ?? 0.2) || 0.2;

          const payerNameParts = [payment.payer?.first_name, payment.payer?.last_name].filter(Boolean);
          const payerName = payerNameParts.length ? payerNameParts.join(" ") : null;
          const payerEmail = payment.payer?.email ?? null;

          const createdAt =
            payment.date_approved ?? payment.date_created ?? new Date().toISOString();

          await adminClient.from("affiliate_sales").upsert(
            {
              affiliate_user_id: affiliateProfile.user_id,
              affiliate_ref: String(affiliateRef),
              customer_name: payerName,
              customer_email: payerEmail,
              plan: String(payment.metadata?.plan ?? "mensal"),
              plan_price: planPrice,
              commission_rate: commissionRate,
              commission_amount: Number((planPrice * commissionRate).toFixed(2)),
              commission_status: "pending",
              mp_payment_id: String(paymentId),
              mp_preference_id: payment.preference_id ? String(payment.preference_id) : null,
              created_at: createdAt,
            },
            { onConflict: "mp_payment_id" },
          );

          // Novo funil (admin): marcar conversao como "paid" e gerar comissao pendente
          if (userId) {
            await adminClient.from("affiliate_conversions").upsert(
              {
                affiliate_code: String(affiliateRef).toUpperCase(),
                subscriber_user_id: String(userId),
                status: "paid",
                plan_value: planPrice,
                commission_rate: commissionRate,
                commission_value: Number((planPrice * commissionRate).toFixed(2)),
                payout_status: "pending",
                paid_at: createdAt,
                created_at: createdAt,
              },
              { onConflict: "affiliate_code,subscriber_user_id" },
            );
          }
        }
      } catch (affiliateError) {
        console.error("Affiliate sale insert failed:", affiliateError);
      }
    }

    // If this is not a user subscription payment, we can safely stop here.
    if (!userId) {
      console.log("No user_id in metadata (subscription), skipping subscription update");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const maybeOrderId =
      payment.metadata?.order_id ??
      payment.metadata?.internal_order_id ??
      payment.external_reference;

    let subStatus = "pending";
    if (payment.status === "approved") subStatus = "active";
    else if (payment.status === "rejected" || payment.status === "cancelled") subStatus = "cancelled";
    else if (payment.status === "refunded") subStatus = "cancelled";

    // Update subscription
    const { data: existing } = await adminClient
      .from("subscriptions")
      .select("id,status,confirmation_email_sent_at")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    let subscriptionForEmail: SubscriptionEmailInput | null = null;

    if (existing) {
      const { data: updatedSubscription } = await adminClient
        .from("subscriptions")
        .update({ status: subStatus, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id,user_id,plan,amount,payment_method,current_period_start,current_period_end,next_charge_at,confirmation_email_sent_at")
        .maybeSingle();
      subscriptionForEmail = (updatedSubscription ?? null) as SubscriptionEmailInput | null;
    } else {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { data: insertedSubscription } = await adminClient.from("subscriptions").insert({
        user_id: userId,
        plan: plan || "plus",
        status: subStatus,
        mp_payment_id: String(paymentId),
        payment_method: payment.payment_method_id || "unknown",
        amount: payment.transaction_amount || 0,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      }).select("id,user_id,plan,amount,payment_method,current_period_start,current_period_end,next_charge_at,confirmation_email_sent_at")
        .maybeSingle();
      subscriptionForEmail = (insertedSubscription ?? null) as SubscriptionEmailInput | null;
    }

    // Update profile plan
    if (subStatus === "active") {
      await adminClient.from("profiles").update({ plano: plan || "plus" }).eq("user_id", userId);
      if (subscriptionForEmail) {
        const emailResult = await sendSubscriptionConfirmationEmailOnce({
          adminClient,
          subscription: subscriptionForEmail,
          resendApiKey,
          siteUrl,
        });
        if (!emailResult.sent && !("skipped" in emailResult && emailResult.skipped)) {
          console.error("Subscription confirmation email failed:", JSON.stringify(emailResult));
        }
      }
    } else if (subStatus === "cancelled") {
      await adminClient.from("profiles").update({ plano: "gratis" }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
