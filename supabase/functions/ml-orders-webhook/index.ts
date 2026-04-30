import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dropvelo.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function refreshMlToken(refreshToken: string) {
  const res = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_CLIENT_ID")!,
      client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
      refresh_token: refreshToken,
    }),
  });
  return await res.json();
}

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
    const rawUserId = body.user_id;
    const userIdNum = Number(rawUserId);

    console.log("[ml-orders-webhook] lookup", {
      rawUserId,
      typeofRawUserId: typeof rawUserId,
      userIdNum,
      resourceId,
    });

    const { data: integrations, error: intError } = await supabase
      .from("user_integrations")
      .select("id, access_token, refresh_token, user_id, ml_user_id, updated_at")
      .eq("ml_user_id", userIdNum)
      .eq("platform", "mercadolivre")
      .order("updated_at", { ascending: false })
      .limit(1);

    console.log("[ml-orders-webhook] integration query result:", {
      count: integrations?.length ?? 0,
      error: intError?.message,
      first: integrations?.[0]
        ? { user_id: integrations[0].user_id, ml_user_id: integrations[0].ml_user_id }
        : null,
    });

    const integration = integrations?.[0];
    if (!integration) {
      console.error("[ml-orders-webhook] no integration found for ml_user_id:", userIdNum);
      return new Response("no integration", { status: 200, headers: corsHeaders });
    }

    let accessToken = integration.access_token as string;

    // Helper to fetch the order with current token
    const fetchOrder = (token: string) =>
      fetch(`https://api.mercadolibre.com/orders/${resourceId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

    let orderRes = await fetchOrder(accessToken);

    // If unauthorized/forbidden, try refreshing the token once
    if ((orderRes.status === 401 || orderRes.status === 403) && integration.refresh_token) {
      console.log("[ml-orders-webhook] token rejected (", orderRes.status, "), attempting refresh");
      const refreshed = await refreshMlToken(integration.refresh_token);
      if (refreshed?.access_token) {
        accessToken = refreshed.access_token;
        const newMlUserId =
          refreshed.user_id != null ? Number(refreshed.user_id) : integration.ml_user_id;
        await supabase
          .from("user_integrations")
          .update({
            access_token: refreshed.access_token,
            refresh_token: refreshed.refresh_token ?? integration.refresh_token,
            ml_user_id: newMlUserId,
            expires_at: new Date(
              Date.now() + (refreshed.expires_in ?? 21600) * 1000
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration.id);
        console.log("[ml-orders-webhook] token refreshed, retrying order fetch");
        orderRes = await fetchOrder(accessToken);
      } else {
        console.error("[ml-orders-webhook] token refresh failed:", JSON.stringify(refreshed));
      }
    }

    const order = await orderRes.json();
    console.log("[ml-orders-webhook] order fetched:", {
      id: order?.id,
      status: order?.status,
      httpStatus: orderRes.status,
    });

    // Guard: if no valid order id, do not upsert
    if (!order?.id) {
      console.warn("[ml-orders-webhook] no valid order.id, skipping upsert");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

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
