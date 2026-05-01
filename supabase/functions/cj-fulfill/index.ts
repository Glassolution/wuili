import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function getDbClient() {
  const url = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function checkInternalSecret(req: Request): Response | null {
  const expected = Deno.env.get("INTERNAL_SECRET");
  if (!expected) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (req.headers.get("x-internal-secret") !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denied = checkInternalSecret(req);
  if (denied) return denied;

  try {
    const { ml_order_id } = await req.json();
    const supabase = getDbClient();
    const functionsUrl = Deno.env.get("SUPABASE_URL")!;
    const localServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalSecret = Deno.env.get("INTERNAL_SECRET")!;

    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("ml_order_id", ml_order_id)
      .single();

    if (!order) {
      return new Response("order not found", { status: 404, headers: corsHeaders });
    }

    // Get CJ token via cj-auth (internal call)
    const authRes = await fetch(`${functionsUrl}/functions/v1/cj-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": internalSecret,
        Authorization: `Bearer ${localServiceKey}`,
      },
    });
    const authData = await authRes.json();
    const cjToken = authData?.accessToken;

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
