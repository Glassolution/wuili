// Scraper do catálogo público da C7 Drop (https://c7drop.com.br/loja/).
// Usa a WooCommerce Store API pública (/wp-json/wc/store/v1/products), que retorna
// preço, imagens, slug e estoque sem necessidade de autenticação — muito mais
// confiável do que raspar o HTML paginado (o site lista 12 por página via JS).
// Rodado a cada 12h via pg_cron, mas pode ser disparado manualmente:
//   curl -X POST https://<project>.supabase.co/functions/v1/scrape-c7drop \
//        -H "apikey: <anon-key>"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decodeHtmlEntities, detectBrand, extractAttribute, extractVariantOptions, inferCategory, isBlocked, isFakeAdProduct } from "../_shared/catalog-filters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SOURCE = "c7drop";
const API_URL = "https://c7drop.com.br/wp-json/wc/store/v1/products";
const PER_PAGE = 100;
const MAX_PAGES = 30; // 30 * 100 = 3000, cobre folga sobre 1095

type WCProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  is_in_stock: boolean;
  prices?: {
    price?: string;            // em centavos (string)
    regular_price?: string;
    sale_price?: string;
    currency_minor_unit?: number;
    price_range?: { min_amount?: string; max_amount?: string } | null;
  };
  images?: Array<{ src?: string; thumbnail?: string }>;
  attributes?: Array<{
    name?: string;
    taxonomy?: string;
    terms?: Array<{ name?: string; slug?: string }>;
  }>;
  description?: string;
  short_description?: string;
  average_rating?: string | number;
  total_sales?: string | number;
};

function parseWeightString(weightStr: string): number | null {
  const clean = weightStr.trim().toLowerCase();
  
  // Extrai o número e a unidade (g ou kg)
  const numMatch = clean.match(/([\d.,]+)\s*(g|kg)/);
  if (!numMatch) {
    const fallbackNum = parseFloat(clean.replace(',', '.'));
    return isNaN(fallbackNum) ? null : fallbackNum;
  }

  const numVal = parseFloat(numMatch[1].replace(',', '.'));
  if (isNaN(numVal)) return null;

  const unit = numMatch[2];
  if (unit === 'g') {
    return numVal / 1000; // Converte para kg
  } else if (unit === 'kg') {
    return numVal;
  }

  return null;
}

