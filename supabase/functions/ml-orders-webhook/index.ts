/**
 * ml-orders-webhook
 * -----------------
 * Receives ML order notifications (topic: orders_v2).
 * Flow:
 *   1. Parse ML notification → extract orderId + mlUserId
 *   2. Look up the Velo user that owns this ML account
 *   3. Fetch full order details from ML API
 *   4. Map ML item → user_publications to get legacy supplier cost fields
 *   5. INSERT into orders table
 *   6. Stop there. External supplier fulfillment is intentionally disabled.
 *
 * Register this URL in ML via ml-setup-webhook.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

function ok(body: unknown = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function notificationForPublicationStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "paused" || normalized === "inactive" || normalized === "under_review") {
    return { type: "product_paused", title: "Produto pausado", verb: "foi pausado" };
  }
  if (normalized === "active" || normalized === "published") {
    return { type: "product_activated", title: "Produto ativado", verb: "voltou a ficar ativo" };
  }
  return null;
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
  if (error) console.warn("[ml-orders-webhook] falha ao criar notificacao:", error.message);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Hybrid deployment: DB may live on a different project than the functions
  const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
  const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceRoleKey;
  const adminClient    = createClient(dbUrl, dbKey);

  try {
    const body = await req.json().catch(() => null);
    if (!body) return ok(); // ignore malformed payloads

    console.log("[ml-orders-webhook] received:", JSON.stringify(body).substring(0, 400));

    // ML sends topic as "orders_v2"/"orders" or "items"
    const topic: string = body.topic ?? body.type ?? "";

    // ── Roteamento: mudança de status de item ───────────────────────────────
    if (topic.includes("item")) {
      try {
        const resource: string = body.resource ?? "";
        // resource formato: "/items/MLBxxxx"
        const mlItemId =
          resource.replace(/^\/items\//, "").trim() ||
          String(body.data?.id ?? body.id ?? "");
        const mlUserId = String(body.user_id ?? "");

        if (!mlItemId) {
          console.warn("[ml-orders-webhook][items] sem ml_item_id, ignorando");
          return ok();
        }

        // Descobrir dono do item via user_publications
        const { data: pubRow } = await adminClient
          .from("user_publications")
          .select("id, user_id, status, title")
          .eq("ml_item_id", mlItemId)
          .maybeSingle();

        if (!pubRow) {
          console.warn("[ml-orders-webhook][items] publicação não encontrada:", mlItemId);
          return ok();
        }

        // Pegar token válido do usuário
        const { data: integ } = await adminClient
          .from("user_integrations")
          .select("access_token, refresh_token, expires_at")
          .eq("user_id", pubRow.user_id)
          .eq("platform", "mercadolivre")
          .maybeSingle();

        if (!integ?.access_token) {
          console.warn("[ml-orders-webhook][items] sem token para user:", pubRow.user_id);
          return ok();
        }

        let token = integ.access_token as string;
        const expiresAt = integ.expires_at ? new Date(integ.expires_at as string) : new Date(0);
        if (expiresAt <= new Date(Date.now() + 60_000)) {
          const rr = await fetch("https://api.mercadolibre.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              grant_type: "refresh_token",
              client_id: Deno.env.get("ML_CLIENT_ID")!,
              client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
              refresh_token: (integ.refresh_token as string) ?? "",
            }),
          });
          const rd = await rr.json().catch(() => ({}));
          if (rd.access_token) {
            token = rd.access_token;
            await adminClient
              .from("user_integrations")
              .update({
                access_token: rd.access_token,
                refresh_token: rd.refresh_token ?? integ.refresh_token,
                expires_at: new Date(Date.now() + (rd.expires_in ?? 21600) * 1000).toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", pubRow.user_id)
              .eq("platform", "mercadolivre");
          }
        }

        const itemRes = await fetch(
          `https://api.mercadolibre.com/items/${mlItemId}?attributes=id,status`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!itemRes.ok) {
          console.warn("[ml-orders-webhook][items] GET item falhou:", itemRes.status);
          return ok();
        }
        const cur = await itemRes.json();
        const newStatus = String(cur?.status ?? "").trim();

        if (newStatus && newStatus !== pubRow.status && pubRow.status !== "archived_duplicate") {
          const { error: updateError } = await adminClient
            .from("user_publications")
            .update({ status: newStatus, updated_at: new Date().toISOString() })
            .eq("id", pubRow.id);
          const notification = !updateError ? notificationForPublicationStatus(newStatus) : null;
          if (updateError) {
            console.warn("[ml-orders-webhook][items] falha ao atualizar publicacao:", updateError.message);
          } else if (notification) {
            const productTitle = String(pubRow.title || mlItemId).trim();
            await notifyUser(adminClient, {
              user_id: pubRow.user_id,
              type: notification.type,
              title: notification.title,
              message: `${productTitle} ${notification.verb}.`,
              action_url: "/dashboard/publicacoes",
              metadata: {
                publication_id: pubRow.id,
                ml_item_id: mlItemId,
                previous_status: pubRow.status,
                current_status: newStatus,
              },
            });
          }
          console.log(
            `[ml-orders-webhook][items] ${mlItemId}: ${pubRow.status} -> ${newStatus}`,
          );
        }
        return ok({ topic: "items", ml_item_id: mlItemId, new_status: newStatus });
      } catch (e) {
        console.error("[ml-orders-webhook][items] erro:", (e as Error).message);
        return ok(); // sempre 200 pro ML não retentar infinitamente
      }
    }

    if (!topic.includes("order")) {
      return ok(); // silently acknowledge other topics
    }

    // resource is "/orders/123456789"
    const resource: string = body.resource ?? "";
    const mlOrderId = resource.replace(/^\/orders\//, "").trim();
    const mlUserId  = String(body.user_id ?? "");

    if (!mlOrderId || !mlUserId) {
      console.warn("[ml-orders-webhook] missing orderId or userId, skipping");
      return ok();
    }

    // ── 1. Find Velo user that owns this ML account ────────────────────────
    const { data: integration } = await adminClient
      .from("user_integrations")
      .select("user_id, access_token, refresh_token, expires_at")
      .eq("platform", "mercadolivre")
      .eq("ml_user_id", mlUserId)
      .maybeSingle();

    if (!integration) {
      console.warn("[ml-orders-webhook] no integration found for ml_user_id:", mlUserId);
      return ok(); // not a Velo user, ignore
    }

    let accessToken: string = integration.access_token;

    // Refresh token if expired
    if (new Date(integration.expires_at) <= new Date()) {
      const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type:    "refresh_token",
          client_id:     Deno.env.get("ML_CLIENT_ID")!,
          client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
          refresh_token: integration.refresh_token,
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        accessToken = refreshData.access_token;
        await adminClient.from("user_integrations").update({
          access_token:  refreshData.access_token,
          refresh_token: refreshData.refresh_token ?? integration.refresh_token,
          expires_at:    new Date(Date.now() + (refreshData.expires_in ?? 21600) * 1000).toISOString(),
          updated_at:    new Date().toISOString(),
        }).eq("user_id", integration.user_id).eq("platform", "mercadolivre");
      }
    }

    // ── 2. Fetch full order from ML API ────────────────────────────────────
    const orderRes = await fetch(`https://api.mercadolibre.com/orders/${mlOrderId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!orderRes.ok) {
      console.error("[ml-orders-webhook] failed to fetch ML order:", mlOrderId, orderRes.status);
      return ok(); // acknowledge to avoid ML retrying; we'll miss this one
    }

    const mlOrder = await orderRes.json();
    console.log("[ml-orders-webhook] order status:", mlOrder.status, "id:", mlOrder.id);

    // Only process paid orders
    if (mlOrder.status !== "paid" && mlOrder.payment?.status !== "approved") {
      console.log("[ml-orders-webhook] order not paid yet, skipping");
      return ok();
    }

    // ── 3. Check if we already processed this order (idempotency) ──────────
    const { data: existing } = await adminClient
      .from("orders")
      .select("id")
      .eq("external_order_id", String(mlOrderId))
      .maybeSingle();

    if (existing) {
      console.log("[ml-orders-webhook] order already exists:", existing.id);
      return ok({ already_processed: true, order_id: existing.id });
    }

    // ── 4. Extract order details ───────────────────────────────────────────
    const item      = mlOrder.order_items?.[0];
    const mlItemId  = item?.item?.id as string | undefined;
    const buyer     = mlOrder.buyer ?? {};
    const shipping  = mlOrder.shipping ?? {};
    const shipmentId = shipping.id ? String(shipping.id) : null;

    // ── 4b. Fetch full shipment details for complete receiver_address ─────
    // The order payload's shipping.receiver_address is often partial (no
    // complement, sometimes no phone). /shipments/{id} returns the full one.
    let shipmentAddr: Record<string, any> = shipping.receiver_address ?? {};
    let shipmentReceiverName: string | null = null;
    let shipmentReceiverPhone: string | null = null;

    if (shipmentId) {
      try {
        const shipRes = await fetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (shipRes.ok) {
          const shipData = await shipRes.json();
          if (shipData?.receiver_address) {
            shipmentAddr = { ...shipmentAddr, ...shipData.receiver_address };
          }
          shipmentReceiverName = shipData?.receiver_address?.receiver_name
            ?? shipData?.destination?.receiver_name
            ?? null;
          shipmentReceiverPhone = shipData?.receiver_address?.receiver_phone
            ?? shipData?.destination?.receiver_phone
            ?? null;
        } else {
          console.warn("[ml-orders-webhook] shipment fetch failed:", shipRes.status);
        }
      } catch (e) {
        console.warn("[ml-orders-webhook] shipment fetch error:", (e as Error).message);
      }
    }

    const addr = shipmentAddr;

    const buyerName    = shipmentReceiverName ?? buyer.nickname ?? buyer.first_name ?? "Comprador";
    const buyerEmail   = buyer.email ?? "";
    const buyerPhone   = shipmentReceiverPhone
      ?? buyer.phone?.number
      ?? buyer.alternative_phone?.number
      ?? "";
    const streetName   = addr.street_name   ?? "";
    const streetNumber = addr.street_number ?? "";
    const buyerAddress = [streetName, streetNumber].filter(Boolean).join(", ");
    const buyerComplement   = addr.comment ?? addr.complement ?? addr.between_streets ?? "";
    const buyerNeighborhood = addr.neighborhood?.name ?? "";
    const buyerCity    = addr.city?.name    ?? "";
    const buyerState   = addr.state?.name   ?? "";
    const buyerZip     = addr.zip_code      ?? "";

    // ── 5. Look up publication cost metadata + catalog product link ───────
    let legacyVariantId:  string | null = null;
    let legacyProductId:  string | null = null;
    let legacyProductUrl: string | null = null;
    let costPrice:    number | null = null;
    let catalogProductId: string | null = null;
    let supplierUrl: string | null = null;

    if (mlItemId) {
      const { data: pub } = await adminClient
        .from("user_publications")
        .select("cj_variant_id, cj_product_id, cj_product_url, cost_price, catalog_product_id")
        .eq("ml_item_id", mlItemId)
        .eq("user_id", integration.user_id)
        .maybeSingle();

      if (pub) {
        legacyVariantId = pub.cj_variant_id ?? null;
        legacyProductId = pub.cj_product_id ?? null;
        legacyProductUrl = pub.cj_product_url ?? null;
        costPrice   = pub.cost_price    ?? null;
        catalogProductId = pub.catalog_product_id ?? null;
      }
    }

    if (catalogProductId) {
      const { data: cp } = await adminClient
        .from("catalog_products")
        .select("product_url")
        .eq("id", catalogProductId)
        .maybeSingle();
      supplierUrl = cp?.product_url ?? legacyProductUrl;
    } else {
      supplierUrl = legacyProductUrl;
    }

    const parsedQuantity = Number(item?.quantity ?? 1);
    const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
    const itemUnitPrice = Number(item?.unit_price ?? 0);
    const mlTotalAmount = Number(mlOrder.total_amount ?? 0);
    const fallbackTotalAmount = Number.isFinite(itemUnitPrice) && itemUnitPrice > 0
      ? itemUnitPrice * quantity
      : 0;
    const totalAmount = Number.isFinite(mlTotalAmount) && mlTotalAmount > 0
      ? mlTotalAmount
      : fallbackTotalAmount;
    const salePrice = Number.isFinite(itemUnitPrice) && itemUnitPrice > 0
      ? itemUnitPrice
      : totalAmount / quantity;
    const profit    = costPrice !== null ? salePrice - costPrice : null;
    let orderStatus = "paid";
    let fulfillmentStatus = legacyVariantId ? "manual_review" : "no_supplier_metadata";
    let fulfillmentError: string | null = null;

    // ── 6. INSERT order ────────────────────────────────────────────────────
    const { data: newOrder, error: insertError } = await adminClient
      .from("orders")
      .insert({
        user_id:             integration.user_id,
        external_order_id:   String(mlOrderId),
        ml_order_id:         String(mlOrderId),
        ml_user_id:          String(mlUserId),
        shipment_id:         shipmentId,
        platform:            "mercadolivre",
        product_title:       item?.item?.title ?? "Produto ML",
        product_image:       null,
        buyer_name:          buyerName,
        buyer_email:         buyerEmail      || null,
        buyer_address:       buyerAddress   || null,
        buyer_number:        streetNumber    || null,
        buyer_complement:    buyerComplement || null,
        buyer_neighborhood:  buyerNeighborhood || null,
        buyer_city:          buyerCity       || null,
        buyer_state:         buyerState      || null,
        buyer_zip:           buyerZip        || null,
        buyer_phone:         buyerPhone      || null,
        sale_price:          salePrice,
        total_amount:        totalAmount,
        cost_price:          costPrice,
        profit,
        quantity,
        catalog_product_id:  catalogProductId,
        supplier_url:        supplierUrl,
        cj_product_id:       legacyProductId,
        cj_product_url:      legacyProductUrl,
        cj_variant_id:       legacyVariantId,
        status:              orderStatus,
        fulfillment_status:  fulfillmentStatus,
        fulfillment_error:   fulfillmentError,
        ordered_at:          mlOrder.date_created ?? new Date().toISOString(),
        raw:                 mlOrder,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[ml-orders-webhook] insert error:", insertError.message);
      return err("Erro ao salvar pedido: " + insertError.message);
    }

    const internalOrderId = newOrder.id as string;
    console.log("[ml-orders-webhook] order saved:", internalOrderId);

    await notifyUser(adminClient, {
      user_id: integration.user_id,
      type: "new_sale",
      title: "Nova venda",
      message: `${item?.item?.title ?? "Produto Mercado Livre"} vendido por ${totalAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
      action_url: "/dashboard/pedidos",
      metadata: {
        order_id: internalOrderId,
        ml_order_id: String(mlOrderId),
        product_title: item?.item?.title ?? null,
        total_amount: totalAmount,
      },
    });

    console.log("[ml-orders-webhook] fulfillment intentionally disabled for:", internalOrderId);

    return ok({ success: true, order_id: internalOrderId });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[ml-orders-webhook] unhandled error:", message);
    // Always return 200 to avoid ML retrying forever
    return ok({ error: message });
  }
});
