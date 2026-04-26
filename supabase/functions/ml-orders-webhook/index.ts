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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (body.topic !== "orders_v2") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const resourceId = body.resource.split("/").pop();
    const userId = body.user_id;

    const { data: integration } = await supabase
      .from("ml_integrations")
      .select("access_token")
      .eq("ml_user_id", userId)
      .single();

    if (!integration) {
      return new Response("no integration", { status: 200, headers: corsHeaders });
    }

    const orderRes = await fetch(`https://api.mercadolivre.com.br/orders/${resourceId}`, {
      headers: { Authorization: `Bearer ${integration.access_token}` },
    });
    const order = await orderRes.json();

    await supabase.from("orders").upsert(
      {
        ml_order_id: String(order.id),
        ml_user_id: String(userId),
        status: order.status,
        buyer_email: order.buyer?.email,
        total_amount: order.total_amount,
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
