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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const loginRes = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: Deno.env.get("CJ_EMAIL"),
          password: Deno.env.get("CJ_PASSWORD"),
        }),
      }
    );
    const loginData = await loginRes.json();
    const cjToken = loginData.data?.accessToken;
    if (!cjToken) {
      return new Response("cj auth failed", { status: 500, headers: corsHeaders });
    }

    const { data: orders } = await supabase
      .from("orders")
      .select("*")
      .eq("status", "fulfilled")
      .is("tracking_code", null);

    for (const order of orders || []) {
      const trackRes = await fetch(
        `https://developers.cjdropshipping.com/api2.0/v1/logistic/trackInfo?orderId=${order.cj_order_id}`,
        {
          headers: { "CJ-Access-Token": cjToken },
        }
      );
      const trackData = await trackRes.json();
      const tracking = trackData.data?.trackingNumber;
      if (!tracking) continue;

      await supabase
        .from("orders")
        .update({ tracking_code: tracking, status: "shipped" })
        .eq("id", order.id);

      const { data: integration } = await supabase
        .from("ml_integrations")
        .select("access_token")
        .eq("ml_user_id", order.ml_user_id)
        .single();

      if (integration) {
        await fetch(
          `https://api.mercadolivre.com.br/orders/${order.ml_order_id}/shipments`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${integration.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ tracking_number: tracking }),
          }
        );
      }
    }

    return new Response("sync done", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("cj-tracking-sync error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
