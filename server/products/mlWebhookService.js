import crypto from "node:crypto";
import { getProductCurationSupabase } from "./productCurationService.js";
import { trackEvent } from "./feedbackService.js";

function getHeader(headers, name) {
  return headers?.[name] ?? headers?.[name.toLowerCase()] ?? headers?.[name.toUpperCase()];
}

function parseSignature(signatureHeader) {
  if (typeof signatureHeader !== "string") return {};

  return Object.fromEntries(
    signatureHeader
      .split(",")
      .map((part) => part.trim().split("="))
      .filter(([key, value]) => key && value),
  );
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function getNotificationId(payload) {
  return String(
    payload?.data?.id ??
    payload?.id ??
    payload?.resource?.split("/")?.filter(Boolean)?.pop() ??
    "",
  );
}

function getOrderId(payload) {
  const resource = String(payload?.resource ?? "");
  const resourceOrderId = resource.includes("/orders/")
    ? resource.split("/orders/").pop()?.split(/[/?#]/)[0]
    : null;

  return String(payload?.data?.id ?? payload?.order_id ?? payload?.id ?? resourceOrderId ?? "");
}

export function validateMercadoLivreWebhookSignature(payload, headers = {}) {
  const secret = process.env.ML_WEBHOOK_SECRET ?? process.env.ML_CLIENT_SECRET;
  const signatureHeader = getHeader(headers, "x-signature");
  const requestId = getHeader(headers, "x-request-id");
  const parts = parseSignature(signatureHeader);
  const ts = parts.ts;
  const v1 = parts.v1;
  const notificationId = getNotificationId(payload);

  if (!secret || !signatureHeader || !requestId || !ts || !v1 || !notificationId) {
    console.warn("[ml-webhook] assinatura ausente/incompleta", {
      hasSecret: Boolean(secret),
      hasSignature: Boolean(signatureHeader),
      hasRequestId: Boolean(requestId),
      hasTs: Boolean(ts),
      hasV1: Boolean(v1),
      hasNotificationId: Boolean(notificationId),
    });
    return false;
  }

  const manifest = `id:${notificationId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const valid = timingSafeEqual(expected, v1);

  if (!valid) {
    console.warn("[ml-webhook] tentativa com assinatura inválida", {
      requestId,
      notificationId,
    });
  }

  return valid;
}

async function fetchMercadoLivreOrder(orderId) {
  const accessToken = process.env.ML_ACCESS_TOKEN;
  if (!accessToken || !orderId) return null;

  try {
    const response = await fetch(`https://api.mercadolibre.com/orders/${encodeURIComponent(orderId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      console.warn("[ml-webhook] não foi possível buscar pedido ML:", response.status);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error("[ml-webhook] erro ao buscar pedido ML:", error.message);
    return null;
  }
}

async function findOrderRow(supabase, orderId) {
  if (!orderId) return null;

  const { data, error } = await supabase
    .from("orders")
    .select("id, user_id, cj_product_id, cj_variant_id, product_title, profit, sale_price, cost_price, ordered_at, raw")
    .or(`ml_order_id.eq.${orderId},external_order_id.eq.${orderId}`)
    .maybeSingle();

  if (error) {
    console.warn("[ml-webhook] erro ao mapear pedido em orders:", error.message);
    return null;
  }

  return data;
}

async function findPublicationByMlItem(supabase, itemId) {
  if (!itemId) return null;

  const { data, error } = await supabase
    .from("user_publications")
    .select("id, user_id, ml_item_id, cj_product_id, cj_variant_id, title, price, cost_price")
    .eq("ml_item_id", itemId)
    .maybeSingle();

  if (error) {
    console.warn("[ml-webhook] erro ao mapear publicação:", error.message);
    return null;
  }

  return data;
}

function getFirstMlItemId(payload, mlOrder) {
  return String(
    payload?.item_id ??
    payload?.ml_item_id ??
    payload?.metadata?.item_id ??
    mlOrder?.order_items?.[0]?.item?.id ??
    "",
  );
}

function salePayloadFromOrderRow(orderRow, orderId, eventId, metadata) {
  const margin = orderRow.sale_price && orderRow.profit != null
    ? Number(((orderRow.profit / orderRow.sale_price) * 100).toFixed(2))
    : orderRow.sale_price && orderRow.cost_price
      ? Number((((orderRow.sale_price - orderRow.cost_price) / orderRow.sale_price) * 100).toFixed(2))
      : null;

  return {
    eventId,
    productId: orderRow.cj_product_id ?? orderRow.product_title,
    cjProductId: orderRow.cj_product_id,
    cjVariantId: orderRow.cj_variant_id,
    orderId,
    mlOrderId: orderId,
    category: orderRow.raw?.category ?? orderRow.raw?.product?.category ?? metadata?.category ?? null,
    margin,
    soldAt: orderRow.ordered_at ?? new Date().toISOString(),
    metadata,
  };
}

function salePayloadFromPublication(publication, orderId, eventId, metadata) {
  const margin = publication.price && publication.cost_price
    ? Number((((publication.price - publication.cost_price) / publication.price) * 100).toFixed(2))
    : null;

  return {
    eventId,
    productId: publication.cj_product_id ?? publication.id,
    cjProductId: publication.cj_product_id,
    cjVariantId: publication.cj_variant_id,
    mlItemId: publication.ml_item_id,
    orderId,
    mlOrderId: orderId,
    category: metadata?.category ?? null,
    margin,
    soldAt: new Date().toISOString(),
    metadata,
  };
}

export async function processMercadoLivreOrderWebhook(payload, headers = {}) {
  const supabase = getProductCurationSupabase();
  if (!supabase) {
    console.warn("[ml-webhook] Supabase não configurado; webhook ignorado.");
    return { processed: false, reason: "supabase_not_configured" };
  }

  const orderId = getOrderId(payload);
  const eventId = `ml-order:${orderId || getNotificationId(payload)}`;
  const metadata = {
    source: "mercadolivre_webhook",
    requestId: getHeader(headers, "x-request-id") ?? null,
    raw: payload,
  };

  const orderRow = await findOrderRow(supabase, orderId);
  if (orderRow?.user_id) {
    await trackEvent(orderRow.user_id, "product_sold", salePayloadFromOrderRow(orderRow, orderId, eventId, metadata));
    return { processed: true, mappedBy: "orders", userId: orderRow.user_id, orderId };
  }

  const mlOrder = await fetchMercadoLivreOrder(orderId);
  const itemId = getFirstMlItemId(payload, mlOrder);
  const publication = await findPublicationByMlItem(supabase, itemId);

  if (publication?.user_id) {
    await trackEvent(publication.user_id, "product_sold", salePayloadFromPublication(publication, orderId, eventId, metadata));
    return { processed: true, mappedBy: "user_publications", userId: publication.user_id, orderId, itemId };
  }

  console.warn("[ml-webhook] não foi possível mapear venda para usuário/produto", { orderId, itemId });
  return { processed: false, reason: "mapping_not_found", orderId, itemId };
}

export function processMercadoLivreOrderWebhookFireAndForget(payload, headers = {}) {
  void processMercadoLivreOrderWebhook(payload, headers).catch((error) => {
    console.error("[ml-webhook] processamento assíncrono falhou:", error.message);
  });
}

