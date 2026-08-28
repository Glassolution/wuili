// Scraper do catálogo público da C7 Drop.
//
// Em julho/2026 a C7 migrou de WordPress/WooCommerce para Next.js + Prisma. As
// URLs antigas (`c7drop.com.br/wp-content/uploads/...`) e a `wc/store/v1` foram
// aposentadas — retornam 308→403 no subdomínio `www`. As imagens que sobraram
// no nosso catálogo (`catalog_products.images`) apontam pra esses caminhos
// mortos, então nenhum produto renderiza foto no Velo.
//
// Nova fonte pública (sem auth):
//   GET https://www.c7drop.com.br/api/products?page=<n>&limit=50
//     → { products: [{id, name, slug, price, image, stock, categories:[{name,slug}]}], total, totalPages }
//   GET https://www.c7drop.com.br/api/products/<slug>
//     → objeto completo com images[], variants[], weight/width/height/length,
//       description, shortDescription, categories[], brand, avgRating, reviewCount
//
// Todas as imagens agora vêm hospedadas no Vercel Blob Storage
// (wfd7n2enlsvgxasp.public.blob.vercel-storage.com), acessível de qualquer IP.
//
// Modos disponíveis (query `?mode=`):
//   • `full`             (default) — reescreve todos os produtos c7drop
//   • `backfill_images`  — só atualiza `images` das linhas c7drop existentes,
//                          preservando preço/título/link/estoque/etc. Usa
//                          o mesmo endpoint por slug (nossa `external_id`).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  decodeHtmlEntities,
  detectBrand,
  inferCategory,
  isBlocked,
  isFakeAdProduct,
  isCellphoneProduct,
  hasEnoughImages,
} from "../_shared/catalog-filters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "c7drop";
const BASE = "https://www.c7drop.com.br";
const LIST_URL = `${BASE}/api/products`;
const DETAIL_URL = (slug: string) => `${BASE}/api/products/${encodeURIComponent(slug)}`;
const PER_PAGE = 50; // API atual limita em 50 mesmo pedindo mais
const MAX_PAGES = 60;
const CONCURRENCY = 6;
// Produtos que o fornecedor marca como `manageStock: false` não têm controle de
// estoque (reposição contínua). Não temos número real: publicamos com um
// estoque padrão conservador em vez do antigo 999 fictício.
const UNMANAGED_STOCK = 100;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; VeloBot/1.0; +https://wuili.lovable.app)",
  Accept: "application/json",
};

type ListItem = {
  id: string;
  name: string;
  slug: string;
  price: number | string | null;
  compareAtPrice: number | string | null;
  image: string | null;
  stock: number | null;
  manageStock?: boolean | null;
  categories?: Array<{ name?: string; slug?: string }>;
};

type ListResponse = {
  products: ListItem[];
  total: number;
  page: number;
  totalPages: number;
};

type ProductImage = { url?: string | null; order?: number; isPrimary?: boolean };
type ProductVariant = {
  name?: string;
  value?: string;
  tier?: string;
  price?: number | string | null;
  stock?: number | null;
  sku?: string | null;
  image?: string | null;
};
type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  shortDescription?: string | null;
  price: number | string | null;
  compareAtPrice: number | string | null;
  weight?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
  length?: number | string | null;
  stock: number | null;
  manageStock?: boolean | null;
  active?: boolean;
  images?: ProductImage[];
  variants?: ProductVariant[];
  categories?: Array<{ category?: { name?: string; slug?: string } } | { name?: string; slug?: string }>;
  brand?: { name?: string } | null;
  avgRating?: number | string | null;
  reviewCount?: number | null;
};

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeImages(detail: ProductDetail, fallback?: string | null): string[] {
  const list = (detail.images ?? [])
    .slice()
    .sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0))
    .map((i) => (typeof i?.url === "string" ? i.url.trim() : ""))
    .filter((s) => s.length > 0 && /^https?:\/\//i.test(s));
  if (list.length === 0 && fallback && /^https?:\/\//i.test(fallback)) {
    return [fallback.trim()];
  }
  return Array.from(new Set(list));
}

