// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ALI_API_URL = "https://api-sg.aliexpress.com/sync";
const USD_TO_BRL = 5.0;
const PAGE_SIZE = 50; // alvo: 50 produtos por keyword
const RATE_LIMIT_DELAY_MS = 400; // ~2.5 req/s
const MAX_PAGES_PER_KEYWORD = 5; // fallback quando API limita pageSize < 50
const MAX_DETAIL_FETCHES = 300; // enriquecer todos os produtos coletados para garantir galeria completa (≥3 fotos)
const DETAIL_BATCH_SIZE = 6; // product.get em paralelo por lote (Promise.all)
const DETAIL_BATCH_DELAY_MS = 400; // pausa entre lotes para respeitar rate-limit AliExpress
const MIN_IMAGES_REQUIRED = 3; // regra fixa: produto AliExpress só é publicável com ≥ 3 fotos
const STUCK_RUN_MINUTES = 15; // execuções "running" mais antigas que isso são marcadas como failed no boot

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Busca detalhes reais (galeria completa, descrição, vendas, avaliações) de um produto AliExpress. */
async function fetchProductDetail(
  productId: string,
  ctx: { appKey: string; appSecret: string; accessToken: string },
): Promise<{
  images: string[];
  description: string | null;
  orders_count: number | null;
  rating: number | null;
  reviews_count: number | null;
} | null> {
  try {
    const json = await callAliExpress(
      "aliexpress.ds.product.get",
      {
        product_id: productId,
        ship_to_country: "BR",
        target_currency: "BRL",
        target_language: "pt",
        local: "pt_BR",
      },
      ctx,
    );
    const result =
      json?.aliexpress_ds_product_get_response?.result ??
      json?.result ??
      json?.data ??
      {};
    const multimedia = result.ae_multimedia_info_dto ?? result.multimedia_info ?? {};
    const base = result.ae_item_base_info_dto ?? result.base_info ?? {};
    const stats = result.ae_item_sku_info_dtos ?? {};

    // Galeria: pode vir como string separada por ";" ou array
    let images: string[] = [];
    const rawImgs = multimedia.image_urls ?? multimedia.imageUrls ?? multimedia.imageUrl;
    if (typeof rawImgs === "string") {
      images = rawImgs.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean);
    } else if (Array.isArray(rawImgs)) {
      images = rawImgs.filter(Boolean).map(String);
    }

    const description: string | null =
      base.detail ??
      base.description ??
      result.description ??
      null;

    const ordersRaw =
      base.sales_count ??
      base.sale_count ??
      base.orders ??
      stats?.sales_count ??
      null;
    const orders_count = ordersRaw != null
      ? (() => {
          const n = parseInt(String(ordersRaw).replace(/[+,\s]/g, ""), 10);
          return Number.isFinite(n) ? n : null;
        })()
      : null;

    const ratingRaw = base.avg_evaluation_rating ?? base.avg_rating ?? base.evaluation_rate ?? null;
    const rating = ratingRaw != null
      ? (() => {
          const s = String(ratingRaw);
          if (s.endsWith("%")) return +(parseFloat(s) / 20).toFixed(2);
          const n = parseFloat(s);
          return Number.isFinite(n) ? +n.toFixed(2) : null;
        })()
      : null;

    const reviewsRaw = base.evaluation_count ?? base.reviews_count ?? null;
    const reviews_count = reviewsRaw != null
      ? (() => {
          const n = parseInt(String(reviewsRaw).replace(/[+,\s]/g, ""), 10);
          return Number.isFinite(n) ? n : null;
        })()
      : null;

    return { images, description, orders_count, rating, reviews_count };
  } catch (err) {
    console.warn(
      `[aliexpress-sync-top-products] product.get falhou para ${productId}:`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Assinatura HMAC-SHA256 padrão AliExpress Open Platform. */
function signParams(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort();
  const base = sorted.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", secret)
    .update(base)
    .digest("hex")
    .toUpperCase();
}

async function callAliExpress(
  method: string,
  bizParams: Record<string, string>,
  ctx: { appKey: string; appSecret: string; accessToken: string },
): Promise<any> {
  const sysParams: Record<string, string> = {
    app_key: ctx.appKey,
    method,
    access_token: ctx.accessToken,
    sign_method: "sha256",
    timestamp: String(Date.now()),
    ...bizParams,
  };
  sysParams.sign = signParams(sysParams, ctx.appSecret);

  const body = new URLSearchParams(sysParams);
  console.log(
    `[aliexpress-sync-top-products] → chamando ${method} params=`,
    JSON.stringify({ ...bizParams }),
  );
  const res = await fetch(ALI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  console.log(
    `[aliexpress-sync-top-products] ← ${method} status=${res.status} body(raw)=`,
    text.slice(0, 4000),
  );
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`AliExpress resposta inválida (${res.status}): ${text.slice(0, 200)}`);
  }
  if (json.error_response) {
    const e = json.error_response;
    throw new Error(`AliExpress ${e.code}: ${e.msg || e.sub_msg || "erro desconhecido"}`);
  }
  return json;
}

/** Assinatura HMAC-SHA256 para endpoints /rest/* (inclui apiName no início). */
function signRest(apiName: string, params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort();
  const base = apiName + sorted.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", secret).update(base).digest("hex").toUpperCase();
}

async function refreshAccessToken(
  refreshToken: string,
  appKey: string,
  appSecret: string,
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const apiName = "/auth/token/refresh";
  const params: Record<string, string> = {
    app_key: appKey,
    refresh_token: refreshToken,
    sign_method: "sha256",
    timestamp: String(Date.now()),
  };
  const sign = signRest(apiName, params, appSecret);
  const res = await fetch(`https://api-sg.aliexpress.com/rest${apiName}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, sign }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Falha ao renovar token AliExpress: ${res.status} ${text}`);
  }
  const data = JSON.parse(text);
  const accessToken = data.access_token ?? data.data?.access_token;
  if (!accessToken) throw new Error(`Refresh AliExpress sem access_token: ${text}`);
  return {
    access_token: accessToken,
    refresh_token: data.refresh_token ?? data.data?.refresh_token ?? refreshToken,
    expires_in: Number(data.expires_in ?? data.data?.expires_in ?? 86400),
  };
}


