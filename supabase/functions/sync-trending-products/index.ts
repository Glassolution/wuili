// Sync diário: cruza os produtos mais vendidos no Mercado Livre (por categoria)
// com o custo equivalente no AliExpress e grava em `trending_products_real` +
// snapshot em `trending_products_history`.
//
// - ML: usa token de aplicação (client_credentials) — NÃO usa OAuth de vendedor.
// - AliExpress: usa Affiliate Open Platform (mesma assinatura HMAC-SHA256 já
//   usada em `aliexpress-products`).
//
// Secrets esperados (Deno.env):
//   ML_CLIENT_ID, ML_CLIENT_SECRET
//   ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Buffer configurável de frete/imposto aplicado sobre o custo AliExpress convertido.
// NÃO é valor fiscal exato — é estimativa. Ajustar aqui quando necessário.
const IMPORT_COST_BUFFER_PERCENT = 30;
const USD_TO_BRL = 5.0;
const TOP_N_PER_CATEGORY = 20;
const SIM_THRESHOLD_MEDIO = 0.35;
const SIM_THRESHOLD_ALTO = 0.55;

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

// AliExpress keyword mapping por categoria.
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

async function getMlAppToken(): Promise<string | null> {
  const clientId = Deno.env.get("ML_CLIENT_ID");
  const clientSecret = Deno.env.get("ML_CLIENT_SECRET");
  if (!clientId || !clientSecret) return null;
  try {
    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!res.ok) {
      console.error("[sync-trending] ML token status:", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    return data.access_token ?? null;
  } catch (e) {
    console.error("[sync-trending] ML token error:", e);
    return null;
  }
}

type MlItem = {
  id: string;
  title: string;
  price: number;
  permalink: string;
  thumbnail: string;
  sold_quantity?: number;
  attributes?: Array<{ id?: string; value_name?: string }>;
  pictures?: Array<{ url?: string; secure_url?: string }>;
};

async function fetchMlTopByCategory(categoryId: string, token: string | null): Promise<MlItem[]> {
  const url = `https://api.mercadolibre.com/sites/MLB/search?category=${categoryId}&sort=sold_quantity_desc&limit=${TOP_N_PER_CATEGORY}`;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    console.error(`[sync-trending] ML search ${categoryId} status:`, res.status);
    return [];
  }
  const data = await res.json();
  return (data.results ?? []) as MlItem[];
}

async function fetchMlItemDetails(ids: string[]): Promise<Record<string, MlItem>> {
  if (ids.length === 0) return {};
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 20) chunks.push(ids.slice(i, i + 20));
  const out: Record<string, MlItem> = {};
  for (const chunk of chunks) {
    try {
      const res = await fetch(`https://api.mercadolibre.com/items?ids=${chunk.join(",")}`);
      if (!res.ok) continue;
      const arr = await res.json();
      for (const row of arr) {
        if (row?.code === 200 && row?.body?.id) out[row.body.id] = row.body;
      }
    } catch (e) {
      console.error("[sync-trending] ML items details error:", e);
    }
  }
  return out;
}

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

function extractBrand(item: MlItem): string | null {
  const a = item.attributes?.find((x) => x.id === "BRAND");
  return a?.value_name ?? null;
}