// A C7 devolve a mesma variante repetida por tier de preço (GRUPO_VIP, ATACADO,
// DROPSHIPPING). Para o catálogo Velo interessa uma linha por (nome, valor),
// com o preço do tier DROPSHIPPING e o estoque real informado pelo fornecedor.
function normalizeVariants(detail: ProductDetail): Array<Record<string, unknown>> {
  const raw = detail.variants ?? [];
  const byKey = new Map<string, { name: string; value: string; stock: number; sku: string | null; cost_price: number | null; tier: string }>();
  for (const v of raw) {
    const name = (v.name ?? "").trim();
    const value = (v.value ?? "").trim();
    if (!name || !value) continue;
    const key = `${name.toLowerCase()}|${value.toLowerCase()}`;
    const tier = (v.tier ?? "").toUpperCase();
    const price = toNumber(v.price);
    const stock = toNumber(v.stock) ?? 0;
    const atual = byKey.get(key);
    const ehDrop = tier === "DROPSHIPPING";
    if (!atual || (ehDrop && atual.tier !== "DROPSHIPPING")) {
      byKey.set(key, {
        name,
        value,
        stock: Math.max(stock, atual?.stock ?? 0),
        sku: (v.sku ?? null) || null,
        cost_price: price,
        tier,
      });
    } else if (stock > atual.stock) {
      atual.stock = stock;
    }
  }
  const manageStock = detail.manageStock !== false;
  return Array.from(byKey.values()).map((v) => ({
    name: v.name,
    value: v.value,
    sku: v.sku,
    cost_price: v.cost_price,
    // manageStock=false → fornecedor não controla estoque dessa linha.
    stock: manageStock ? v.stock : UNMANAGED_STOCK,
  }));
}

function pickCategoryName(detail: ProductDetail): string | null {
  const raw = detail.categories?.[0];
  if (!raw) return null;
  // API às vezes devolve { category: {...} }, às vezes o objeto direto.
  const inner = (raw as { category?: { name?: string } }).category ?? (raw as { name?: string });
  const name = inner?.name;
  return typeof name === "string" && name.trim().length > 0 ? name.trim() : null;
}

