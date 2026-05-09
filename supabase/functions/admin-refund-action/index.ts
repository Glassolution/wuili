import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData } = await userClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Token inválido" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Acesso restrito a administradores" }, 403);

    const { refund_id, action } = await req.json();
    if (!refund_id || !["approve", "reject"].includes(action)) {
      return json({ error: "refund_id e action (approve|reject) obrigatórios" }, 400);
    }

    const { data: refund } = await admin.from("refund_requests").select("*").eq("id", refund_id).maybeSingle();
    if (!refund) return json({ error: "Reembolso não encontrado" }, 404);
    if (refund.status !== "pending") return json({ error: "Pedido já processado" }, 400);

    if (action === "reject") {
      await admin.from("refund_requests").update({
        status: "rejected",
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", refund_id);
      await admin.from("notifications").insert({
        user_id: refund.user_id,
        title: "Reembolso recusado",
        message: "Após análise, seu pedido de reembolso foi recusado. Sua assinatura continua ativa.",
        type: "refund",
      });
      return json({ success: true, message: "Reembolso recusado." });
    }

    // approve
    const { data: sub } = await admin.from("subscriptions").select("*").eq("id", refund.subscription_id).maybeSingle();
    let providerResponse: unknown = null;
    let refundOk = true;
    const MP = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (MP && sub?.mp_payment_id) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${sub.mp_payment_id}/refunds`, {
        method: "POST",
        headers: { Authorization: `Bearer ${MP}`, "Content-Type": "application/json", "X-Idempotency-Key": `refund-${sub.id}-${Date.now()}` },
        body: JSON.stringify({}),
      });
      providerResponse = await r.json();
      refundOk = r.ok;
    }

    await admin.from("refund_requests").update({
      status: refundOk ? "processed" : "rejected",
      provider_response: providerResponse as Record<string, unknown> | null,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", refund_id);

    if (refundOk && sub) {
      await admin.from("subscriptions").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", sub.id);
      const cooldownUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await admin.from("profiles").update({ plano: "gratis", refund_cooldown_until: cooldownUntil }).eq("user_id", refund.user_id);

      // Derrubar publicações ativas no ML
      try {
        const { data: integ } = await admin.from("user_integrations")
          .select("access_token").eq("user_id", refund.user_id).eq("platform", "mercadolivre").maybeSingle();
        const { data: pubs } = await admin.from("user_publications")
          .select("id, ml_item_id").eq("user_id", refund.user_id).eq("status", "active");
        if (integ?.access_token && pubs?.length) {
          for (const p of pubs) {
            try {
              await fetch(`https://api.mercadolibre.com/items/${p.ml_item_id}`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${integ.access_token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ status: "paused" }),
              });
              await fetch(`https://api.mercadolibre.com/items/${p.ml_item_id}`, {
                method: "PUT",
                headers: { Authorization: `Bearer ${integ.access_token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ status: "closed" }),
              });
            } catch (e) { console.error("ml close", e); }
          }
        }
        await admin.from("user_publications")
          .update({ status: "closed", updated_at: new Date().toISOString() })
          .eq("user_id", refund.user_id).eq("status", "active");
      } catch (e) { console.error("derrubar pubs", e); }
    }

    await admin.from("notifications").insert({
      user_id: refund.user_id,
      title: refundOk ? "Reembolso aprovado" : "Falha ao processar reembolso",
      message: refundOk
        ? "Seu reembolso foi aprovado e o valor será creditado em até 7 dias úteis."
        : "Não foi possível processar o reembolso. Entre em contato com o suporte.",
      type: "refund",
    });

    return json({ success: refundOk, providerResponse });
  } catch (err) {
    console.error("admin-refund-action:", err);
    return json({ error: "Erro interno", message: String(err) }, 500);
  }
});