function extractImages(item: MlItem): string[] {
  const pics = (item.pictures ?? []).map((p) => (p.secure_url || p.url || "").replace("http://", "https://")).filter(Boolean);
  if (pics.length > 0) return pics;
  return item.thumbnail ? [item.thumbnail.replace("http://", "https://")] : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const started = Date.now();
  const summary: Record<string, any> = { categories: {}, errors: [] };
  const token = await getMlAppToken();
  console.log("[sync-trending] ML app token:", token ? "ok" : "missing");

  const todayIso = new Date().toISOString().slice(0, 10);

  for (const [catLabel, mlCatId] of Object.entries(ML_CATEGORIES)) {
    try {
      const results = await fetchMlTopByCategory(mlCatId, token);
      if (results.length === 0) { summary.categories[catLabel] = { count: 0 }; continue; }

      // Enriquece com pictures (a busca não devolve galeria completa).
      const details = await fetchMlItemDetails(results.map((r) => r.id));
      const aliCandidates = await searchAliexpress(ALI_KEYWORDS[catLabel] ?? catLabel);

      let saved = 0, staged = 0;
      for (const it of results) {
        try {
          const full = details[it.id] ?? it;
          const match = pickBestAliMatch(it.title, aliCandidates);
          if (!match || match.score < SIM_THRESHOLD_MEDIO) {
            // Baixa confiança → staging para auditoria manual, não expor.
            await supabase.from("trending_products_staging").insert({
              ml_item_id: it.id,
              ml_permalink: it.permalink,
              ali_product_id: match?.c.product_id ?? null,
              ali_url: match?.c.url ?? null,
              title: it.title,
              image: (extractImages(full)[0] ?? null),
              images: extractImages(full),
              category: catLabel,
              brand: extractBrand(full),
              sell_price_brl: it.price,
              ali_cost_usd: match?.c.price_usd ?? null,
              sold_quantity_total: it.sold_quantity ?? 0,
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
          const sellPriceBrl = +Number(it.price ?? 0).toFixed(2);
          const marginPercent = sellPriceBrl > 0
            ? +(((sellPriceBrl - costPriceBrl) / sellPriceBrl) * 100).toFixed(2)
            : 0;
          const markup = costPriceBrl > 0 ? +(sellPriceBrl / costPriceBrl).toFixed(3) : 0;
          const images = extractImages(full);

          // Upsert principal.
          const { data: upserted, error: upErr } = await supabase
            .from("trending_products_real")
            .upsert({
              ml_item_id: it.id,
              ml_permalink: it.permalink,
              ali_product_id: match.c.product_id,
              ali_url: match.c.url,
              title: it.title,
              image: images[0] ?? null,
              images,
              category: catLabel,
              brand: extractBrand(full),
              sell_price_brl: sellPriceBrl,
              ali_cost_usd: aliCostUsd,
              cost_price_brl: costPriceBrl,
              margin_percent: marginPercent,
              markup,
              sold_quantity_total: it.sold_quantity ?? 0,
              rating: null,
              match_confidence: confidence,
              updated_at: new Date().toISOString(),
            }, { onConflict: "ml_item_id" })
            .select("id, sold_quantity_total")
            .maybeSingle();

          if (upErr || !upserted) {
            console.error("[sync-trending] upsert error:", upErr?.message);
            summary.errors.push({ ml_item_id: it.id, err: upErr?.message });
            continue;
          }

          // Snapshot diário (idempotente via UNIQUE(product_id, snapshot_date)).
          await supabase.from("trending_products_history").upsert({
            trending_product_id: upserted.id,
            snapshot_date: todayIso,
            sell_price_brl: sellPriceBrl,
            sold_quantity_total: it.sold_quantity ?? 0,
            margin_percent: marginPercent,
          }, { onConflict: "trending_product_id,snapshot_date" });

          // Estima vendas do mês: diff vs snapshot ~30 dias atrás.
          const { data: past } = await supabase
            .from("trending_products_history")
            .select("sold_quantity_total, snapshot_date")
            .eq("trending_product_id", upserted.id)
            .lte("snapshot_date", new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10))
            .order("snapshot_date", { ascending: false })
            .limit(1);

          let monthEstimate: number | null = null;
          if (past && past.length > 0 && past[0].sold_quantity_total != null) {
            monthEstimate = Math.max(0, (it.sold_quantity ?? 0) - past[0].sold_quantity_total);
          }
          await supabase.from("trending_products_real")
            .update({ sold_quantity_month_estimate: monthEstimate })
            .eq("id", upserted.id);

          saved++;
        } catch (perItem) {
          console.error("[sync-trending] item error:", perItem);
          summary.errors.push({ ml_item_id: it.id, err: String(perItem) });
        }
      }
      summary.categories[catLabel] = { saved, staged, total: results.length };
      console.log(`[sync-trending] ${catLabel}: saved=${saved} staged=${staged} total=${results.length}`);
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
