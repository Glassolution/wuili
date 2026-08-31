/**
 * c7dropBotDispatch
 * -----------------
 * Resolve o SKU do fornecedor C7Drop de cada item de um pedido do Mercado Livre
 * e envia o payload para o bot externo.
 *
 * Onde vive o SKU do fornecedor na Velo:
 *   catalog_products.variants[].sku  → SKU real usado no C7Drop (ex.: "CTR-GEM1003")
 *   catalog_products.external_id     → slug do produto no C7Drop (usado na URL)
 *   catalog_products.product_url     → link direto do produto no C7Drop
 *
 * NUNCA usamos item.seller_sku do Mercado Livre como sku_c7drop: ele é o SKU
 * interno do anúncio (slug), servindo apenas como chave de busca no catálogo.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface BotOrderItem {
  sku_c7drop: string | null;
  c7drop_product_url: string | null;
  nome: string;
  quantidade: number;
  preco: number;
  ml_item_id: string | null;
  variacao: string | null;
}

export interface BotOrderPayload {
  ml_order_id: string;
  velo_seller_id: string;
  seller_email: string;
  sku_c7drop: string | null;
  c7drop_product_url: string | null;
  quantidade: number;
  itens: BotOrderItem[];
  preco_ml: number;
}

// deno-lint-ignore no-explicit-any -- estrutura crua do pedido varia por versão da API do ML
type MlOrder = any;

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/** Escolhe a variante do catálogo que corresponde à variação vendida no ML. */
function pickVariantSku(
  // deno-lint-ignore no-explicit-any -- variants tem formato livre por fornecedor
  variants: any,
  variationValue: string | null,
): string | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;

  if (variationValue) {
    const wanted = normalize(variationValue);
    const match = variants.find((v) =>
      normalize(v?.value) === wanted ||
      normalize(v?.name) === wanted ||
      normalize(v?.sku) === wanted
    );
    if (match?.sku) return String(match.sku);
  }

  const first = variants.find((v) => v?.sku);
  return first?.sku ? String(first.sku) : null;
}

