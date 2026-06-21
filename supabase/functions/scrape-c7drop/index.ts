// Scraper do catálogo público da C7 Drop (https://c7drop.com.br/loja/).
// Usa a WooCommerce Store API pública (/wp-json/wc/store/v1/products), que retorna
// preço, imagens, slug e estoque sem necessidade de autenticação — muito mais
// confiável do que raspar o HTML paginado (o site lista 12 por página via JS).
// Rodado a cada 12h via pg_cron, mas pode ser disparado manualmente:
//   curl -X POST https://<project>.supabase.co/functions/v1/scrape-c7drop \
//        -H "apikey: <anon-key>"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { decodeHtmlEntities, inferCategory, isBlocked, isFakeAdProduct } from "../_shared/catalog-filters.ts";

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
    currency_minor_unit?: number;
  };
  images?: Array<{ src?: string; thumbnail?: string }>;
};

function parsePriceMinor(p: WCProduct): number {
  const raw = p.prices?.price;
  const unit = p.prices?.currency_minor_unit ?? 2;
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  if (isNaN(n)) return 0;
  return n / Math.pow(10, unit);
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
        const image = p.images?.[0]?.src ?? p.images?.[0]?.thumbnail ?? "";
        const title = decodeHtmlEntities(p.name);
        const blockedFlag = isBlocked(title);
        if (blockedFlag) blocked++;
        return {
          source: SOURCE,
          external_id: p.slug,
          title,
          description: null,
          images: [image].filter(Boolean),
          cost_price: price,
          suggested_price: Math.round(price * 2 * 100) / 100,
          margin_percent: 100,
          category: inferCategory(title),
          supplier_name: "C7 Drop",
          stock_quantity: p.is_in_stock ? 100 : 0,
          is_active: true,
          product_url: p.permalink,
          is_blocked: blockedFlag,
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
