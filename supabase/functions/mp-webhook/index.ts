import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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

    if (!userId) {
      console.log("No user_id in metadata, skipping");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let subStatus = "pending";
    if (payment.status === "approved") subStatus = "active";
    else if (payment.status === "rejected" || payment.status === "cancelled") subStatus = "cancelled";
    else if (payment.status === "refunded") subStatus = "cancelled";

    // Update subscription
    const { data: existing } = await adminClient
      .from("subscriptions")
      .select("id")
      .eq("mp_payment_id", String(paymentId))
      .maybeSingle();

    if (existing) {
      await adminClient
        .from("subscriptions")
        .update({ status: subStatus, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      await adminClient.from("subscriptions").insert({
        user_id: userId,
        plan: plan || "plus",
        status: subStatus,
        mp_payment_id: String(paymentId),
        payment_method: payment.payment_method_id || "unknown",
        amount: payment.transaction_amount || 0,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      });
    }

    // Update profile plan
    if (subStatus === "active") {
      await adminClient.from("profiles").update({ plano: plan || "plus" }).eq("user_id", userId);
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
