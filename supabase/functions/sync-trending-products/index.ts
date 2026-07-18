// Sync diário: cruza os produtos mais vendidos no Mercado Livre (por categoria)
// com o custo equivalente no AliExpress e grava em `trending_products_real` +
// snapshot em `trending_products_history`.
//
// ML público (client_credentials) foi restringido: search/trends retornam 403.
// Este sync usa um access_token válido de VENDEDOR (persistido em
// `user_integrations`, platform='mercadolivre') apenas para leitura pública
// autorizada (endpoints /highlights e /products) — não altera dados do vendedor.
// O ranking usa o endpoint oficial /highlights/MLB/category/{id} (best sellers),
// e o preço é obtido via /products/{id}/items (mediana das ofertas).
//
// AliExpress: Affiliate Open Platform com assinatura HMAC-SHA256.
//
// Secrets esperados (Deno.env):
//   ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Buffer configurável de frete/imposto aplicado sobre o custo AliExpress convertido.
const IMPORT_COST_BUFFER_PERCENT = 30;
const USD_TO_BRL = 5.0;
const TOP_N_PER_CATEGORY = 20;
// Thresholds baixos porque títulos ML (pt-BR) x AliExpress (en) têm pouca sobreposição léxica.
const SIM_THRESHOLD_MEDIO = 0.08;
const SIM_THRESHOLD_ALTO = 0.20;

// Mapeamento categoria (label frontend) -> ML category id.
const ML_CATEGORIES: Record<string, string> = {
  "Eletrônicos": "MLB1000",
  "Automotivo": "MLB1743",
  "Bebê": "MLB1384",
  "Beleza": "MLB1246",
  "Livros": "MLB3025",
  "Colecionáveis": "MLB1798",
  "Informática": "MLB1648",
  "Moda": "MLB1430",
  "Alimentos": "MLB1403",
  "Casa": "MLB1574",
  "Saúde": "MLB1246",
  "Ferramentas": "MLB1500",
};

const ALI_KEYWORDS: Record<string, string> = {
  "Eletrônicos": "electronics",
  "Automotivo": "car accessories",
  "Bebê": "baby",
  "Beleza": "beauty",
  "Livros": "books",
  "Colecionáveis": "collectibles",
  "Informática": "computer",
  "Moda": "fashion",
  "Alimentos": "food",
  "Casa": "home",
  "Saúde": "health",
  "Ferramentas": "tools",
};