/** Normaliza resposta variada da API em produtos padronizados. */
function normalizeProducts(json: any, categoryId: string): any[] {
  const products: any[] =
    json?.aliexpress_ds_recommend_feed_get_response?.result?.products?.traffic_product_d_t_o ??
    json?.aliexpress_ds_text_search_response?.data?.products?.selection_search_product ??
    json?.result?.products?.traffic_product_d_t_o ??
    [];

  return (Array.isArray(products) ? products : [products]).filter(Boolean).map((p) => {
    const externalId = String(
      p.product_id ?? p.item_id ?? p.itemId ?? p.productId ?? "",
    );
    const title = String(p.product_title ?? p.subject ?? p.title ?? "").trim();
    const image =
      p.product_main_image_url ??
      p.image_url ??
      p.product_image_url ??
      p.mainImageUrl ??
      null;
    const images = Array.isArray(p.product_small_image_urls?.string)
      ? p.product_small_image_urls.string
      : image
        ? [image]
        : [];

    const salePriceUsd = Number(
      p.target_sale_price ?? p.sale_price ?? p.app_sale_price ?? p.price ?? 0,
    );
    const originalPriceUsd = Number(
      p.target_original_price ?? p.original_price ?? salePriceUsd,
    );
    const cost = +(salePriceUsd * USD_TO_BRL).toFixed(2);
    const suggested = +(cost * 2).toFixed(2); // margem padrão 100%
    const original = +(originalPriceUsd * USD_TO_BRL).toFixed(2);
    const margin = suggested > 0 ? +(((suggested - cost) / suggested) * 100).toFixed(2) : 0;

    return {
      source: "aliexpress",
      external_id: externalId,
      title,
      images,
      cost_price: cost,
      suggested_price: suggested,
      original_price: original,
      margin_percent: margin,
      rating: p.evaluate_rate ? Number(String(p.evaluate_rate).replace("%", "")) / 20 : Number(p.avg_rating ?? 0) || null,
      orders_count: Number(p.lastest_volume ?? p.sale_count ?? p.orders ?? 0) || 0,
      stock_quantity: Number(p.stock_quantity ?? 999) || 999,
      product_url: p.product_detail_url ?? p.itemUrl ?? null,
      aliexpress_category_id: categoryId,
      in_top_50: true,
      is_active: true,
      is_blocked: true, // AliExpress pausado no catálogo — mantemos oculto até reativarmos a fonte

      scraped_at: new Date().toISOString(),
    };
  }).filter((p) => p.external_id && p.title);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(
    "[aliexpress-sync-top-products] iniciando execução, método:",
    req.method,
    "url:",
    req.url,
  );


  const startedAt = Date.now();
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Detecta trigger
  let triggeredBy = "cron";
  try {
    const body = await req.clone().json().catch(() => ({}));
    if (body?.triggered_by === "manual") triggeredBy = "manual";
  } catch { /* ignore */ }

  // Auto-recovery: marca como 'failed' qualquer execução anterior travada em 'running'
  // há mais de STUCK_RUN_MINUTES (timeout de wall-time do runtime sem chegar em finalize()).
  try {
    const cutoff = new Date(Date.now() - STUCK_RUN_MINUTES * 60_000).toISOString();
    const { data: stuck, error: stuckErr } = await supabase
      .from("aliexpress_sync_log")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: `auto-recovery: run travado em 'running' por mais de ${STUCK_RUN_MINUTES} min sem finalize()`,
      })
      .eq("status", "running")
      .lt("started_at", cutoff)
      .select("id");
    if (stuckErr) {
      console.warn("[aliexpress-sync-top-products] falha ao limpar runs travados:", stuckErr.message);
    } else if (stuck && stuck.length > 0) {
      console.log(
        `[aliexpress-sync-top-products] auto-recovery: ${stuck.length} run(s) travado(s) marcado(s) como failed`,
      );
    }
  } catch (e) {
    console.warn("[aliexpress-sync-top-products] auto-recovery falhou:", e instanceof Error ? e.message : e);
  }

  // Cria log
  const { data: logRow } = await supabase
    .from("aliexpress_sync_log")
    .insert({ status: "running", triggered_by: triggeredBy })
    .select()
    .single();
  const logId = logRow?.id as string | undefined;

  const patchLog = async (patch: Record<string, unknown>) => {
    if (!logId) return;
    await supabase.from("aliexpress_sync_log").update(patch).eq("id", logId);
  };

  const finalize = async (patch: Record<string, unknown>) => {
    if (!logId) return;
    await supabase
      .from("aliexpress_sync_log")
      .update({
        ...patch,
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
      })
      .eq("id", logId);
  };

  try {
    const appKey = Deno.env.get("ALIEXPRESS_APP_KEY");
    const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET");
    if (!appKey || !appSecret) throw new Error("Credenciais AliExpress ausentes (ALIEXPRESS_APP_KEY/SECRET)");

    // Busca token do primeiro admin com token válido
    const { data: adminProfile, error: profileErr } = await supabase
      .from("profiles")
      .select("user_id, aliexpress_access_token, aliexpress_refresh_token, aliexpress_token_expires_at")
      .eq("is_admin", true)
      .not("aliexpress_access_token", "is", null)
      .order("aliexpress_token_expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (profileErr) throw profileErr;
    if (!adminProfile?.aliexpress_access_token) {
      const msg = "Nenhum admin conectado ao AliExpress. Conecte via OAuth primeiro.";
      await finalize({ status: "failed", error_count: 1, error_message: msg });
      return new Response(
        JSON.stringify({ ok: false, status: "not_connected", error: msg }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let accessToken = adminProfile.aliexpress_access_token as string;
    const refreshToken = adminProfile.aliexpress_refresh_token as string | null;
    const expiresAt = adminProfile.aliexpress_token_expires_at
      ? new Date(adminProfile.aliexpress_token_expires_at).getTime()
      : 0;

    console.log(
      "[aliexpress-sync-top-products] admin token OK user_id=",
      adminProfile.user_id,
      "expiresAt=",
      adminProfile.aliexpress_token_expires_at,
      "token_prefix=",
      accessToken.slice(0, 8),
      "token_len=",
      accessToken.length,
    );


    if (expiresAt && expiresAt < Date.now() + 60_000 && refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken, appKey, appSecret);
      accessToken = refreshed.access_token;
      await supabase
        .from("profiles")
        .update({
          aliexpress_access_token: refreshed.access_token,
          aliexpress_refresh_token: refreshed.refresh_token,
          aliexpress_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("user_id", adminProfile.user_id);
    }

    // Carrega keywords ativas (category_mapping) — cai em fallback quando vazio
    let keywords: string[] = [];
    const keywordToVeloCategory = new Map<string, string>();
    const keywordToAliCategoryId = new Map<string, string | null>();
    let testKeywordOverride: string | null = null;
    try {
      const bodyClone = await req.clone().json().catch(() => ({} as any));
      if (bodyClone?.keyword && typeof bodyClone.keyword === "string") {
        testKeywordOverride = bodyClone.keyword.trim();
      }
    } catch { /* ignore */ }

    if (testKeywordOverride) {
      keywords = [testKeywordOverride];
      console.log(`[aliexpress-sync-top-products] modo teste: keyword única="${testKeywordOverride}"`);
    } else {
      const { data: mappings } = await supabase
        .from("category_mapping")
        .select("velo_category, aliexpress_category_name, aliexpress_category_id")
        .eq("active", true);
      for (const m of mappings ?? []) {
        const kw = String(
          (m as any).aliexpress_category_name ??
            (m as any).aliexpress_category_id ??
            (m as any).velo_category ??
            "",
        ).trim();
        if (!kw) continue;
        keywords.push(kw);
        const velo = String((m as any).velo_category ?? "").trim();
        const aliId = String((m as any).aliexpress_category_id ?? "").trim();
        if (velo) {
          keywordToVeloCategory.set(kw, velo);
          keywordToAliCategoryId.set(kw, aliId || null);
        }
      }
      if (keywords.length === 0) {
        keywords = ["eletrônicos"];
        console.log(
          "[aliexpress-sync-top-products] nenhum mapping ativo — usando fallback keyword=\"eletrônicos\"",
        );
      }
    }

    console.log(
      `[aliexpress-sync-top-products] keywords a processar (${keywords.length}):`,
      JSON.stringify(keywords),
    );

    let productsNew = 0;
    let productsUpdated = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const currentTopIds = new Set<string>();
    const currentTitles = new Set<string>();
    const detailed: any[] = [];

    // PASSO 1 — Para cada keyword, chama aliexpress.ds.text.search paginando até PAGE_SIZE
    for (const keyword of keywords) {
      const veloCategoryForKeyword = keywordToVeloCategory.get(keyword) ?? null;
      const aliCategoryIdForKeyword = keywordToAliCategoryId.get(keyword) ?? null;
      if (!veloCategoryForKeyword) {
        console.warn(
          `[aliexpress-sync-top-products] WARN keyword="${keyword}" sem velo_category no category_mapping — produtos serão inseridos com category=null`,
        );
      }
      let collectedForKeyword = 0;
      let pageIndex = 1;
      let apiPageSizeCap = PAGE_SIZE;

      while (collectedForKeyword < PAGE_SIZE && pageIndex <= MAX_PAGES_PER_KEYWORD) {
        const requestedPageSize = Math.min(
          apiPageSizeCap,
          PAGE_SIZE - collectedForKeyword,
        );
        console.log(
          `[aliexpress-sync-top-products] → text.search keyword="${keyword}" pageIndex=${pageIndex} pageSize=${requestedPageSize}`,
        );
        let json: any;
        try {
          json = await callAliExpress(
            "aliexpress.ds.text.search",
            {
              keyWord: keyword,
              local: "pt_BR",
              countryCode: "BR",
              currency: "BRL",
              sortBy: "orders,desc",
              pageSize: String(requestedPageSize),
              pageIndex: String(pageIndex),
            },
            { appKey, appSecret, accessToken },
          );
        } catch (err) {
          errorCount++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`[keyword=${keyword} p=${pageIndex}] ${msg}`);
          console.error(
            `[aliexpress-sync-top-products] falha text.search keyword="${keyword}" pageIndex=${pageIndex}:`,
            msg,
          );
          await sleep(RATE_LIMIT_DELAY_MS);
          break;
        }

        // Detecta pageSize efetivo retornado pela API para ajustar cap.
        const respPageSize = Number(
          json?.aliexpress_ds_text_search_response?.data?.pageSize ??
            json?.aliexpress_ds_text_search_response?.data?.page_size ??
            json?.data?.pageSize ??
            0,
        );
        if (Number.isFinite(respPageSize) && respPageSize > 0 && respPageSize < apiPageSizeCap) {
          apiPageSizeCap = respPageSize;
          console.log(
            `[aliexpress-sync-top-products] API limitou pageSize efetivo=${respPageSize} para keyword="${keyword}"`,
          );
        }

        // Extrai lista de produtos, tolerante a envelopes distintos
        const products: any[] =
          json?.aliexpress_ds_text_search_response?.data?.products?.selection_search_product ??
          json?.aliexpress_ds_text_search_response?.data?.products ??
          json?.data?.products?.selection_search_product ??
          json?.data?.products ??
          json?.result?.products ??
          [];
        const list = Array.isArray(products) ? products : [products].filter(Boolean);
        console.log(
          `[aliexpress-sync-top-products] ← keyword="${keyword}" pageIndex=${pageIndex} total_retornado=${list.length}`,
        );

        if (list.length === 0) {
          await sleep(RATE_LIMIT_DELAY_MS);
          break; // sem mais itens
        }

        for (const p of list) {
          const externalId = String(
            p.itemId ?? p.item_id ?? p.product_id ?? p.productId ?? "",
          );
          const title = String(p.title ?? p.product_title ?? p.subject ?? "").trim();
          if (!externalId || !title) continue;
          if (currentTopIds.has(`aliexpress:${externalId}`)) continue; // dedup entre keywords/páginas
          const titleKey = title.toLowerCase();
          if (currentTitles.has(titleKey)) continue; // dedup por título (variantes com mesmo nome)


          const image =
            p.itemMainPic ??
            p.item_main_pic ??
            p.product_main_image_url ??
            p.image_url ??
            null;
          const salePriceBrl = Number(
            p.targetSalePrice ?? p.target_sale_price ?? p.salePrice ?? p.sale_price ?? 0,
          );
          const originalPriceBrl = Number(
            p.targetOriginalPrice ?? p.target_original_price ?? p.originalPrice ?? p.original_price ?? salePriceBrl,
          );
          const cost = +Number(salePriceBrl).toFixed(2);
          const suggested = +(cost * 2).toFixed(2);
          const original = +Number(originalPriceBrl).toFixed(2);
          const margin =
            suggested > 0 ? +(((suggested - cost) / suggested) * 100).toFixed(2) : 0;

          detailed.push({
            source: "aliexpress",
            supplier_name: "AliExpress",
            external_id: externalId,
            title,
            images: image ? [image] : [],
            cost_price: cost,
            suggested_price: suggested,
            original_price: original,
            margin_percent: margin,
            rating: p.score ? Number(p.score) : null,
            orders_count: (() => {
              const raw = String(p.orders ?? p.sales_count ?? "0").replace(/[+,\s]/g, "");
              const n = parseInt(raw, 10);
              return Number.isFinite(n) ? n : 0;
            })(),
            stock_quantity: 999,
            product_url:
              p.itemUrl ??
              p.product_detail_url ??
              `https://www.aliexpress.com/item/${externalId}.html`,
            aliexpress_category_id: aliCategoryIdForKeyword,
            category: veloCategoryForKeyword,
            brand: null,
            in_top_50: true,
            is_active: true,
            is_blocked: false,
            scraped_at: new Date().toISOString(),
          });
          currentTopIds.add(`aliexpress:${externalId}`);
          currentTitles.add(titleKey);
          collectedForKeyword++;
          if (collectedForKeyword >= PAGE_SIZE) break;
        }


        await sleep(RATE_LIMIT_DELAY_MS);

        // Se a API devolveu menos que o pedido, não há próxima página útil.
        if (list.length < requestedPageSize) break;
        pageIndex++;
      }

      console.log(
        `[aliexpress-sync-top-products] keyword="${keyword}" coletados=${collectedForKeyword}`,
      );

      // Progresso incremental por keyword (facilita diagnóstico se travar depois).
      await patchLog({
        categories_processed: keywords.indexOf(keyword) + 1,
        error_count: errorCount,
        error_message: errors.slice(0, 5).join(" | ") || null,
      });
    }

    console.log(
      `[aliexpress-sync-top-products] agregado: ${detailed.length} produtos únicos em ${keywords.length} keywords`,
    );

    // PASSO 1.5 — Enriquecimento em PARALELO (batches de DETAIL_BATCH_SIZE).
    // A versão sequencial anterior estourava o wall-time do runtime com MAX_DETAIL_FETCHES=300.
    const enrichLimit = Math.min(detailed.length, MAX_DETAIL_FETCHES);
    const enrichStart = Date.now();
    console.log(
      `[aliexpress-sync-top-products] enriquecendo ${enrichLimit} produtos via aliexpress.ds.product.get (batches de ${DETAIL_BATCH_SIZE})`,
    );
    let enrichedCount = 0;
    let rateLimitHits = 0;
    for (let i = 0; i < enrichLimit; i += DETAIL_BATCH_SIZE) {
      const slice = detailed.slice(i, Math.min(i + DETAIL_BATCH_SIZE, enrichLimit));
      const results = await Promise.all(
        slice.map((item) =>
          fetchProductDetail(item.external_id, { appKey, appSecret, accessToken })
            .then((detail) => ({ item, detail, err: null as unknown }))
            .catch((err) => ({ item, detail: null, err })),
        ),
      );
      for (const { item, detail, err } of results) {
        if (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (/rate.?limit|too many|frequency|qps/i.test(msg)) rateLimitHits++;
          continue;
        }
        if (detail) {
          if (detail.images.length > 0) item.images = detail.images;
          if (detail.orders_count != null) item.orders_count = detail.orders_count;
          if (detail.rating != null) item.rating = detail.rating;
          if (detail.reviews_count != null) item.reviews_count = detail.reviews_count;
          enrichedCount++;
        }
      }
      const done = Math.min(i + DETAIL_BATCH_SIZE, enrichLimit);
      console.log(
        `[aliexpress-sync-top-products] enrich progresso ${done}/${enrichLimit} (ok=${enrichedCount}, rateLimit=${rateLimitHits}, elapsed=${Date.now() - enrichStart}ms)`,
      );
      if (((i / DETAIL_BATCH_SIZE) | 0) % 5 === 0) {
        await patchLog({ products_updated: enrichedCount });
      }
      if (i + DETAIL_BATCH_SIZE < enrichLimit) await sleep(DETAIL_BATCH_DELAY_MS);
    }
    console.log(
      `[aliexpress-sync-top-products] enriquecimento concluído: ${enrichedCount}/${enrichLimit} em ${Date.now() - enrichStart}ms (rateLimit hits=${rateLimitHits})`,
    );

    // Regra fixa: produto AliExpress só é publicável se tiver >= MIN_IMAGES_REQUIRED fotos.
    // Produtos abaixo do mínimo entram no banco marcados como não-publicáveis (is_active=false),
    // continuam visíveis no catálogo interno com badge "Fotos insuficientes", mas não vão para
    // publicação em marketplaces nem para lojas públicas.
    let insufficientPhotos = 0;
    for (const item of detailed) {
      const imgCount = Array.isArray(item.images) ? item.images.length : 0;
      if (imgCount < MIN_IMAGES_REQUIRED) {
        item.is_active = false;
        insufficientPhotos++;
      } else {
        item.is_active = true;
      }
    }
    console.log(
      `[aliexpress-sync-top-products] regra ≥${MIN_IMAGES_REQUIRED} fotos: ${insufficientPhotos}/${detailed.length} produtos marcados como não-publicáveis (is_active=false)`,
    );


    // PASSO 2 — Upsert em catalog_products
    if (detailed.length > 0) {
      const ids = detailed.map((p) => p.external_id);
      const { data: existing } = await supabase
        .from("catalog_products")
        .select("external_id")
        .eq("source", "aliexpress")
        .in("external_id", ids);
      const existingSet = new Set((existing ?? []).map((r: any) => r.external_id));

      productsNew = detailed.filter((p) => !existingSet.has(p.external_id)).length;
      productsUpdated = detailed.filter((p) => existingSet.has(p.external_id)).length;

      const { error: upsertErr } = await supabase
        .from("catalog_products")
        .upsert(detailed, { onConflict: "source,external_id" });
      if (upsertErr) {
        console.error("[aliexpress-sync-top-products] erro no upsert:", upsertErr);
        throw upsertErr;
      }
      console.log(
        `[aliexpress-sync-top-products] upsert OK: ${productsNew} novos, ${productsUpdated} atualizados`,
      );
    }

    // Marcar produtos AliExpress que caíram do top 50
    const { data: existingTop } = await supabase
      .from("catalog_products")
      .select("id, external_id")
      .eq("source", "aliexpress")
      .eq("in_top_50", true);

    const droppedIds = (existingTop ?? [])
      .filter((r: any) => !currentTopIds.has(`aliexpress:${r.external_id}`))
      .map((r: any) => r.id);

    if (droppedIds.length > 0) {
      await supabase
        .from("catalog_products")
        .update({ in_top_50: false })
        .in("id", droppedIds);
    }

    await finalize({
      status: errorCount > 0 && productsNew + productsUpdated === 0 ? "failed" : "success",
      categories_processed: keywords.length,
      products_new: productsNew,
      products_updated: productsUpdated,
      products_dropped_from_top: droppedIds.length,
      error_count: errorCount,
      error_message: errors.slice(0, 5).join(" | ") || null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        total_ids_fetched: currentTopIds.size,
        products_new: productsNew,
        products_updated: productsUpdated,
        products_dropped_from_top: droppedIds.length,
        errors: errorCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("aliexpress-sync fatal:", message);
    await finalize({ status: "failed", error_count: 1, error_message: message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
