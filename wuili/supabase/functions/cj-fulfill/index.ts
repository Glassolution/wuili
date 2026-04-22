import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FulfillRequest = {
  order_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Método não permitido" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id }: FulfillRequest = await req.json();
    if (!order_id) {
      return new Response(JSON.stringify({ success: false, error: "order_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cjAccessToken = Deno.env.get("CJ_ACCESS_TOKEN");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados");
    }
    if (!cjAccessToken) {
      throw new Error("CJ_ACCESS_TOKEN não configurado");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("*")
      .eq("id", order_id)
      .maybeSingle();

    if (orderError || !order) {
      const message = orderError?.message ?? "Pedido não encontrado";
      await adminClient
        .from("orders")
        .update({ fulfillment_status: "error", fulfillment_error: message })
        .eq("id", order_id);

      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!order.cj_variant_id) {
      const message = "Pedido sem cj_variant_id";
      await adminClient
        .from("orders")
        .update({ fulfillment_status: "error", fulfillment_error: message })
        .eq("id", order_id);

      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cjPayload = {
      orderNumber: order.id,
      shippingZip: order.buyer_zip ?? "",
      shippingCountry: "BR",
      shippingAddress: order.buyer_address ?? "",
      shippingCity: order.buyer_city ?? "",
      shippingProvince: order.buyer_state ?? "",
      shippingCustomerName: order.buyer_name ?? "",
      shippingPhone: order.buyer_phone ?? "",
      products: [
        {
          vid: order.cj_variant_id,
          quantity: 1,
        },
      ],
    };

    const cjRes = await fetch("https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cjAccessToken}`,
      },
      body: JSON.stringify(cjPayload),
    });

    const cjJson = await cjRes.json().catch(() => null);
    const cjOrderId = cjJson?.data?.orderId ?? cjJson?.orderId ?? null;

    if (!cjRes.ok || !cjOrderId) {
      const message =
        cjJson?.message ??
        cjJson?.msg ??
        `Erro CJ (${cjRes.status})`;

      await adminClient
        .from("orders")
        .update({
          fulfillment_status: "error",
          fulfillment_error: message,
        })
        .eq("id", order_id);

      return new Response(JSON.stringify({ success: false, error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await adminClient
      .from("orders")
      .update({
        cj_order_id: String(cjOrderId),
        status: "processing",
        fulfillment_status: "processing",
        fulfillment_error: null,
        fulfilled_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true, cj_order_id: String(cjOrderId) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    console.error("cj-fulfill error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
