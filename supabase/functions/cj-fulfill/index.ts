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
    const { ml_order_id } = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("ml_order_id", ml_order_id)
      .single();

    if (!order) {
      return new Response("order not found", { status: 404, headers: corsHeaders });
    }

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
      await supabase
        .from("orders")
        .update({ status: "cj_error", fulfillment_error: "auth failed" })
        .eq("ml_order_id", ml_order_id);
      return new Response("cj auth failed", { status: 500, headers: corsHeaders });
    }

    const raw = order.raw ?? {};
    const item = raw.order_items?.[0];
    const shipping = raw.shipping;

    const fulfillRes = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrder",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "CJ-Access-Token": cjToken },
        body: JSON.stringify({
          orderNumber: ml_order_id,
          shippingZip: shipping?.receiver_address?.zip_code,
          shippingCountryCode: "BR",
          shippingPhone: shipping?.receiver_address?.phone?.number || "00000000000",
          shippingCustomerName: raw.buyer?.nickname || "Cliente",
          shippingAddress:
            shipping?.receiver_address?.street_name + " " + shipping?.receiver_address?.street_number,
          shippingCity: shipping?.receiver_address?.city?.name,
          shippingProvince: shipping?.receiver_address?.state?.name,
          products: [
            {
              vid: item?.item?.seller_sku,
              quantity: item?.quantity,
            },
          ],
        }),
      }
    );

    const fulfillData = await fulfillRes.json();

    await supabase
      .from("orders")
      .update({
        cj_order_id: fulfillData.data?.orderId,
        status: fulfillData.result ? "fulfilled" : "cj_error",
        fulfillment_status: fulfillData.result ? "fulfilled" : "error",
        fulfillment_error: fulfillData.result ? null : JSON.stringify(fulfillData),
        fulfilled_at: fulfillData.result ? new Date().toISOString() : null,
      })
      .eq("ml_order_id", ml_order_id);

    return new Response(JSON.stringify(fulfillData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cj-fulfill error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