const STOPWORDS = new Set([
  "de","da","do","das","dos","a","o","e","com","para","por","em","no","na",
  "the","and","for","with","of","to","in","on","um","uma","uns","umas",
]);

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function similarity(a: string, b: string): number {
  const ta = new Set(normalize(a));
  const tb = new Set(normalize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ---- ML: pega um token de vendedor válido do banco -----------------------
async function getMlSellerToken(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("user_integrations")
    .select("access_token, expires_at")
    .eq("platform", "mercadolivre")
    .not("access_token", "is", null)
    .gt("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(1);
  const tok = data?.[0]?.access_token ?? null;
  if (!tok) console.warn("[sync-trending] nenhum ML seller token válido em user_integrations");
  return tok;
}

type HighlightEntry = { id: string; position: number; type: string };

async function fetchHighlights(categoryId: string, token: string): Promise<HighlightEntry[]> {
  const res = await fetch(
    `https://api.mercadolibre.com/highlights/MLB/category/${categoryId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    console.error(`[sync-trending] highlights ${categoryId} status:`, res.status);
    return [];
  }
  const data = await res.json();
  const arr = (data?.content ?? []) as HighlightEntry[];
  return arr.filter((x) => x.type === "PRODUCT").slice(0, TOP_N_PER_CATEGORY);
}

type MlProduct = {
  id: string;
  name: string;
  pictures?: Array<{ url?: string }>;
  attributes?: Array<{ id?: string; value_name?: string }>;
  domain_id?: string;
};

async function fetchProduct(productId: string, token: string): Promise<MlProduct | null> {
  const res = await fetch(`https://api.mercadolibre.com/products/${productId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return await res.json();
}

type ProductItem = {
  item_id: string;
  price: number;
  currency_id: string;
  permalink?: string;
};

async function fetchProductItems(productId: string, token: string): Promise<ProductItem[]> {
  const res = await fetch(
    `https://api.mercadolibre.com/products/${productId}/items?limit=20`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  const rows = (data?.results ?? []) as any[];
  return rows
    .filter((r) => r.currency_id === "BRL" && typeof r.price === "number" && r.price > 0)
    .map((r) => ({ item_id: r.item_id, price: r.price, currency_id: r.currency_id, permalink: r.permalink }));
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return 0;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

function extractBrand(p: MlProduct): string | null {
  const a = p.attributes?.find((x) => x.id === "BRAND");
  return a?.value_name ?? null;
}

function extractImages(p: MlProduct): string[] {
  return (p.pictures ?? [])
    .map((x) => (x.url ?? "").replace("http://", "https://"))
    .filter(Boolean);
}

// Estima vendas do mês pela posição no ranking (fallback quando não há histórico).
// Posição 1 = topo → ~1000; decai suavemente.
function estimateMonthlyFromRank(rank: number): number {
  return Math.max(50, Math.round(1200 * Math.pow(0.9, rank - 1)));
}

// ---- AliExpress ----------------------------------------------------------
async function aliexpressSign(params: Record<string, string>, secret: string): Promise<string> {
  const sorted = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(sorted));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

type AliCandidate = { product_id: string; title: string; price_usd: number; url: string };

async function searchAliexpress(keywords: string): Promise<AliCandidate[]> {
  const appKey = Deno.env.get("ALIEXPRESS_APP_KEY") ?? "531606";
  const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET") ?? "";
  if (!appSecret) return [];
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  const params: Record<string, string> = {
    method: "aliexpress.affiliate.product.query",
    app_key: appKey,
    timestamp,
    format: "json",
    v: "2.0",
    sign_method: "hmac-sha256",
    keywords,
    target_currency: "USD",
    target_language: "EN",
    tracking_id: "wuilli",
    page_no: "1",
    page_size: "20",
    sort: "SALE_PRICE_ASC",
  };
  params.sign = await aliexpressSign(params, appSecret);
  const url = new URL("https://api-sg.aliexpress.com/sync");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const arr = data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];
    return arr.map((p: any) => ({
      product_id: String(p.product_id ?? p.item_id ?? ""),
      title: String(p.product_title ?? ""),
      price_usd: parseFloat(p.target_sale_price ?? p.sale_price ?? "0"),
      url: p.promotion_link ?? p.product_detail_url ?? "",
    })).filter((c: AliCandidate) => c.product_id && c.price_usd > 0);
  } catch (e) {
    console.error("[sync-trending] AliExpress search error:", e);
    return [];
  }
}

function pickBestAliMatch(mlTitle: string, candidates: AliCandidate[]): { c: AliCandidate; score: number } | null {
  let best: { c: AliCandidate; score: number } | null = null;
  for (const c of candidates) {
    const s = similarity(mlTitle, c.title);
    if (!best || s > best.score) best = { c, score: s };
  }
  return best;
}

// ---- Handler -------------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const started = Date.now();
  const summary: Record<string, any> = { categories: {}, errors: [] };

  const token = await getMlSellerToken(supabase);
  if (!token) {
    return new Response(JSON.stringify({
      ok: false,
      error: "no_ml_seller_token",
      hint: "Nenhum access_token válido em user_integrations (platform=mercadolivre). Reconecte um vendedor ML.",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  console.log("[sync-trending] ML seller token: ok");

  const todayIso = new Date().toISOString().slice(0, 10);

  for (const [catLabel, mlCatId] of Object.entries(ML_CATEGORIES)) {
    try {
      const highlights = await fetchHighlights(mlCatId, token);
      if (highlights.length === 0) {
        summary.categories[catLabel] = { count: 0 };
        continue;
      }

      const aliCandidates = await searchAliexpress(ALI_KEYWORDS[catLabel] ?? catLabel);
      let saved = 0, staged = 0;

      for (const hi of highlights) {
        try {
          const prod = await fetchProduct(hi.id, token);
          if (!prod || !prod.name) continue;

          const items = await fetchProductItems(hi.id, token);
          const prices = items.map((i) => i.price);
          const sellPriceBrl = +median(prices).toFixed(2);
          if (sellPriceBrl <= 0) continue;

          const permalink = items[0]?.permalink ?? `https://www.mercadolivre.com.br/p/${hi.id}`;
          const images = extractImages(prod);
          const brand = extractBrand(prod);
          const soldMonthEstimate = estimateMonthlyFromRank(hi.position);

          let match = pickBestAliMatch(prod.name, aliCandidates);

          // Fallback: se match fraco, busca no AliExpress usando os tokens do próprio produto ML.
          if (!match || match.score < SIM_THRESHOLD_ALTO) {
            const tokens = normalize(prod.name).slice(0, 3).join(" ");
            if (tokens.length >= 4) {
              const perProduct = await searchAliexpress(tokens);
              const alt = pickBestAliMatch(prod.name, perProduct);
              if (alt && (!match || alt.score > match.score)) match = alt;
            }
          }

          if (!match || match.score < SIM_THRESHOLD_MEDIO) {
            await supabase.from("trending_products_staging").insert({
              ml_item_id: hi.id,
              ml_permalink: permalink,
              ali_product_id: match?.c.product_id ?? null,
              ali_url: match?.c.url ?? null,
              title: prod.name,
              image: images[0] ?? null,
              images,
              category: catLabel,
              brand,
              sell_price_brl: sellPriceBrl,
              ali_cost_usd: match?.c.price_usd ?? null,
              sold_quantity_total: soldMonthEstimate,
              match_confidence: "baixo",
              similarity_score: match?.score ?? 0,
              reason: match ? "similarity_below_threshold" : "no_ali_candidate",
            });
            staged++;
            continue;
          }

          const confidence = match.score >= SIM_THRESHOLD_ALTO ? "alto" : "medio";
          const aliCostUsd = match.c.price_usd;
          const costBrlRaw = aliCostUsd * USD_TO_BRL;
          const costPriceBrl = +(costBrlRaw * (1 + IMPORT_COST_BUFFER_PERCENT / 100)).toFixed(2);
          const marginPercent = sellPriceBrl > 0
            ? +(((sellPriceBrl - costPriceBrl) / sellPriceBrl) * 100).toFixed(2)
            : 0;
          const markup = costPriceBrl > 0 ? +(sellPriceBrl / costPriceBrl).toFixed(3) : 0;

          const { data: upserted, error: upErr } = await supabase
            .from("trending_products_real")
            .upsert({
              ml_item_id: hi.id,
              ml_permalink: permalink,
              ali_product_id: match.c.product_id,
              ali_url: match.c.url,
              title: prod.name,
              image: images[0] ?? null,
              images,
              category: catLabel,
              brand,
              sell_price_brl: sellPriceBrl,
              ali_cost_usd: aliCostUsd,
              cost_price_brl: costPriceBrl,
              margin_percent: marginPercent,
              markup,
              sold_quantity_total: soldMonthEstimate,
              sold_quantity_month_estimate: soldMonthEstimate,
              rating: null,
              match_confidence: confidence,
              updated_at: new Date().toISOString(),
            }, { onConflict: "ml_item_id" })
            .select("id, sold_quantity_total")
            .maybeSingle();

          if (upErr || !upserted) {
            console.error("[sync-trending] upsert error:", upErr?.message);
            summary.errors.push({ ml_item_id: hi.id, err: upErr?.message });
            continue;
          }

          await supabase.from("trending_products_history").upsert({
            trending_product_id: upserted.id,
            snapshot_date: todayIso,
            sell_price_brl: sellPriceBrl,
            sold_quantity_total: soldMonthEstimate,
            margin_percent: marginPercent,
          }, { onConflict: "trending_product_id,snapshot_date" });

          saved++;
        } catch (perItem) {
          console.error("[sync-trending] item error:", perItem);
          summary.errors.push({ ml_item_id: hi.id, err: String(perItem) });
        }
      }
      summary.categories[catLabel] = { saved, staged, total: highlights.length };
      console.log(`[sync-trending] ${catLabel}: saved=${saved} staged=${staged} total=${highlights.length}`);
    } catch (catErr) {
      console.error(`[sync-trending] categoria ${catLabel} falhou:`, catErr);
      summary.errors.push({ category: catLabel, err: String(catErr) });
    }
  }

  summary.duration_ms = Date.now() - started;
  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
