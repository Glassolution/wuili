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
 * Grava/atualiza o pedido do Mercado Livre em `dropship_orders`, que é a
 * integração central lida pelo worker. Idempotente por `ml_order_id`.
 * Sem SKU do C7Drop, o pedido é criado mas marcado para correção manual.
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
  const mlOrderIdStr = String(mlOrderId);

  const itens = await resolveC7dropItems(supabase, userId, mlOrder);
  const missing = itens.filter((i) => !i.sku_c7drop);
  const needsManual = itens.length === 0 || missing.length > 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .maybeSingle();

  const payload = buildBotPayload({
    mlOrderId: mlOrderIdStr,
    veloSellerId: userId,
    sellerEmail: String(profile?.email ?? ""),
    itens,
    precoMl,
  });

  const buyer = mlOrder?.buyer ?? {};
  const addr = mlOrder?.shipping?.receiver_address ?? {};
  const customerName = String(
    addr?.receiver_name ??
      [buyer?.first_name, buyer?.last_name].filter(Boolean).join(" ").trim() ??
      "",
  ).trim() || null;

  const row = {
    ml_order_id: mlOrderIdStr,
    order_number: `ML-${mlOrderIdStr}`,
    user_id: userId,
    seller_email: payload.seller_email,
    sku_c7drop: payload.sku_c7drop,
    c7drop_product_url: payload.c7drop_product_url,
    quantidade: payload.quantidade,
    preco_ml: payload.preco_ml,
    total_amount: payload.preco_ml,
    items: payload.itens,
    needs_manual_sku: needsManual,
    source: "mercadolivre",
    customer_name: customerName,
    customer_email: buyer?.email ? String(buyer.email) : null,
    customer_phone: addr?.receiver_phone ? String(addr.receiver_phone) : null,
    shipping_address: Object.keys(addr ?? {}).length > 0 ? addr : null,
    metadata: { velo_order_id: orderId, payload },
  };

  // Idempotência por ml_order_id: nunca duplica o mesmo pedido.
  const { error } = await supabase
    .from("dropship_orders")
    .upsert(row, { onConflict: "ml_order_id", ignoreDuplicates: false });

  if (error) {
    console.error("[c7drop] falha ao gravar dropship_orders:", error.message);
    return { dispatched: false, reason: `dropship_upsert_error` };
  }

  // Espelha o estado no pedido original da Velo.
  await supabase
    .from("orders")
    .update({
      bot_payload: payload,
      needs_manual_sku: needsManual,
      ...(needsManual
        ? { fulfillment_status: "needs_review", fulfillment_error: "sku_c7drop_nao_mapeado" }
        : { bot_notified_at: new Date().toISOString() }),
    })
    .eq("id", orderId);

  if (needsManual) {
    console.warn(`[c7drop] pedido ${mlOrderIdStr} sem sku_c7drop — correção manual`);
    return { dispatched: false, reason: "sku_c7drop_nao_mapeado" };
  }

  return { dispatched: true, reason: "ok" };
}
