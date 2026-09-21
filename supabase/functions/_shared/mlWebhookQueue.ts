/**
 * mlWebhookQueue
 * --------------
 * Shared fast-ack queue for Mercado Livre notifications.
 *
 *  - `shouldDiscard()` / `enqueue()` run in the webhook critical path.
 *    They must stay under a few dozen milliseconds (ML requires HTTP 200
 *    within 500ms, otherwise the topic is disabled by fall back).
 *  - `processQueue()` runs OUT of the critical path (cron / waitUntil) and
 *    holds the real logic that used to live inside the webhook: lookups in
 *    user_publications, token refresh, GET /items, GET /orders, insert order.
 */

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { mlFetch } from "./mlClient.ts";
import { dispatchOrderToBot, retryShippingLabel } from "./c7dropBotDispatch.ts";


export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

export function adminClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Hybrid deployment: DB may live on a different project than the functions
  const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
  const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceRoleKey;
  return createClient(dbUrl, dbKey, { auth: { persistSession: false } });
}

// ── Dedupe cache: ml_item_ids we own ──────────────────────────────────────
// Refreshed at most once every 5 minutes per isolate. Used only to DISCARD
// `items` notifications for items that are certainly not ours.
let knownItemIds: Set<string> | null = null;
let knownItemIdsAt = 0;
const KNOWN_TTL_MS = 5 * 60_000;

export async function refreshKnownItemIds(supabase: SupabaseClient): Promise<Set<string> | null> {
  const { data, error } = await supabase
    .from("user_publications")
    .select("ml_item_id")
    .not("ml_item_id", "is", null)
    .limit(50_000);
  if (error) return null;
  knownItemIds = new Set((data ?? []).map((r: { ml_item_id: string }) => r.ml_item_id));
  knownItemIdsAt = Date.now();
  return knownItemIds;
}

/** Non-blocking-ish check: uses cache when warm, refreshes when stale. */
export async function isKnownItem(supabase: SupabaseClient, mlItemId: string): Promise<boolean> {
  if (!knownItemIds || Date.now() - knownItemIdsAt > KNOWN_TTL_MS) {
    const refreshed = await refreshKnownItemIds(supabase);
    if (!refreshed) return true; // fail open: enqueue and let the processor decide
  }
  return knownItemIds!.has(mlItemId);
}

export function parseTopic(body: Record<string, unknown>): string {
  return String((body?.topic ?? body?.type ?? "") as string);
}

