import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const body = await req.json();
    const { subscription_id, reason, reason_details } = body;
    if (!subscription_id || !reason) {
      return new Response(JSON.stringify({ error: "subscription_id e reason são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validar assinatura
    const { data: sub, error: subErr } = await adminClient
      .from("subscriptions")
      .select("*")
      .eq("id", subscription_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (subErr || !sub) {
      return new Response(JSON.stringify({ error: "Assinatura não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (sub.status !== "active") {
      return new Response(JSON.stringify({ error: "Apenas assinaturas ativas podem ser reembolsadas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar prazo de 7 dias
    const createdAt = new Date(sub.created_at).getTime();
    const days = (Date.now() - createdAt) / (1000 * 60 * 60 * 24);
    if (days > 7) {
      return new Response(JSON.stringify({ error: "Prazo de reembolso (7 dias) expirado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let providerResponse: unknown = null;
    let refundOk = true;

    // Solicitar reembolso no Mercado Pago
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (MP_ACCESS_TOKEN && sub.mp_payment_id) {
      const refundRes = await fetch(
        `https://api.mercadopago.com/v1/payments/${sub.mp_payment_id}/refunds`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": `refund-${sub.id}-${Date.now()}`,
          },
          body: JSON.stringify({}),
        }
      );
      providerResponse = await refundRes.json();
      refundOk = refundRes.ok;
      if (!refundOk) console.error("MP refund error:", JSON.stringify(providerResponse));
    }

    // Registrar pedido de reembolso
    const { data: refund } = await adminClient.from("refund_requests").insert({
      user_id: userId,
      subscription_id: sub.id,
      payment_id: sub.mp_payment_id,
      reason,
      reason_details: reason_details || null,
      status: refundOk ? "processed" : "rejected",
      refund_amount: sub.amount,
      provider_response: providerResponse as Record<string, unknown> | null,
      processed_at: new Date().toISOString(),
    }).select().single();

    if (refundOk) {
      await adminClient.from("subscriptions")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", sub.id);
      await adminClient.from("profiles").update({ plano: "gratis" }).eq("user_id", userId);
    }

    return new Response(JSON.stringify({
      success: refundOk,
      refund,
      message: refundOk
        ? "Reembolso solicitado com sucesso. O valor será creditado em até 7 dias úteis."
        : "Não foi possível processar o reembolso automaticamente.",
    }), {
      status: refundOk ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("refund error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", message: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
