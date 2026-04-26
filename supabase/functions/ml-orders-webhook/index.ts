import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("[ml-orders-webhook] received body:", JSON.stringify(body));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (body.topic !== "orders_v2") {
      console.log("[ml-orders-webhook] ignoring topic:", body.topic);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const resourceId = body.resource?.split("/").pop();
    // ML envia user_id como number; normalizamos para Number para garantir match com bigint
    const rawUserId = body.user_id;
    const userIdNum = Number(rawUserId);

    console.log("[ml-orders-webhook] lookup", {
      rawUserId,
      typeofRawUserId: typeof rawUserId,
      userIdNum,
      resourceId,
    });

    // Pode haver múltiplas integrações com o mesmo ml_user_id (re-conexões).
    // Usamos a mais recente em vez de .single() para evitar erro de múltiplas rows.
    const { data: integrations, error: intError } = await supabase
      .from("user_integrations")
      .select("access_token, user_id, ml_user_id, updated_at")
      .eq("ml_user_id", userIdNum)
      .eq("platform", "mercadolivre")
      .order("updated_at", { ascending: false })
      .limit(1);

    console.log("[ml-orders-webhook] integration query result:", {
      count: integrations?.length ?? 0,
      error: intError?.message,
      first: integrations?.[0] ? { user_id: integrations[0].user_id, ml_user_id: integrations[0].ml_user_id } : null,
    });

    const integration = integrations?.[0];
    if (!integration) {
      console.error("[ml-orders-webhook] no integration found for ml_user_id:", userIdNum);
      return new Response("no integration", { status: 200, headers: corsHeaders });
    }

    const orderRes = await fetch(`https://api.mercadolivre.com.br/orders/${resourceId}`, {
      headers: { Authorization: `Bearer ${integration.access_token}` },
    });
    const order = await orderRes.json();
    console.log("[ml-orders-webhook] order fetched:", { id: order?.id, status: order?.status });

    await supabase.from("orders").upsert(
      {
        user_id: integration.user_id,
        ml_order_id: String(order.id),
        ml_user_id: String(userIdNum),
        external_order_id: String(order.id),
        platform: "mercadolivre",
        status: order.status,
        buyer_email: order.buyer?.email,
        buyer_name: order.buyer?.nickname,
        total_amount: order.total_amount,
        sale_price: order.total_amount ?? 0,
        product_title: order.order_items?.[0]?.item?.title ?? "",
        raw: order,
      },
      { onConflict: "ml_order_id" }
    );

    await supabase.functions.invoke("cj-fulfill", {
      body: { ml_order_id: String(order.id) },
    });

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("ml-orders-webhook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