export function extractItemId(body: Record<string, unknown>): string {
  const resource = String((body?.resource ?? "") as string);
  return (
    resource.replace(/^\/items\//, "").trim() ||
    String((body as { data?: { id?: string }; id?: string })?.data?.id ?? body?.id ?? "")
  );
}

export function extractOrderId(body: Record<string, unknown>): string {
  const resource = String((body?.resource ?? "") as string);
  return resource.replace(/^\/orders\//, "").trim();
}

/** Insert the raw event into the queue. Single round-trip. */
export async function enqueue(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  source: string,
): Promise<{ queued: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from("ml_webhook_queue")
    .insert({
      topic: parseTopic(body) || "unknown",
      resource: (body?.resource as string) ?? null,
      ml_user_id: body?.user_id != null ? String(body.user_id) : null,
      application_id: body?.application_id != null ? String(body.application_id) : null,
      source,
      payload_raw: body,
    })
    .select("id")
    .single();

  if (error) return { queued: false, error: error.message };
  return { queued: true, id: data.id as string };
}

// ─────────────────────────────────────────────────────────────────────────
// Processing (out of the critical path)
// ─────────────────────────────────────────────────────────────────────────

async function getFreshToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: integ } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", "mercadolivre")
    .maybeSingle();
  if (!integ?.access_token) return null;

  const expiresAt = integ.expires_at ? new Date(integ.expires_at as string) : new Date(0);
  if (expiresAt > new Date(Date.now() + 60_000)) return integ.access_token as string;

  const rr = await mlFetch("https://api.mercadolibre.com/oauth/token", {
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
  if (!rr.ok || !rd.access_token) return null;

  await supabase
    .from("user_integrations")
    .update({
      access_token: rd.access_token,
      refresh_token: rd.refresh_token ?? integ.refresh_token,
      expires_at: new Date(Date.now() + (rd.expires_in ?? 21600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", "mercadolivre");

  return rd.access_token as string;
}

async function handleItemsTopic(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<string> {
  const mlItemId = extractItemId(body);
  if (!mlItemId) return "skipped_no_item_id";

  const { data: pubRow } = await supabase
    .from("user_publications")
    .select("id, user_id, status")
    .eq("ml_item_id", mlItemId)
    .maybeSingle();

  if (!pubRow) return "skipped_unknown_item";

  const token = await getFreshToken(supabase, pubRow.user_id as string);
  if (!token) return "skipped_no_token";

  const itemRes = await mlFetch(
    `https://api.mercadolibre.com/items/${mlItemId}?attributes=id,status`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!itemRes.ok) return `ml_get_item_${itemRes.status}`;

  const cur = await itemRes.json();
  const newStatus = String(cur?.status ?? "").trim();

  if (newStatus && newStatus !== pubRow.status && pubRow.status !== "archived_duplicate") {
    await supabase
      .from("user_publications")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", pubRow.id);
    return `status_updated_${newStatus}`;
  }
  return "no_change";
}

async function handleOrdersTopic(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<string> {
  const mlOrderId = extractOrderId(body);
  const mlUserId = String(body?.user_id ?? "");
  if (!mlOrderId || !mlUserId) return "skipped_missing_ids";

  const { data: integration } = await supabase
    .from("user_integrations")
    .select("user_id, access_token, refresh_token, expires_at")
    .eq("platform", "mercadolivre")
    .eq("ml_user_id", mlUserId)
    .maybeSingle();

  if (!integration) return "skipped_no_integration";

  const accessToken = await getFreshToken(supabase, integration.user_id as string);
  if (!accessToken) return "skipped_no_token";

  const orderRes = await mlFetch(`https://api.mercadolibre.com/orders/${mlOrderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!orderRes.ok) return `ml_get_order_${orderRes.status}`;

  const mlOrder = await orderRes.json();

  const normalizedStatus = normalizeMlOrderStatus(mlOrder);

  const { data: existing } = await supabase
    .from("orders")
    .select("id,status,tracking_code")
    .eq("external_order_id", String(mlOrderId))
    .maybeSingle();

  if (normalizedStatus === "cancelled" || normalizedStatus === "refunded") {
    if (existing) {
      await supabase
        .from("orders")
        .update({
          status: normalizedStatus,
          raw: mlOrder,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }

    await markDropshipMlCancellation(supabase, {
      mlOrderId,
      normalizedStatus,
      source: "ml-webhook-queue",
    });

    return existing ? `order_${normalizedStatus}_${existing.id}` : `skipped_${normalizedStatus}_without_local_order`;
  }

  if (mlOrder.status !== "paid" && mlOrder.payment?.status !== "approved") {
    return "skipped_not_paid";
  }

  const item = mlOrder.order_items?.[0];
  const mlItemId = item?.item?.id as string | undefined;
  const buyer = mlOrder.buyer ?? {};
  const shipping = mlOrder.shipping ?? {};
  const shipmentId = shipping.id ? String(shipping.id) : null;

  // Full shipment address (order payload is often partial)
  let shipmentAddr: Record<string, any> = shipping.receiver_address ?? {};
  let shipmentReceiverName: string | null = null;
  let shipmentReceiverPhone: string | null = null;

  if (shipmentId) {
    try {
      const shipRes = await mlFetch(`https://api.mercadolibre.com/shipments/${shipmentId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (shipRes.ok) {
        const shipData = await shipRes.json();
        if (shipData?.receiver_address) {
          shipmentAddr = { ...shipmentAddr, ...shipData.receiver_address };
        }
        shipmentReceiverName = shipData?.receiver_address?.receiver_name
          ?? shipData?.destination?.receiver_name ?? null;
        shipmentReceiverPhone = shipData?.receiver_address?.receiver_phone
          ?? shipData?.destination?.receiver_phone ?? null;
      }
    } catch (e) {
      console.warn("[ml-queue] shipment fetch error:", (e as Error).message);
    }
  }

  if (existing) {
    const labelResolved = await retryShippingLabel(supabase, {
      mlOrderId: String(mlOrderId),
      userId: integration.user_id as string,
      mlOrder: { ...mlOrder, shipping: { ...shipping, receiver_address: shipmentAddr } },
      accessToken,
    });

    await supabase
      .from("orders")
      .update({
        status: normalizedStatus,
        raw: { ...mlOrder, shipping: { ...shipping, receiver_address: shipmentAddr } },
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    return labelResolved
      ? `already_processed_label_resolved_${existing.id}`
      : `already_processed_${existing.id}`;
  }

  const addr = shipmentAddr;
  const fullMlOrder = { ...mlOrder, shipping: { ...shipping, receiver_address: shipmentAddr } };
  const buyerName = shipmentReceiverName ?? buyer.nickname ?? buyer.first_name ?? "Comprador";
  const buyerEmail = buyer.email ?? "";
  const buyerPhone = shipmentReceiverPhone ?? buyer.phone?.number
    ?? buyer.alternative_phone?.number ?? "";
  const streetName = addr.street_name ?? "";
  const streetNumber = addr.street_number ?? "";
  const buyerAddress = [streetName, streetNumber].filter(Boolean).join(", ");
  const buyerComplement = addr.comment ?? addr.complement ?? addr.between_streets ?? "";
  const buyerNeighborhood = addr.neighborhood?.name ?? "";
  const buyerCity = addr.city?.name ?? "";
  const buyerState = addr.state?.name ?? "";
  const buyerZip = addr.zip_code ?? "";

  let legacyVariantId: string | null = null;
  let legacyProductId: string | null = null;
  let legacyProductUrl: string | null = null;
  let costPrice: number | null = null;
  let catalogProductId: string | null = null;
  let supplierUrl: string | null = null;
  // deno-lint-ignore no-explicit-any -- linha crua do catálogo, formato varia por fornecedor
  let catalogRow: any = null;

  if (mlItemId) {
    const { data: pub } = await supabase
      .from("user_publications")
      .select("cj_variant_id, cj_product_id, cj_product_url, cost_price, catalog_product_id")
      .eq("ml_item_id", mlItemId)
      .eq("user_id", integration.user_id)
      .maybeSingle();

    if (pub) {
      legacyVariantId = pub.cj_variant_id ?? null;
      legacyProductId = pub.cj_product_id ?? null;
      legacyProductUrl = pub.cj_product_url ?? null;
      costPrice = pub.cost_price ?? null;
      catalogProductId = pub.catalog_product_id ?? null;
    }
  }

  if (catalogProductId) {
    // catalog_product_id em user_publications pode ser UUID ou o slug (external_id)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catalogProductId);
    const { data: cp } = await supabase
      .from("catalog_products")
      .select("id, product_url, title, stock_quantity, is_active")
      .eq(isUuid ? "id" : "external_id", catalogProductId)
      .maybeSingle();
    supplierUrl = cp?.product_url ?? legacyProductUrl;
    if (cp?.id) catalogProductId = cp.id;
    if (cp) catalogRow = cp;
  } else {
    supplierUrl = legacyProductUrl;
  }

  // Fallback: usa o SKU do anúncio (slug do catálogo) quando não há vínculo em user_publications
  if (!supplierUrl) {
    const sellerSku = (item?.item?.seller_sku ?? "").trim();
    if (sellerSku) {
      const { data: cpSku } = await supabase
        .from("catalog_products")
        .select("id, product_url, title, stock_quantity, is_active")
        .eq("external_id", sellerSku)
        .maybeSingle();
      if (cpSku?.product_url) {
        supplierUrl = cpSku.product_url;
        catalogProductId = catalogProductId ?? cpSku.id;
        catalogRow = catalogRow ?? cpSku;
      }
    }
  }



  // ---- Fase 4: valida estoque do fornecedor ANTES de tratar o pedido como repassável.
  // Nunca cancelamos automaticamente: o pedido entra em revisão manual e o anúncio
  // é pausado para não gerar novas vendas do mesmo item indisponível.
  let stockIssue: string | null = null;
  if (catalogRow) {
    const cStock = Number(catalogRow.stock_quantity ?? 0);
    if (catalogRow.is_active === false) stockIssue = "produto_inativo_no_fornecedor";
    else if (!(cStock > 0)) stockIssue = "sem_estoque_no_fornecedor";
  }

  if (stockIssue && mlItemId) {
    try {
      await pauseListingOutOfStock(
        supabase,
        integration.user_id as string,
        accessToken,
        mlItemId,
        catalogRow?.title ?? item?.item?.title ?? mlItemId,
      );
    } catch (e) {
      console.warn("[ml-queue] pausa pós-venda falhou:", (e as Error).message);
    }
  }

  const parsedQuantity = Number(item?.quantity ?? 1);
  const quantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
  const itemUnitPrice = Number(item?.unit_price ?? 0);
  const mlTotalAmount = Number(mlOrder.total_amount ?? 0);
  const fallbackTotalAmount = Number.isFinite(itemUnitPrice) && itemUnitPrice > 0
    ? itemUnitPrice * quantity : 0;
  const totalAmount = Number.isFinite(mlTotalAmount) && mlTotalAmount > 0
    ? mlTotalAmount : fallbackTotalAmount;
  const salePrice = Number.isFinite(itemUnitPrice) && itemUnitPrice > 0
    ? itemUnitPrice : totalAmount / quantity;
  const profit = costPrice !== null ? salePrice - costPrice : null;

  const { data: newOrder, error: insertError } = await supabase
    .from("orders")
    .insert({
      user_id: integration.user_id,
      external_order_id: String(mlOrderId),
      ml_order_id: String(mlOrderId),
      ml_user_id: String(mlUserId),
      shipment_id: shipmentId,
      platform: "mercadolivre",
      product_title: item?.item?.title ?? "Produto ML",
      product_image: null,
      buyer_name: buyerName,
      buyer_email: buyerEmail || null,
      buyer_address: buyerAddress || null,
      buyer_number: streetNumber || null,
      buyer_complement: buyerComplement || null,
      buyer_neighborhood: buyerNeighborhood || null,
      buyer_city: buyerCity || null,
      buyer_state: buyerState || null,
      buyer_zip: buyerZip || null,
      buyer_phone: buyerPhone || null,
      sale_price: salePrice,
      total_amount: totalAmount,
      cost_price: costPrice,
      profit,
      quantity,
      catalog_product_id: catalogProductId,
      supplier_url: supplierUrl,
      cj_product_id: legacyProductId,
      cj_product_url: legacyProductUrl,
      cj_variant_id: legacyVariantId,
      status: "paid",
      fulfillment_status: stockIssue
        ? "needs_review"
        : (legacyVariantId ? "manual_review" : "no_supplier_metadata"),
      fulfillment_error: stockIssue,
      ordered_at: mlOrder.date_created ?? new Date().toISOString(),
      raw: fullMlOrder,
    })
    .select("id")
    .single();

  if (insertError) throw new Error("insert_order_failed: " + insertError.message);

  if (stockIssue) {
    await notifyUser(
      supabase,
      integration.user_id as string,
      "Pedido precisa de revisão: produto sem estoque",
      `Você vendeu "${item?.item?.title ?? "um produto"}" no Mercado Livre, mas ele está indisponível no fornecedor (${
        stockIssue === "produto_inativo_no_fornecedor" ? "produto inativo" : "sem estoque"
      }). O pedido foi marcado para revisão manual e o anúncio foi pausado. Confira em Pedidos antes de comprar no fornecedor.`,
    );
    return `order_created_needs_review_${newOrder.id}`;
  }

  // Envia o pedido ao bot do C7Drop (idempotente por ml_order_id).
  const dispatch = await dispatchOrderToBot(supabase, {
    orderId: newOrder.id as string,
    mlOrderId: String(mlOrderId),
    userId: integration.user_id as string,
    mlOrder: fullMlOrder,
    precoMl: totalAmount,
    accessToken,
  });

  if (!dispatch.dispatched && dispatch.reason === "sku_c7drop_nao_mapeado") {
    await notifyUser(
      supabase,
      integration.user_id as string,
      "Pedido precisa de correção manual",
      `O pedido ${mlOrderId} não pôde ser enviado automaticamente ao fornecedor porque falta o SKU do C7Drop de pelo menos um item. Confira em Pedidos e finalize manualmente.`,
    );
    return `order_created_needs_sku_${newOrder.id}`;
  }

  return `order_created_${newOrder.id}${dispatch.dispatched ? "_bot_ok" : `_bot_${dispatch.reason}`}`;
}


async function notifyUser(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  message: string,
) {
  try {
    await supabase.from("notifications").insert({ user_id: userId, title, message, type: "warning" });
  } catch (e) {
    console.warn("[ml-queue] notificação falhou:", (e as Error).message);
  }
}

/**
 * Pausa o anúncio no ML e marca a publicação como pausada pela Velo por falta
 * de estoque. Quando o anúncio faz parte de um grupo de variações (um item por
 * cor/tamanho), pausa o GRUPO inteiro: não temos estoque por variante, então
 * manter as irmãs no ar venderia produto indisponível.
 */
async function pauseListingOutOfStock(
  supabase: SupabaseClient,
  userId: string,
  accessToken: string,
  mlItemId: string,
  productTitle: string,
) {
  const { data: pubRow } = await supabase
    .from("user_publications")
    .select("variation_group_id")
    .eq("ml_item_id", mlItemId)
    .eq("user_id", userId)
    .maybeSingle();

  let targets = [mlItemId];
  const groupId = (pubRow as { variation_group_id?: string | null } | null)?.variation_group_id;
  if (groupId) {
    const { data: siblings } = await supabase
      .from("user_publications")
      .select("ml_item_id")
      .eq("user_id", userId)
      .eq("variation_group_id", groupId)
      .in("status", ["active", "published"]);
    const ids = (siblings ?? [])
      .map((s) => String((s as { ml_item_id?: string }).ml_item_id ?? ""))
      .filter(Boolean);
    if (ids.length > 0) targets = Array.from(new Set([mlItemId, ...ids]));
  }

  const paused: string[] = [];
  for (const id of targets) {
    const res = await mlFetch(`https://api.mercadolibre.com/items/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paused" }),
    });
    if (!res.ok) {
      console.warn(`[ml-queue] não foi possível pausar ${id}: HTTP ${res.status}`);
      continue;
    }
    paused.push(id);
  }

  if (paused.length === 0) return;

  await supabase
    .from("user_publications")
    .update({
      status: "paused",
      paused_reason: "velo_out_of_stock",
      stock_synced_at: new Date().toISOString(),
    })
    .in("ml_item_id", paused)
    .eq("user_id", userId);
  console.log(
    `[ml-queue] ${paused.length} anúncio(s) pausado(s) por falta de estoque (${productTitle})`,
  );
}

function normalizeMlOrderStatus(mlOrder: Record<string, any>) {
  const rawStatus = String(mlOrder.status ?? "").toLowerCase();
  const hasRefund = Array.isArray(mlOrder.payments) &&
    mlOrder.payments.some((payment: any) => {
      const status = String(payment?.status ?? "").toLowerCase();
      return status === "refunded" ||
        status === "charged_back" ||
        Number(payment?.transaction_amount_refunded ?? 0) > 0;
    });

  if (hasRefund) return "refunded";
  if (rawStatus === "cancelled" || rawStatus === "canceled") return "cancelled";
  if (rawStatus === "paid") return "paid";
  return "pending";
}

async function markDropshipMlCancellation(
  supabase: SupabaseClient,
  params: {
    mlOrderId: string;
    normalizedStatus: "cancelled" | "refunded";
    source: string;
  },
) {
  const { data: dropship } = await supabase
    .from("dropship_orders")
    .select("id,status,payment_status,refund_required,refund_status,order_number,ml_order_id")
    .eq("ml_order_id", params.mlOrderId)
    .maybeSingle();

  if (!dropship || ["cancelado", "expirado"].includes(String(dropship.status))) return;

  const paidStatuses = new Set([
    "pagamento_confirmado",
    "finalizando_fornecedor",
    "pedido_concluido",
    "rastreio_pendente",
    "rastreio_disponivel",
  ]);
  const supplierTouchedStatuses = new Set([
    "reservando_fornecedor",
    "reservado_aguardando_pagamento",
    ...paidStatuses,
  ]);
  const refundRequired =
    paidStatuses.has(String(dropship.status)) ||
    ["paid", "approved", "confirmed"].includes(String(dropship.payment_status ?? "").toLowerCase());
  const nextStatus = supplierTouchedStatuses.has(String(dropship.status))
    ? "cancelamento_pendente"
    : "cancelado";
  const reason = params.normalizedStatus === "refunded"
    ? "Pedido reembolsado no Mercado Livre"
    : "Pedido cancelado no Mercado Livre";

  await supabase
    .from("dropship_orders")
    .update({
      status: nextStatus,
      cancel_reason: reason,
      refund_required: refundRequired,
      refund_status: refundRequired ? "pending" : "not_required",
      updated_at: new Date().toISOString(),
    })
    .eq("id", dropship.id);

  await supabase.from("dropship_order_events").insert({
    order_id: dropship.id,
    event_type: "ml_order_cancelled",
    previous_status: dropship.status,
    new_status: nextStatus,
    actor: params.source,
    message: reason,
    metadata: {
      ml_order_id: params.mlOrderId,
      ml_status: params.normalizedStatus,
      refund_required: refundRequired,
    },
  });

  await supabase.from("dropship_worker_alerts").insert({
    order_id: dropship.id,
    order_number: dropship.order_number ?? dropship.ml_order_id ?? params.mlOrderId,
    severity: refundRequired ? "critical" : "warning",
    code: refundRequired ? "ml_cancelled_refund_required" : "ml_cancelled_cleanup_required",
    message: refundRequired
      ? `Pedido ${params.mlOrderId} foi cancelado no ML depois do pagamento; estorno foi marcado como pendente.`
      : `Pedido ${params.mlOrderId} foi cancelado no ML; worker deve limpar carrinho/reserva se houver.`,
    details: {
      ml_order_id: params.mlOrderId,
      ml_status: params.normalizedStatus,
      refund_required: refundRequired,
    },
  });
}


export async function processQueueEvent(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
): Promise<string> {
  const topic = parseTopic(body);
  if (topic.includes("item")) return await handleItemsTopic(supabase, body);
  if (topic.includes("order")) return await handleOrdersTopic(supabase, body);
  return "ignored_topic";
}

const MAX_ATTEMPTS = 5;

export async function processQueue(
  supabase: SupabaseClient,
  limit = 25,
): Promise<{ picked: number; done: number; failed: number; results: string[] }> {
  const { data: rows, error } = await supabase
    .from("ml_webhook_queue")
    .select("id, payload_raw, attempts")
    .eq("status", "pending")
    .order("received_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);

  let done = 0;
  let failed = 0;
  const results: string[] = [];

  for (const row of rows ?? []) {
    const attempts = (row.attempts as number) + 1;
    try {
      const result = await processQueueEvent(
        supabase,
        row.payload_raw as Record<string, unknown>,
      );
      await supabase
        .from("ml_webhook_queue")
        .update({
          status: "done",
          attempts,
          last_error: null,
          processed_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      done++;
      results.push(`${row.id}:${result}`);
    } catch (e) {
      const message = (e as Error).message;
      const giveUp = attempts >= MAX_ATTEMPTS;
      await supabase
        .from("ml_webhook_queue")
        .update({
          status: giveUp ? "failed" : "pending",
          attempts,
          last_error: message,
          processed_at: giveUp ? new Date().toISOString() : null,
        })
        .eq("id", row.id);
      if (giveUp) await alertFailedEvent(supabase, String(row.id), message);
      failed++;
      results.push(`${row.id}:error:${message}`);
    }
  }

  return { picked: rows?.length ?? 0, done, failed, results };
}

/**
 * Evento que esgotou as tentativas nunca pode falhar em silêncio:
 * notifica todos os admins na tabela `notifications`.
 */
export async function alertFailedEvent(
  supabase: SupabaseClient,
  eventId: string,
  reason: string,
): Promise<void> {
  try {
    console.error(`[ml-webhook-queue] event ${eventId} FAILED after ${MAX_ATTEMPTS} attempts: ${reason}`);
    const { data: admins } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("is_admin", true);
    const rows = (admins ?? []).map((a: { user_id: string }) => ({
      user_id: a.user_id,
      title: "Webhook do Mercado Livre falhou",
      message: `Um evento não pôde ser processado após ${MAX_ATTEMPTS} tentativas: ${reason}`,
      type: "system",
      metadata: { queue_event_id: eventId, reason },
    }));
    if (rows.length) await supabase.from("notifications").insert(rows);
  } catch (e) {
    console.error("[ml-webhook-queue] alert error:", (e as Error).message);
  }
}

/**
 * Retenção: a fila guarda payload bruto, então não pode crescer sem teto.
 *  - `done`   → 14 dias
 *  - `failed` → 90 dias (janela para investigação/suporte)
 */
export async function pruneQueue(
  supabase: SupabaseClient,
): Promise<{ doneDeleted: number; failedDeleted: number }> {
  const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

  const { data: doneRows } = await supabase
    .from("ml_webhook_queue")
    .delete()
    .eq("status", "done")
    .lt("received_at", daysAgo(14))
    .select("id");

  const { data: failedRows } = await supabase
    .from("ml_webhook_queue")
    .delete()
    .eq("status", "failed")
    .lt("received_at", daysAgo(90))
    .select("id");

  return { doneDeleted: doneRows?.length ?? 0, failedDeleted: failedRows?.length ?? 0 };
}