function extractWeightFromDescription(html: string | null | undefined): number | null {
  if (!html) return null;

  // 1. Procura na tabela andes-table de especificações (Peso)
  // Ex: <div class="andes-table__header__container">Peso</div> ... <span ...>450 g</span>
  const pesoTableRegex = /Peso<\/div>\s*<\/th>\s*<td[^>]*>\s*<span[^>]*class="[^"]*value[^"]*"[^>]*>([^<]+)<\/span>/i;
  let match = html.match(pesoTableRegex);
  if (match) {
    const val = parseWeightString(match[1]);
    if (val !== null && val > 0) return val;
  }

  // Se não bater com o primeiro, tenta sem a classe "value"
  const pesoTableRegexSimple = /Peso<\/div>\s*<\/th>\s*<td[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i;
  match = html.match(pesoTableRegexSimple);
  if (match) {
    const val = parseWeightString(match[1]);
    if (val !== null && val > 0) return val;
  }

  // 2. Procura por "Peso aproximado: XXX" ou "Peso: XXX" no texto do HTML
  const cleanText = html.replace(/<[^>]*>/g, ' ');
  const pesoTextRegex = /Peso\s*(?:aproximado)?\s*:\s*([\d.,\s]+(?:g|kg|kg\.?|g\.?))\b/i;
  match = cleanText.match(pesoTextRegex);
  if (match) {
    const val = parseWeightString(match[1]);
    if (val !== null && val > 0) return val;
  }

  const pesoTextRegex2 = /Peso\s*(?:do produto)?\s*de\s*([\d.,\s]+(?:g|kg|kg\.?|g\.?))\b/i;
  match = cleanText.match(pesoTextRegex2);
  if (match) {
    const val = parseWeightString(match[1]);
    if (val !== null && val > 0) return val;
  }

  return null;
}


function parsePriceMinor(p: WCProduct): number {
  // C7Drop usa produto variável com duas opções de compra: "Atacado" (preço menor)
  // e "Dropshipping" (preço maior). Para o modelo do Velo, sempre usamos o preço de
  // dropshipping = max_amount do price_range. Produto simples não tem price_range,
  // então caímos para prices.price.
  const unit = p.prices?.currency_minor_unit ?? 2;
  const raw = p.prices?.price_range?.max_amount ?? p.prices?.price;
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return 0;
  return n / Math.pow(10, unit);
}

function parsePositiveMetric(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(",", ".")) : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parsePositiveIntegerMetric(value: unknown): number | null {
  const parsed = parsePositiveMetric(value);
  return parsed === null ? null : Math.round(parsed);
}

async function fetchPage(page: number): Promise<WCProduct[]> {
  const url = `${API_URL}?per_page=${PER_PAGE}&page=${page}&orderby=date&order=desc`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; VeloBot/1.0; +https://wuili.lovable.app)",
      Accept: "application/json",
    },
  });
  if (res.status === 400 || res.status === 404) return []; // página além do total
  if (!res.ok) {
    throw new Error(`C7Drop HTTP ${res.status} na página ${page}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`[scrape-c7drop] Iniciando paginação ${API_URL}`);
    const all: WCProduct[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const batch = await fetchPage(page);
      if (batch.length === 0) {
        console.log(`[scrape-c7drop] Página ${page} vazia — fim da paginação.`);
        break;
      }
      all.push(...batch);
      console.log(`[scrape-c7drop] Página ${page}: ${batch.length} produtos (total acumulado ${all.length})`);
      if (batch.length < PER_PAGE) break;
    }

    console.log(`[scrape-c7drop] ${all.length} produtos coletados da API`);

    // Pré-carrega external_ids existentes para classificar insert vs update.
    const { data: existing } = await supabase
      .from("catalog_products")
      .select("external_id")
      .eq("source", SOURCE);
    const existingIds = new Set((existing ?? []).map((r) => r.external_id));

    let inserted = 0;
    let updated = 0;
    let blocked = 0;
    const now = new Date().toISOString();

    let skippedFakeAds = 0;
    const rows = all
      .filter((p) => {
        if (!p.slug || !p.name) return false;
        const decoded = decodeHtmlEntities(p.name);
        if (isFakeAdProduct(decoded, p.permalink)) {
          skippedFakeAds++;
          return false;
        }
        return true;
      })
      .map((p) => {
        const price = parsePriceMinor(p);
        // Salva TODAS as imagens da galeria (a Store API já devolve o array completo).
        // image[0] = capa, demais = imagens secundárias. Necessário para atender ao
        // mínimo de 3 fotos exigido pelo Mercado Livre.
        const images = (p.images ?? [])
          .map((i) => i?.src ?? i?.thumbnail ?? "")
          .filter((s) => !!s);
        const title = decodeHtmlEntities(p.name);
        const blockedFlag = isBlocked(title);
        if (blockedFlag) blocked++;
        // Marca: prioriza atributo do fornecedor; se não houver, tenta reconhecer
        // no título por lista de marcas conhecidas. NÃO salva "Genérica" aqui —
        // esse fallback é responsabilidade do ml-publish para não poluir o banco.
        const brandFromAttr = extractAttribute(p.attributes, ["marca", "brand", "pa_marca"]);
        const brand = brandFromAttr ?? detectBrand(title);
        // Modelo: só grava quando o fornecedor informa explicitamente. Algumas
        // categorias do ML rejeitam texto livre inventado — deixamos o usuário
        // preencher no modal de revisão quando ausente.
        const model = extractAttribute(p.attributes, ["modelo", "model", "pa_modelo"]);
        const weight = extractWeightFromDescription(p.description || p.short_description);
        const rating = parsePositiveMetric(p.average_rating);
        const ordersCount = parsePositiveIntegerMetric(p.total_sales);
        const variants = extractVariantOptions(p.attributes);
        // Descrição: usamos short_description quando disponível (resumo curto que
        // o fornecedor mantém limpo), com fallback para a descrição completa.
        // Decodificamos entidades HTML mas preservamos as tags — o template
        // renderiza como HTML sanitizado.
        const rawDesc = (p.short_description && p.short_description.trim().length > 0)
          ? p.short_description
          : (p.description ?? "");
        const description = rawDesc && rawDesc.trim().length > 0
          ? decodeHtmlEntities(rawDesc).trim()
          : null;
        // original_price ("de" riscado): SÓ preenchemos quando o fornecedor
        // pratica desconto real (regular_price > sale_price). Preço de referência
        // fabricado é publicidade enganosa (CDC art. 37).
        const unit = p.prices?.currency_minor_unit ?? 2;
        let originalPrice: number | null = null;
        const rp = p.prices?.regular_price ? parseInt(p.prices.regular_price, 10) : NaN;
        const sp = p.prices?.sale_price ? parseInt(p.prices.sale_price, 10) : NaN;
        if (Number.isFinite(rp) && Number.isFinite(sp) && rp > sp && sp > 0) {
          originalPrice = Math.round((rp / Math.pow(10, unit)) * 2 * 100) / 100;
        }
        return {
          source: SOURCE,
          external_id: p.slug,
          title,
          description,
          images,
          cost_price: price,
          suggested_price: Math.round(price * 2 * 100) / 100,
          margin_percent: 100,
          category: inferCategory(title),
          supplier_name: "C7 Drop",
          stock_quantity: p.is_in_stock ? 100 : 0,
          is_active: true,
          product_url: p.permalink,
          is_blocked: blockedFlag,
          brand,
          model,
          weight,
          variants,
          ...(originalPrice !== null ? { original_price: originalPrice } : {}),
          ...(rating !== null ? { rating } : {}),
          ...(ordersCount !== null ? { orders_count: ordersCount } : {}),
          scraped_at: now,
          updated_at: now,
        };
      });
    console.log(`[scrape-c7drop] ${skippedFakeAds} anúncios falsos ignorados`);

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
        if (existingIds.has(r.external_id)) updated++;
        else inserted++;
      }
    }

    const summary = {
      ok: true,
      source: SOURCE,
      total_scraped: all.length,
      inserted,
      updated,
      blocked,
      skipped_fake_ads: skippedFakeAds,
      ran_at: now,
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
