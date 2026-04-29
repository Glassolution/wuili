/**
 * ml-orders-webhook
 * -----------------
 * Receives ML order notifications (topic: orders_v2).
 * Flow:
 *   1. Parse ML notification → extract orderId + mlUserId
 *   2. Look up the Velo user that owns this ML account
 *   3. Fetch full order details from ML API
 *   4. Map ML item → user_publications to get cj_variant_id
 *   5. INSERT into orders table
 *   6. If order.status === 'paid', invoke cj-fulfill automatically
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

function extractBalance(payload: unknown): number {
  const raw = payload as any;
  const data = raw?.data ?? raw;
  const candidates = [
    data?.balance,
    data?.availableBalance,
    data?.available_balance,
    data?.amount,
    data?.walletBalance,
    data?.accountBalance,
    Array.isArray(data) ? data[0]?.balance : undefined,
    Array.isArray(data) ? data[0]?.availableBalance : undefined,
  ];

  for (const value of candidates) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

async function getCjAccessToken(supabaseUrl: string, serviceRoleKey: string): Promise<string | null> {
  const authRes = await fetch(`${supabaseUrl}/functions/v1/cj-auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
  });
  const authData = await authRes.json().catch(() => ({}));
  return authData?.accessToken ?? null;
}

async function getCjBalance(cjAccessToken: string): Promise<number> {
  const balanceRes = await fetch(
    "https://developers.cjdropshipping.com/api2.0/v1/account/balance",
    { headers: { "CJ-Access-Token": cjAccessToken } }
  );
  const balanceData = await balanceRes.json().catch(() => null);

  if (!balanceRes.ok) {
    throw new Error(balanceData?.message ?? balanceData?.msg ?? `Erro ao consultar saldo CJ (${balanceRes.status})`);
  }

  return extractBalance(balanceData);
}

async function createLowBalanceNotification(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  orderId: string,
  required: number,
  available: number
): Promise<void> {
  try {
    await (adminClient as any).from("notifications").insert({
      user_id: userId,
      title: "Saldo insuficiente na CJ",
      message: "Você tem um pedido aguardando envio. Recarregue sua conta na CJ Dropshipping para processar automaticamente.",
      action_url: "https://cjdropshipping.com/wallet.html",
      type: "warning",
      read: false,
      metadata: { order_id: orderId, required, available },
    });
  } catch (e) {
    console.error("[ml-orders-webhook] createLowBalanceNotification error:", e);
  }
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

    // ML sends topic as "orders_v2" or "orders"; ignore everything else
    const topic: string = body.topic ?? body.type ?? "";
    if (!topic.includes("order")) {
      return ok(); // silently acknowledge non-order topics
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
    const addr      = shipping.receiver_address ?? {};

    const buyerName    = buyer.nickname ?? buyer.first_name ?? "Comprador";
    const buyerEmail   = buyer.email ?? "";
    const buyerPhone   = buyer.phone?.number ?? buyer.alternative_phone?.number ?? "";
    const streetName   = addr.street_name   ?? "";
    const streetNumber = addr.street_number ?? "";
    const buyerAddress = [streetName, streetNumber].filter(Boolean).join(", ");
    const buyerNeighborhood = addr.neighborhood?.name ?? "";
    const buyerCity    = addr.city?.name    ?? "";
    const buyerState   = addr.state?.name   ?? "";
    const buyerZip     = addr.zip_code      ?? "";

    // ── 5. Look up publication to get cj_variant_id + cost_price ──────────
    let cjVariantId:  string | null = null;
    let cjProductId:  string | null = null;
    let cjProductUrl: string | null = null;
    let costPrice:    number | null = null;

    if (mlItemId) {
      const { data: pub } = await adminClient
        .from("user_publications")
        .select("cj_variant_id, cj_product_id, cj_product_url, cost_price")
        .eq("ml_item_id", mlItemId)
        .eq("user_id", integration.user_id)
        .maybeSingle();

      if (pub) {
        cjVariantId = pub.cj_variant_id ?? null;
        cjProductId = pub.cj_product_id ?? null;
        cjProductUrl = pub.cj_product_url ?? (
          cjProductId ? `https://www.cjdropshipping.com/product-detail.html?id=${cjProductId}` : null
        );
        costPrice   = pub.cost_price    ?? null;
      }
    }

    const salePrice = Number(mlOrder.total_amount ?? item?.unit_price ?? 0);
    const profit    = costPrice !== null ? salePrice - costPrice : null;
    let orderStatus = "paid";
    let fulfillmentStatus = cjVariantId ? "pending" : "no_variant";
    let fulfillmentError: string | null = null;
    let shouldTriggerFulfillment = Boolean(cjVariantId);
    let balanceCheck: { required: number; available: number } | null = null;

    if (cjVariantId && Number(costPrice ?? 0) > 0) {
      try {
        const cjToken = await getCjAccessToken(supabaseUrl, serviceRoleKey);
        if (cjToken) {
          const availableBalance = await getCjBalance(cjToken);
          const requiredBalance = Number(costPrice ?? 0);

          if (availableBalance < requiredBalance) {
            orderStatus = "awaiting_payment";
            fulfillmentStatus = "awaiting_payment";
            fulfillmentError =
              `Saldo CJ insuficiente. Disponível: $${availableBalance.toFixed(2)}. ` +
              `Necessário: $${requiredBalance.toFixed(2)}`;
            shouldTriggerFulfillment = false;
            balanceCheck = { required: requiredBalance, available: availableBalance };
          }
        } else {
          console.warn("[ml-orders-webhook] CJ token unavailable; balance check skipped");
        }
      } catch (balanceErr) {
        console.warn("[ml-orders-webhook] CJ balance check failed; fulfillment will continue:", balanceErr);
      }
    }

    // ── 6. INSERT order ────────────────────────────────────────────────────
    const { data: newOrder, error: insertError } = await adminClient
      .from("orders")
      .insert({
        user_id:             integration.user_id,
        external_order_id:   String(mlOrderId),
        platform:            "mercadolivre",
        product_title:       item?.item?.title ?? "Produto ML",
        product_image:       null,
        buyer_name:          buyerName,
        buyer_email:         buyerEmail      || null,
        buyer_address:       buyerAddress   || null,
        buyer_number:        streetNumber    || null,
        buyer_neighborhood:  buyerNeighborhood || null,
        buyer_city:          buyerCity       || null,
        buyer_state:         buyerState      || null,
        buyer_zip:           buyerZip        || null,
        buyer_phone:         buyerPhone      || null,
        sale_price:          salePrice,
        cost_price:          costPrice,
        profit,
        cj_product_id:       cjProductId,
        cj_product_url:      cjProductUrl,
        cj_variant_id:       cjVariantId,
        status:              orderStatus,
        fulfillment_status:  fulfillmentStatus,
        fulfillment_error:   fulfillmentError,
        ordered_at:          mlOrder.date_created ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[ml-orders-webhook] insert error:", insertError.message);
      return err("Erro ao salvar pedido: " + insertError.message);
    }

    const internalOrderId = newOrder.id as string;
    console.log("[ml-orders-webhook] order saved:", internalOrderId);

    if (balanceCheck) {
      await createLowBalanceNotification(
        adminClient,
        integration.user_id,
        internalOrderId,
        balanceCheck.required,
        balanceCheck.available
      );
    }

    // ── 7. Trigger CJ fulfillment if we have a variant ────────────────────
    if (shouldTriggerFulfillment && internalOrderId) {
      console.log("[ml-orders-webhook] triggering cj-fulfill for:", internalOrderId);
      // Fire-and-forget — don't await so ML gets a fast 200 response
      fetch(`${supabaseUrl}/functions/v1/cj-fulfill`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ order_id: internalOrderId }),
      }).catch((e) => console.error("[ml-orders-webhook] cj-fulfill invoke error:", e));
    } else {
      console.warn("[ml-orders-webhook] no cj_variant_id — fulfillment skipped for:", internalOrderId);
    }

    return ok({ success: true, order_id: internalOrderId });

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[ml-orders-webhook] unhandled error:", message);
    // Always return 200 to avoid ML retrying forever
    return ok({ error: message });
  }
});
