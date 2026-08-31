import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { dispatchOrderToBot } from "../_shared/c7dropBotDispatch.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

async function notifyUser(
  client: ReturnType<typeof createClient>,
  row: {
    user_id: string;
    type: string;
    title: string;
    message: string;
    action_url?: string;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await client.from("notifications").insert({
    user_id: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    action_url: row.action_url ?? null,
    metadata: row.metadata ?? {},
  });
  if (error) console.warn("[ml-sync-orders] falha ao criar notificacao:", error.message);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceRoleKey;
    const adminClient = createClient(dbUrl, dbKey);

    // Identify user via JWT
    const supabaseClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = user.id;

    // Fetch user integrations
    const { data: integration, error: integrationError } = await adminClient
      .from("user_integrations")
      .select("*")
      .eq("user_id", userId)
      .eq("platform", "mercadolivre")
      .maybeSingle();

    if (integrationError) {
      throw integrationError;
    }

    if (!integration || !integration.access_token) {
      return new Response(JSON.stringify({ error: "Mercado Livre account not connected" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let accessToken = integration.access_token;
    const mlUserId = integration.ml_user_id;

    // Refresh token if expired
    const expiresAt = new Date(integration.expires_at);
    if (expiresAt <= new Date()) {
      console.log("[ml-sync-orders] Token expired, refreshing...");
      const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: Deno.env.get("ML_CLIENT_ID")!,
          client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
          refresh_token: integration.refresh_token,
        }),
      });

      const refreshData = await refreshRes.json();
      if (!refreshRes.ok || !refreshData.access_token) {
        console.error("[ml-sync-orders] Token refresh failed:", JSON.stringify(refreshData));
        return new Response(
          JSON.stringify({ error: "Mercado Livre session expired, please reconnect your account" }),
          { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      accessToken = refreshData.access_token;
      await adminClient
        .from("user_integrations")
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token ?? integration.refresh_token,
          expires_at: new Date(Date.now() + (refreshData.expires_in ?? 21600) * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("platform", "mercadolivre");
      
      console.log("[ml-sync-orders] Token refreshed successfully");
    }

    // Fetch last 20 orders from Mercado Livre
    console.log(`[ml-sync-orders] Fetching orders for seller: ${mlUserId}`);
    const searchRes = await fetch(
      `https://api.mercadolibre.com/orders/search?seller=${mlUserId}&limit=20&sort=date_desc`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!searchRes.ok) {
      const errText = await searchRes.text();
      throw new Error(`Failed to fetch orders from ML API: ${searchRes.status} ${errText}`);
    }

    const searchData = await searchRes.json();
    const mlOrders = searchData.results ?? [];
    console.log(`[ml-sync-orders] Found ${mlOrders.length} orders on Mercado Livre`);

    let newOrdersCount = 0;
    const syncedOrders = [];

    for (const mlOrder of mlOrders) {
      const mlOrderId = String(mlOrder.id);

      // Check if already synchronized
      const { data: existing } = await adminClient
        .from("orders")
        .select("id, status, tracking_code")
        .eq("external_order_id", mlOrderId)
        .maybeSingle();

      // Fetch full order for complete details (needed for both insert and status update)
      const orderRes = await fetch(`https://api.mercadolibre.com/orders/${mlOrderId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!orderRes.ok) {
        console.warn(`[ml-sync-orders] Failed to fetch details for order ${mlOrderId}`);
        continue;
      }
      const fullOrder = await orderRes.json();

      // Derive normalized status considering refunds/cancellations
      const rawStatus = String(fullOrder.status ?? "").toLowerCase();
      const hasRefund = Array.isArray(fullOrder.payments)
        && fullOrder.payments.some((p: any) => {
          const s = String(p?.status ?? "").toLowerCase();
          return s === "refunded" || s === "charged_back" || Number(p?.transaction_amount_refunded ?? 0) > 0;
        });
      let normalizedStatus: string;
      if (hasRefund) normalizedStatus = "refunded";
      else if (rawStatus === "paid") normalizedStatus = "paid";
      else if (rawStatus === "cancelled") normalizedStatus = "cancelled";
      else normalizedStatus = "pending";

      const item = fullOrder.order_items?.[0];
      const mlItemId = item?.item?.id as string | undefined;
      const buyer = fullOrder.buyer ?? {};
      let shipping = fullOrder.shipping ?? {};

      // Fetch full shipment details — /orders/{id} only returns a shipping id,
      // the real receiver_address + receiver phone live at /shipments/{id}
      const shipmentId = shipping?.id ?? fullOrder.shipping?.id;
      if (shipmentId) {
        try {
          const shipRes = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (shipRes.ok) {
            const shipData = await shipRes.json();
            shipping = { ...shipping, ...shipData };
          } else {
            console.warn(`[ml-sync-orders] Failed to fetch shipment ${shipmentId}: ${shipRes.status}`);
          }
        } catch (e) {
          console.warn(`[ml-sync-orders] Shipment fetch error for ${shipmentId}:`, (e as Error).message);
        }
      }
      const addr = shipping.receiver_address ?? {};

      const fullBuyerName = [buyer.first_name, buyer.last_name].filter(Boolean).join(" ").trim();
      const buyerName = addr.receiver_name || fullBuyerName || buyer.nickname || "Comprador";
      const buyerEmail = buyer.email ?? "";
      const buyerPhone = addr.receiver_phone
        ?? (buyer.phone?.area_code && buyer.phone?.number ? `(${buyer.phone.area_code}) ${buyer.phone.number}` : buyer.phone?.number)
        ?? buyer.alternative_phone?.number
        ?? "";
      const streetName = addr.street_name ?? "";
      const streetNumber = addr.street_number ?? "";
      const buyerAddress = [streetName, streetNumber].filter(Boolean).join(", ");
      const buyerNeighborhood = addr.neighborhood?.name ?? "";
      const buyerCity = addr.city?.name ?? "";
      const buyerState = addr.state?.name ?? addr.state?.id ?? "";
      const buyerZip = addr.zip_code ?? "";

      if (existing) {
        const trackingCode = shipping?.tracking_number ?? null;
        const updatePayload: Record<string, unknown> = {
          status: normalizedStatus,
          tracking_code: trackingCode,
          raw: { ...fullOrder, shipping },
          updated_at: new Date().toISOString(),
        };
        // Backfill buyer/shipping fields when we now have them
        if (buyerName && buyerName !== "Comprador") updatePayload.buyer_name = buyerName;
        if (buyerPhone) updatePayload.buyer_phone = buyerPhone;
        if (buyerEmail) updatePayload.buyer_email = buyerEmail;
        if (buyerAddress) updatePayload.buyer_address = buyerAddress;
        if (streetNumber) updatePayload.buyer_number = streetNumber;
        if (buyerNeighborhood) updatePayload.buyer_neighborhood = buyerNeighborhood;
        if (buyerCity) updatePayload.buyer_city = buyerCity;
        if (buyerState) updatePayload.buyer_state = buyerState;
        if (buyerZip) updatePayload.buyer_zip = buyerZip;

        const { error: updErr } = await adminClient
          .from("orders")
          .update(updatePayload)
          .eq("id", existing.id);
        if (updErr) {
          console.error(`[ml-sync-orders] Error updating order ${mlOrderId}:`, updErr.message);
        } else if (existing.status !== normalizedStatus) {
          console.log(`[ml-sync-orders] Order ${mlOrderId} status: ${existing.status} → ${normalizedStatus}`);
        }
        if (!updErr && trackingCode && trackingCode !== existing.tracking_code) {
          await notifyUser(adminClient, {
            user_id: userId,
            type: "order_in_transit",
            title: "Pedido em trânsito",
            message: `${item?.item?.title ?? "Pedido Mercado Livre"} recebeu rastreio ${trackingCode}.`,
            action_url: "/dashboard/pedidos",
            metadata: {
              order_id: existing.id,
              ml_order_id: mlOrderId,
              tracking_code: trackingCode,
              event: "order_in_transit",
            },
          });
        }
        continue;
      }

      // Lookup user_publications mapping + catalog product supplier
      let cjVariantId: string | null = null;
      let cjProductId: string | null = null;
      let cjProductUrl: string | null = null;
      let costPrice: number | null = null;
      let catalogProductId: string | null = null;
      let supplierUrl: string | null = null;

      if (mlItemId) {
        const { data: pub } = await adminClient
          .from("user_publications")
          .select("cj_variant_id, cj_product_id, cj_product_url, cost_price, catalog_product_id")
          .eq("ml_item_id", mlItemId)
          .eq("user_id", userId)
          .maybeSingle();

        if (pub) {
          cjVariantId = pub.cj_variant_id ?? null;
          cjProductId = pub.cj_product_id ?? null;
          cjProductUrl = pub.cj_product_url ?? null;
          costPrice = pub.cost_price ?? null;
          catalogProductId = pub.catalog_product_id ?? null;

          if (catalogProductId) {
            // catalog_product_id in user_publications may be a UUID or the external slug
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catalogProductId);
            const { data: cp } = await adminClient
              .from("catalog_products")
              .select("id, product_url")
              .or(isUuid ? `id.eq.${catalogProductId}` : `external_id.eq.${catalogProductId}`)
              .maybeSingle();
            if (cp) {
              supplierUrl = cp.product_url ?? cjProductUrl ?? null;
              catalogProductId = cp.id; // normalize to UUID for FK
            }
          }

          if (!supplierUrl && cjProductUrl) supplierUrl = cjProductUrl;
        }
      }

      const salePrice = Number(item?.unit_price ?? 0) * Number(item?.quantity ?? 1);
      const profit = costPrice ? salePrice - costPrice : null;

      // Insert new order
      const { data: newOrder, error: insertError } = await adminClient
        .from("orders")
        .insert({
          user_id: userId,
          external_order_id: mlOrderId,
          ml_order_id: mlOrderId,
          platform: "mercadolivre",
          product_title: item?.item?.title ?? "Produto Mercado Livre",
          product_image: item?.item?.thumbnail_url ?? null,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          buyer_address: buyerAddress,
          buyer_number: streetNumber,
          buyer_neighborhood: buyerNeighborhood,
          buyer_city: buyerCity,
          buyer_state: buyerState,
          buyer_zip: buyerZip,
          sale_price: salePrice,
          total_amount: salePrice,
          quantity: Number(item?.quantity ?? 1),
          cost_price: costPrice,
          profit: profit,
          status: normalizedStatus,
          tracking_code: fullOrder.shipping?.tracking_number ?? null,
          ordered_at: fullOrder.date_created,
          catalog_product_id: catalogProductId,
          supplier_url: supplierUrl,
          raw: fullOrder,
        })
        .select()
        .single();

      if (insertError) {
        console.error(`[ml-sync-orders] Error inserting order ${mlOrderId}:`, insertError.message);
      } else {
        newOrdersCount++;
        syncedOrders.push(newOrder);
        try {
          await dispatchOrderToBot(adminClient, {
            orderId: newOrder.id,
            mlOrderId,
            userId,
            mlOrder: fullOrder,
            precoMl: salePrice,
          });
        } catch (e) {
          console.warn(`[ml-sync-orders] envio ao bot falhou para ${mlOrderId}:`, (e as Error).message);
        }
        await notifyUser(adminClient, {
          user_id: userId,
          type: "new_sale",
          title: "Nova venda",
          message: `${item?.item?.title ?? "Produto Mercado Livre"} vendido por ${formatBRL(salePrice)}.`,
          action_url: "/dashboard/pedidos",
          metadata: {
            order_id: newOrder.id,
            ml_order_id: mlOrderId,
            product_title: item?.item?.title ?? null,
            total_amount: salePrice,
          },
        });
      }

    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sincronização concluída. ${newOrdersCount} novos pedidos inseridos.`,
        synced_count: newOrdersCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("[ml-sync-orders] Fatal error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