function extractDropshippingPrice(detail: ProductDetail): number {
  // Preferimos o preço da variante "Dropshipping" (que é o que o velo revende).
  // Se não existir, caímos para o `price` de topo.
  const dropVariant = detail.variants?.find((v) =>
    (v.tier ?? "").toUpperCase() === "DROPSHIPPING" ||
    (v.value ?? "").toLowerCase().includes("drop"),
  );
  const raw = toNumber(dropVariant?.price) ?? toNumber(detail.price);
  return raw ?? 0;
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: HEADERS, redirect: "follow" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function fetchList(page: number): Promise<ListResponse | null> {
  return fetchJson<ListResponse>(`${LIST_URL}?page=${page}&limit=${PER_PAGE}`);
}

async function fetchDetail(slug: string): Promise<ProductDetail | null> {
  try {
    return await fetchJson<ProductDetail>(DETAIL_URL(slug));
  } catch (e) {
    console.warn(`[scrape-c7drop] detalhe falhou p/ ${slug}:`, e instanceof Error ? e.message : e);
    return null;
  }
}

async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

function buildRowFromDetail(detail: ProductDetail, listItem?: ListItem): Record<string, unknown> | null {
  const title = decodeHtmlEntities(detail.name ?? listItem?.name ?? "");
  if (!title || !detail.slug) return null;
  if (isFakeAdProduct(title, detail.slug)) return null;

  const images = normalizeImages(detail, listItem?.image ?? null);
  const price = extractDropshippingPrice(detail);
  // ML exige no mínimo 3 fotos: produto com galeria incompleta fica bloqueado.
  // Celulares/smartphones (MLB1055) não publicam no ML sem homologação Anatel.
  const blockedFlag =
    isBlocked(title) || !hasEnoughImages(images) || isCellphoneProduct(title, pickCategoryName(detail));
  // A C7 usa `manageStock: false` para itens sem controle de estoque (sempre
  // disponíveis) — nesses casos `stock` vem 0/-1 e não significa esgotado.
  const manageStock = detail.manageStock ?? listItem?.manageStock ?? true;
  const rawStock = toNumber(detail.stock ?? listItem?.stock) ?? 0;
  const stock = manageStock === false ? UNMANAGED_STOCK : rawStock;
  const compareAt = toNumber(detail.compareAtPrice ?? listItem?.compareAtPrice ?? null);

  const rawDesc = (detail.shortDescription && detail.shortDescription.trim().length > 0)
    ? detail.shortDescription
    : (detail.description ?? "");
  const description = rawDesc && rawDesc.trim().length > 0
    ? decodeHtmlEntities(rawDesc).trim()
    : null;

  const suggested = Math.round(price * 2 * 100) / 100;
  // original_price ("de" riscado): só quando o fornecedor pratica desconto real.
  const originalPrice = compareAt !== null && compareAt > price && price > 0
    ? Math.round(compareAt * 2 * 100) / 100
    : null;

  const brandName = detail.brand?.name?.trim() || detectBrand(title);
  const categoryFromApi = pickCategoryName(detail);
  const category = categoryFromApi ?? inferCategory(title);

  const weight = toNumber(detail.weight);
  const rating = toNumber(detail.avgRating);
  const ordersCount = typeof detail.reviewCount === "number" && detail.reviewCount > 0
    ? detail.reviewCount
    : null;

  const now = new Date().toISOString();

  return {
    source: SOURCE,
    external_id: detail.slug,
    title,
    description,
    images,
    cost_price: price,
    suggested_price: suggested,
    margin_percent: 100,
    category,
    supplier_name: "C7 Drop",
    stock_quantity: stock > 0 ? stock : 0,
    variants: normalizeVariants(detail),
    is_active: detail.active !== false,
    product_url: `${BASE}/produto/${detail.slug}`,
    is_blocked: blockedFlag,
    brand: brandName ?? null,
    weight: weight && weight > 0 ? weight : null,
    ...(originalPrice !== null ? { original_price: originalPrice } : {}),
    ...(rating !== null ? { rating } : {}),
    ...(ordersCount !== null ? { orders_count: ordersCount } : {}),
    scraped_at: now,
    updated_at: now,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") ?? "full").toLowerCase();

    // ------------------------------------------------------------------
    // Modo backfill_images: só atualiza a coluna `images` das linhas
    // existentes. Não toca preço/título/link/estoque/etc.
    // ------------------------------------------------------------------
    if (mode === "backfill_images" || mode === "backfill") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "400", 10) || 400, 1500);
      const onlyStale = url.searchParams.get("only_stale") !== "0"; // default: pega só quem ainda tem wp-content
      console.log(`[scrape-c7drop] Backfill de imagens iniciado (limit=${limit}, onlyStale=${onlyStale})`);
      let q = supabase
        .from("catalog_products")
        .select("id,external_id,images")
        .eq("source", SOURCE);
      const { data: allRows, error: exErr } = await q;
      if (exErr) throw exErr;
      let candidates = allRows ?? [];
      if (onlyStale) {
        candidates = candidates.filter((r) => {
          const s = JSON.stringify(r.images ?? []);
          return !s.includes("vercel-storage");
        });
      }
      const rows = candidates.slice(0, limit);
      console.log(`[scrape-c7drop] ${rows.length} produtos c7drop pra revisitar (de ${candidates.length} candidatos)`);

      let updated = 0;
      let missing = 0;
      let unchanged = 0;
      let errors = 0;
      const now = new Date().toISOString();

      await mapPool(rows, CONCURRENCY, async (row) => {
        try {
          const detail = await fetchDetail(row.external_id);
          if (!detail) {
            missing++;
            return;
          }
          const images = normalizeImages(detail, null);
          if (images.length === 0) {
            missing++;
            return;
          }
          const currentFirst = Array.isArray(row.images) && row.images.length > 0 ? String(row.images[0]) : "";
          if (currentFirst === images[0] && Array.isArray(row.images) && row.images.length === images.length) {
            unchanged++;
            return;
          }
          const { error: upErr } = await supabase
            .from("catalog_products")
            .update({ images, scraped_at: now, updated_at: now })
            .eq("id", row.id);
          if (upErr) {
            errors++;
            console.error(`[scrape-c7drop] update falhou p/ ${row.external_id}: ${upErr.message}`);
            return;
          }
          updated++;
        } catch (e) {
          errors++;
          console.error(`[scrape-c7drop] backfill erro ${row.external_id}:`, e instanceof Error ? e.message : e);
        }
      });

      const summary = { ok: true, mode: "backfill_images", total: rows.length, updated, unchanged, missing, errors };
      console.log(`[scrape-c7drop] Backfill concluído:`, JSON.stringify(summary));
      return new Response(JSON.stringify(summary), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ------------------------------------------------------------------
    // Modo full: pagina a lista, busca detalhe de cada produto e upserta.
    // ------------------------------------------------------------------
    // Suporta fatiar por páginas (`?start=1&end=5`) porque o scrape inteiro
    // estoura o limite de 150s de execução da função.
    const startPage = Math.max(1, parseInt(url.searchParams.get("start") ?? "1", 10) || 1);
    const endPage = Math.min(MAX_PAGES, parseInt(url.searchParams.get("end") ?? String(MAX_PAGES), 10) || MAX_PAGES);
    console.log(`[scrape-c7drop] Iniciando full scrape via ${LIST_URL} (páginas ${startPage}..${endPage})`);
    const list: ListItem[] = [];
    let totalPagesSeen = 0;
    for (let page = startPage; page <= endPage; page++) {
      const res = await fetchList(page);
      if (!res || !Array.isArray(res.products) || res.products.length === 0) break;
      totalPagesSeen = res.totalPages;
      list.push(...res.products);
      console.log(`[scrape-c7drop] Página ${page}/${res.totalPages}: ${res.products.length} itens (acumulado ${list.length})`);
      if (page >= res.totalPages) break;
    }
    console.log(`[scrape-c7drop] Lista concluída: ${list.length} produtos`);


    // Detalhe em paralelo (imagens completas, variantes, peso, dimensões, categoria).
    let skippedFakeAds = 0;
    let noDetail = 0;
    let blocked = 0;
    const rows: Record<string, unknown>[] = [];
    await mapPool(list, CONCURRENCY, async (item) => {
      if (!item.slug || !item.name) return;
      if (isFakeAdProduct(decodeHtmlEntities(item.name), item.slug)) {
        skippedFakeAds++;
        return;
      }
      const detail = await fetchDetail(item.slug);
      if (!detail) {
        noDetail++;
        return;
      }
      const row = buildRowFromDetail(detail, item);
      if (!row) return;
      if (row.is_blocked) blocked++;
      rows.push(row);
    });

    console.log(
      `[scrape-c7drop] Prontos p/ upsert: ${rows.length} (skipFakes=${skippedFakeAds}, semDetalhe=${noDetail}, blocked=${blocked})`,
    );

    // Detecta insert vs update.
    const { data: existing } = await supabase
      .from("catalog_products")
      .select("external_id")
      .eq("source", SOURCE);
    const existingIds = new Set((existing ?? []).map((r) => r.external_id));

    let inserted = 0;
    let updated = 0;
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      const { error } = await supabase
        .from("catalog_products")
        .upsert(slice, { onConflict: "source,external_id" });
      if (error) {
        console.error(`[scrape-c7drop] Erro upsert lote ${i}:`, error.message);
        throw error;
      }
      for (const r of slice) {
        if (existingIds.has(r.external_id as string)) updated++;
        else inserted++;
      }
    }

    const summary = {
      ok: true,
      mode: "full",
      source: SOURCE,
      start_page: startPage,
      end_page: endPage,
      supplier_total_pages: totalPagesSeen,
      total_scraped: list.length,
      inserted,
      updated,
      blocked,
      skipped_fake_ads: skippedFakeAds,
      no_detail: noDetail,
      ran_at: new Date().toISOString(),
    };

    console.log("[scrape-c7drop] Concluído:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[scrape-c7drop] Erro fatal:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err instanceof Error ? err.message : err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
