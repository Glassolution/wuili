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
const PAGE_SIZE = 50; // top 50 por categoria
const RATE_LIMIT_DELAY_MS = 400; // ~2.5 req/s

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
      is_blocked: false,
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

  // Cria log
  const { data: logRow } = await supabase
    .from("aliexpress_sync_log")
    .insert({ status: "running", triggered_by: triggeredBy })
    .select()
    .single();
  const logId = logRow?.id as string | undefined;

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

    // PASSO 1 — Buscar IDs dos mais vendidos (sem filtro de categoria)
    console.log("[aliexpress-sync-top-products] PASSO 1: buscando IDs via aliexpress.ds.feed.itemids.get");
    const idsJson = await callAliExpress(
      "aliexpress.ds.feed.itemids.get",
      {
        feed_name: "DS bestseller",
        page_size: String(PAGE_SIZE),
        page_no: "1",
      },
      { appKey, appSecret, accessToken },
    );

    // Extrai IDs de forma tolerante a diferentes formatos de resposta
    const rawIdsContainer =
      idsJson?.aliexpress_ds_feed_itemids_get_response?.result?.products ??
      idsJson?.aliexpress_ds_feed_itemids_get_response?.result ??
      idsJson?.result?.products ??
      idsJson?.result ??
      [];
    let productIds: string[] = [];
    if (Array.isArray(rawIdsContainer)) {
      productIds = rawIdsContainer.map((v: any) =>
        typeof v === "object" ? String(v.product_id ?? v.item_id ?? v.id ?? "") : String(v),
      );
    } else if (typeof rawIdsContainer === "object" && rawIdsContainer !== null) {
      const arr = rawIdsContainer.product_id ?? rawIdsContainer.item_id ?? rawIdsContainer.string ?? [];
      if (Array.isArray(arr)) productIds = arr.map((v: any) => String(v));
      else if (typeof arr === "string") productIds = arr.split(",").map((s) => s.trim());
    }
    productIds = productIds.filter((s) => s && s !== "undefined");
    console.log(`[aliexpress-sync-top-products] PASSO 1 OK: ${productIds.length} IDs recebidos`);

    if (productIds.length === 0) {
      await finalize({
        status: "success",
        categories_processed: 0,
        products_new: 0,
        products_updated: 0,
        error_message: "Feed retornou 0 IDs",
      });
      return new Response(
        JSON.stringify({ ok: true, message: "Feed vazio", products_new: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let productsNew = 0;
    let productsUpdated = 0;
    let errorCount = 0;
    const errors: string[] = [];
    const currentTopIds = new Set<string>();

    // PASSO 2 — Buscar detalhes de cada produto (1 chamada por ID)
    console.log(`[aliexpress-sync-top-products] PASSO 2: detalhando ${productIds.length} produtos`);
    const detailed: any[] = [];
    for (let i = 0; i < productIds.length; i++) {
      const pid = productIds[i];
      try {
        const detailJson = await callAliExpress(
          "aliexpress.ds.product.get",
          {
            product_id: pid,
            target_currency: "USD",
            target_language: "PT",
            ship_to_country: "BR",
          },
          { appKey, appSecret, accessToken },
        );

        const resp =
          detailJson?.aliexpress_ds_product_get_response?.result ??
          detailJson?.result ??
          detailJson;

        const base = resp?.ae_item_base_info_dto ?? {};
        const sku = resp?.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o?.[0] ?? {};
        const media = resp?.ae_multimedia_info_dto ?? {};
        const store = resp?.ae_store_info ?? {};

        const imagesStr: string = media?.image_urls ?? "";
        const images = imagesStr ? imagesStr.split(";").filter(Boolean) : [];

        const salePriceUsd = Number(sku?.offer_sale_price ?? sku?.sku_price ?? base?.sale_price ?? 0);
        const originalPriceUsd = Number(sku?.sku_price ?? base?.original_price ?? salePriceUsd);
        const cost = +(salePriceUsd * USD_TO_BRL).toFixed(2);
        const suggested = +(cost * 2).toFixed(2);
        const original = +(originalPriceUsd * USD_TO_BRL).toFixed(2);
        const margin = suggested > 0 ? +(((suggested - cost) / suggested) * 100).toFixed(2) : 0;

        const externalId = String(base?.product_id ?? pid);
        const title = String(base?.subject ?? base?.product_title ?? "").trim();

        if (!externalId || !title) {
          console.warn(`[aliexpress-sync-top-products] produto ${pid} sem dados suficientes, ignorando`);
        } else {
          detailed.push({
            source: "aliexpress",
            external_id: externalId,
            title,
            images: images.length > 0 ? images : (base?.image_url ? [base.image_url] : []),
            cost_price: cost,
            suggested_price: suggested,
            original_price: original,
            margin_percent: margin,
            rating: base?.evaluation_rate ? Number(String(base.evaluation_rate).replace("%", "")) / 20 : null,
            orders_count: Number(base?.sales_count ?? base?.evaluation_count ?? 0) || 0,
            stock_quantity: Number(sku?.sku_available_stock ?? 999) || 999,
            product_url: base?.detail_url ?? `https://www.aliexpress.com/item/${externalId}.html`,
            aliexpress_category_id: String(base?.category_id ?? ""),
            brand: store?.store_name ?? null,
            in_top_50: true,
            is_active: true,
            is_blocked: false,
            scraped_at: new Date().toISOString(),
          });
          currentTopIds.add(`aliexpress:${externalId}`);
        }
      } catch (err) {
        errorCount++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`[${pid}] ${msg}`);
        console.error(`[aliexpress-sync-top-products] erro em product.get id=${pid}:`, msg);
      }
      // Pequeno delay para respeitar rate limit
      await sleep(RATE_LIMIT_DELAY_MS);
    }

    console.log(`[aliexpress-sync-top-products] PASSO 2 OK: ${detailed.length}/${productIds.length} produtos normalizados`);

    // PASSO 3 — Upsert em catalog_products
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
      console.log(`[aliexpress-sync-top-products] PASSO 3 OK: ${productsNew} novos, ${productsUpdated} atualizados`);
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
      categories_processed: 1,
      products_new: productsNew,
      products_updated: productsUpdated,
      products_dropped_from_top: droppedIds.length,
      error_count: errorCount,
      error_message: errors.slice(0, 5).join(" | ") || null,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        categories_processed: mappings.length,
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