async function findCatalogRow(
  supabase: SupabaseClient,
  { catalogProductId, sellerSku }: { catalogProductId: string | null; sellerSku: string | null },
) {
  const columns = "id, external_id, product_url, title, variants, source";

  if (catalogProductId) {
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(catalogProductId);
    const { data } = await supabase
      .from("catalog_products")
      .select(columns)
      .eq(isUuid ? "id" : "external_id", catalogProductId)
      .maybeSingle();
    if (data) return data;
  }

  if (sellerSku) {
    const { data } = await supabase
      .from("catalog_products")
      .select(columns)
      .eq("external_id", sellerSku)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}

/** Monta a lista de itens do pedido já com o SKU do fornecedor resolvido. */
export async function resolveC7dropItems(
  supabase: SupabaseClient,
  userId: string,
  mlOrder: MlOrder,
): Promise<BotOrderItem[]> {
  const orderItems: MlOrder[] = Array.isArray(mlOrder?.order_items) ? mlOrder.order_items : [];
  const resolved: BotOrderItem[] = [];

  for (const oi of orderItems) {
    const mlItemId = oi?.item?.id ? String(oi.item.id) : null;
    const sellerSku = String(oi?.item?.seller_sku ?? "").trim() || null;
    const quantityRaw = Number(oi?.quantity ?? 1);
    const quantidade = Number.isFinite(quantityRaw) && quantityRaw > 0 ? quantityRaw : 1;
    const precoRaw = Number(oi?.unit_price ?? 0);
    const preco = Number.isFinite(precoRaw) ? precoRaw : 0;

    let catalogProductId: string | null = null;
    let variationValue: string | null = null;
    let fallbackUrl: string | null = null;

    if (mlItemId) {
      const { data: pub } = await supabase
        .from("user_publications")
        .select("catalog_product_id, cj_product_url, variation_value")
        .eq("ml_item_id", mlItemId)
        .eq("user_id", userId)
        .maybeSingle();
      if (pub) {
        catalogProductId = (pub.catalog_product_id as string | null) ?? null;
        variationValue = (pub.variation_value as string | null) ?? null;
        fallbackUrl = (pub.cj_product_url as string | null) ?? null;
      }
    }

    // A variação vendida no ML tem prioridade sobre a da publicação
    const mlVariation = Array.isArray(oi?.item?.variation_attributes)
      ? oi.item.variation_attributes.map((a: MlOrder) => a?.value_name).filter(Boolean).join(" / ")
      : null;

    const catalog = await findCatalogRow(supabase, { catalogProductId, sellerSku });
    const sku = catalog ? pickVariantSku(catalog.variants, mlVariation || variationValue) : null;

    resolved.push({
      sku_c7drop: sku,
      c7drop_product_url: (catalog?.product_url as string | null) ?? fallbackUrl,
      nome: String(catalog?.title ?? oi?.item?.title ?? "Produto"),
      quantidade,
      preco,
      ml_item_id: mlItemId,
      variacao: mlVariation || variationValue || null,
    });
  }

  return resolved;
}

export function buildBotPayload(params: {
  mlOrderId: string;
  veloSellerId: string;
  sellerEmail: string;
  itens: BotOrderItem[];
  precoMl: number;
}): BotOrderPayload {
  const { mlOrderId, veloSellerId, sellerEmail, itens, precoMl } = params;
  const first = itens[0] ?? null;

  return {
    ml_order_id: String(mlOrderId),
    velo_seller_id: veloSellerId,
    seller_email: sellerEmail,
    sku_c7drop: first?.sku_c7drop ?? null,
    c7drop_product_url: first?.c7drop_product_url ?? null,
    quantidade: itens.reduce((acc, i) => acc + i.quantidade, 0),
    itens,
    preco_ml: precoMl,
  };
}

/**
 * Envia o pedido ao bot de forma idempotente por ml_order_id.
 * Só dispara quando TODOS os itens têm sku_c7drop; caso contrário o pedido é
 * marcado como pendente de correção manual e nada é enviado.
 */
export async function dispatchOrderToBot(
  supabase: SupabaseClient,
  params: {
    orderId: string;
    mlOrderId: string;
    userId: string;
    mlOrder: MlOrder;
    precoMl: number;
  },
): Promise<{ dispatched: boolean; reason: string }> {
  const { orderId, mlOrderId, userId, mlOrder, precoMl } = params;

  // Idempotência: se já enviamos este ml_order_id, não repetimos.
  const { data: already } = await supabase
    .from("orders")
    .select("id, bot_notified_at")
    .eq("ml_order_id", String(mlOrderId))
    .not("bot_notified_at", "is", null)
    .maybeSingle();
  if (already) return { dispatched: false, reason: "already_dispatched" };

  const itens = await resolveC7dropItems(supabase, userId, mlOrder);
  const missing = itens.filter((i) => !i.sku_c7drop);

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();

  const payload = buildBotPayload({
    mlOrderId: String(mlOrderId),
    veloSellerId: userId,
    sellerEmail: String(profile?.email ?? ""),
    itens,
    precoMl,
  });

  if (itens.length === 0 || missing.length > 0) {
    await supabase
      .from("orders")
      .update({
        needs_manual_sku: true,
        bot_payload: payload,
        fulfillment_status: "needs_review",
        fulfillment_error: "sku_c7drop_nao_mapeado",
      })
      .eq("id", orderId);
    return { dispatched: false, reason: "sku_c7drop_nao_mapeado" };
  }

  const url = Deno.env.get("C7DROP_BOT_WEBHOOK_URL");
  if (!url) {
    await supabase.from("orders").update({ bot_payload: payload }).eq("id", orderId);
    console.warn("[c7drop-bot] C7DROP_BOT_WEBHOOK_URL não configurada; envio ignorado");
    return { dispatched: false, reason: "webhook_url_missing" };
  }

  const token = Deno.env.get("C7DROP_BOT_WEBHOOK_TOKEN");
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `ml-order:${mlOrderId}`,
        ...(token ? { "x-webhook-token": token } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[c7drop-bot] envio falhou:", res.status, text.slice(0, 300));
      await supabase.from("orders").update({ bot_payload: payload }).eq("id", orderId);
      return { dispatched: false, reason: `bot_http_${res.status}` };
    }

    await supabase
      .from("orders")
      .update({
        bot_notified_at: new Date().toISOString(),
        bot_payload: payload,
        needs_manual_sku: false,
      })
      .eq("id", orderId);

    return { dispatched: true, reason: "ok" };
  } catch (e) {
    console.error("[c7drop-bot] erro de rede:", (e as Error).message);
    await supabase.from("orders").update({ bot_payload: payload }).eq("id", orderId);
    return { dispatched: false, reason: "network_error" };
  }
}
