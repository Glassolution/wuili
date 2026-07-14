// Lote de republicação para itens legados afetados pelo bug de shipping.dimensions.
//
// Contexto: itens publicados antes do fix do `ml-publish` ficaram com
// `shipping.dimensions = null` no anúncio ativo do Mercado Livre. Esse
// campo NÃO é modificável em item ativo nem pausado (`field_not_updatable`,
// já testado em `MLB7160963112` com status paused e has_bids:false). O
// único caminho comprovado é criar um novo item via POST /items (aí o
// shipping.dimensions é aceito) e fechar o antigo.
//
// Estratégia (aprovada pelo usuário):
//   1. Lista `user_publications` ativos, ordenados pelos mais antigos.
//   2. Filtra apenas itens do grupo (a): sem pedido em `orders`.
//   3. Para cada um: GET item antigo → clona payload → POST novo item com
//      shipping.dimensions correto → POST description → pausa/fecha o antigo.
//   4. Atualiza `user_publications` para apontar pro novo MLB e registra
//      old→new em `ml_republication_log` (auditoria).
//
// Segurança: caller precisa ser admin.
// Query params:
//   ?limit=N      (default 3, max 20)  — quantos itens processar
//   ?dry_run=1    — só reporta o que faria
//   ?item_id=MLB  — força só um item (ignora limit)
//
// Timing: 400ms de delay entre itens para respeitar rate limit do ML.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Row = {
  id: string;
  user_id: string;
  ml_item_id: string;
  catalog_product_id: string | null;
  created_at: string;
};

type Outcome =
  | "republished"
  | "republished_no_description"
  | "dry_run"
  | "skipped_has_orders"
  | "skipped_403_permission"
  | "skipped_404"
  | "no_token"
  | "failed_get_item"
  | "failed_create_new"
  | "failed_close_old"
  | "failed_db_update";

type ReportEntry = {
  publication_id: string;
  user_id: string;
  old_ml_item_id: string;
  new_ml_item_id?: string;
  outcome: Outcome;
  error?: string;
};

function weightFallbackFromCategory(category: string | null | undefined): number {
  const cat = (category ?? "").toLowerCase();
  const map: Array<[RegExp, number]> = [
    [/beleza|cosm|maquiag|cabelo/, 0.2],
    [/moda|roupa|vestu|calc|acess/, 0.3],
    [/beb[eê]|crian/, 0.4],
    [/eletr[oô]n|gadget|fone|celular/, 0.5],
    [/pet/, 0.5],
    [/organiza|utilid/, 0.6],
    [/esport|lazer|fitness/, 0.8],
    [/casa|jardim|cozinh/, 0.8],
  ];
  const hit = map.find(([re]) => re.test(cat));
  return hit ? hit[1] : 0.4;
}

function dimsForWeight(kg: number): [number, number, number] {
  if (kg <= 0.3) return [20, 15, 5];
  if (kg <= 1) return [25, 20, 10];
  if (kg <= 3) return [35, 25, 15];
  if (kg <= 6) return [40, 30, 20];
  return [50, 40, 30];
}

async function getFreshToken(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  const { data: integ } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", "mercadolivre")
    .maybeSingle();

  if (!integ?.access_token) return null;

  const expiresAt = integ.expires_at ? new Date(integ.expires_at as string) : new Date(0);
  if (expiresAt > new Date(Date.now() + 60_000)) return integ.access_token as string;

  const refreshRes = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_CLIENT_ID")!,
      client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
      refresh_token: (integ.refresh_token as string) ?? "",
    }),
  });
  const rd = await refreshRes.json().catch(() => ({}));
  if (!refreshRes.ok || !rd.access_token) return null;

  await supabase.from("user_integrations").update({
    access_token: rd.access_token,
    refresh_token: rd.refresh_token,
    expires_at: new Date(Date.now() + rd.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("platform", "mercadolivre");

  return rd.access_token as string;
}

// Filtra atributos "read-only" ou incompatíveis com POST /items — o ML
// retorna 400 se recebermos coisas como CATALOG_PRODUCT_ID de outro item,
// SELLER_SKU herdado, ou atributos calculados internamente pelo ML.
const READ_ONLY_ATTR_PREFIXES = [
  "CATALOG_",
  "MAIN_",
];
const READ_ONLY_ATTR_IDS = new Set<string>([]);

function cloneAttributes(
  oldAttrs: Array<Record<string, unknown>> | undefined,
  newDimensions: string,
): Array<Record<string, unknown>> {
  const cleaned: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (const a of oldAttrs ?? []) {
    const id = String(a?.id ?? "");
    if (!id) continue;
    if (id === "SELLER_PACKAGE_DIMENSIONS") continue; // vamos setar depois
    if (READ_ONLY_ATTR_IDS.has(id)) continue;
    if (READ_ONLY_ATTR_PREFIXES.some((p) => id.startsWith(p))) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const out: Record<string, unknown> = { id };
    if (a.value_id) out.value_id = a.value_id;
    if (a.value_name != null) out.value_name = a.value_name;
    if (Array.isArray(a.values)) out.values = a.values;
    cleaned.push(out);
  }
  cleaned.push({ id: "SELLER_PACKAGE_DIMENSIONS", value_name: newDimensions });
  return cleaned;
}

async function republishOne(
  supabase: ReturnType<typeof createClient>,
  row: Row,
  token: string,
  weightKg: number,
  dryRun: boolean,
): Promise<{ outcome: Outcome; newItemId?: string; error?: string }> {
  const oldId = row.ml_item_id;

  // 1) GET item antigo
  const getRes = await fetch(
    `https://api.mercadolibre.com/items/${oldId}` +
      `?attributes=id,title,category_id,price,available_quantity,currency_id,` +
      `condition,listing_type_id,pictures,attributes,shipping,status,family_name`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (getRes.status === 403) {
    const t = await getRes.text().catch(() => "");
    return { outcome: "skipped_403_permission", error: t.slice(0, 400) };
  }
  if (getRes.status === 404) return { outcome: "skipped_404" };
  if (!getRes.ok) {
    const t = await getRes.text().catch(() => "");
    return { outcome: "failed_get_item", error: `GET ${getRes.status}: ${t.slice(0, 400)}` };
  }
  const oldItem = await getRes.json();

  // 2) Descrição
  let descriptionText = "";
  try {
    const descRes = await fetch(
      `https://api.mercadolibre.com/items/${oldId}/description`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (descRes.ok) {
      const d = await descRes.json();
      descriptionText = String(d?.plain_text ?? "").trim();
    }
  } catch { /* segue sem descrição */ }

  // 3) Monta payload novo com shipping.dimensions correto
  const dims = dimsForWeight(weightKg);
  const weightGrams = Math.max(50, Math.round(weightKg * 1000));
  const newShippingDimensions = `${dims[0]}x${dims[1]}x${dims[2]},${weightGrams}`;
  const newDimensionsAttr = `${dims[0]}x${dims[1]}x${dims[2]},cm`;

  const attributes = cloneAttributes(
    oldItem.attributes as Array<Record<string, unknown>>,
    newDimensionsAttr,
  );
  // Garante SELLER_PACKAGE_WEIGHT coerente com dimensions
  const wIdx = attributes.findIndex((a) => a.id === "SELLER_PACKAGE_WEIGHT");
  const weightAttr = { id: "SELLER_PACKAGE_WEIGHT", value_name: `${weightGrams} g` };
  if (wIdx >= 0) attributes[wIdx] = weightAttr; else attributes.push(weightAttr);

  const pictures = Array.isArray(oldItem.pictures)
    ? (oldItem.pictures as Array<Record<string, unknown>>)
        .map((p) => ({ source: String(p?.secure_url ?? p?.url ?? "") }))
        .filter((p) => p.source)
    : [];

  const basePayload: Record<string, unknown> = {
    title: oldItem.title,
    family_name: oldItem.family_name ?? oldItem.title,
    category_id: oldItem.category_id,
    price: oldItem.price,
    currency_id: oldItem.currency_id ?? "BRL",
    available_quantity: oldItem.available_quantity ?? 10,
    buying_mode: "buy_it_now",
    condition: oldItem.condition ?? "new",
    listing_type_id: oldItem.listing_type_id ?? "gold_special",
    pictures,
    attributes,
    shipping: {
      mode: "me2",
      local_pick_up: false,
      free_shipping: Boolean(oldItem?.shipping?.free_shipping ?? true),
      free_methods: [],
      dimensions: newShippingDimensions,
      tags: ["self_service_in"],
    },
  };

  if (dryRun) {
    return { outcome: "dry_run" };
  }

  // 4) POST novo item (com fallbacks title/family_name como no ml-publish)
  const doPost = (payload: Record<string, unknown>) =>
    fetch("https://api.mercadolibre.com/items", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

  let createRes = await doPost(basePayload);
  let createBody = await createRes.json().catch(() => ({}));
  const errBlob = () => JSON.stringify(createBody).toLowerCase();

  if (!createRes.ok && errBlob().includes("[title]")) {
    const { title: _t, ...noTitle } = basePayload;
    createRes = await doPost(noTitle);
    createBody = await createRes.json().catch(() => ({}));
  }
  if (!createRes.ok && errBlob().includes("family name")) {
    const { family_name: _f, ...noFn } = basePayload as Record<string, unknown>;
    createRes = await doPost(noFn);
    createBody = await createRes.json().catch(() => ({}));
  }

  if (!createRes.ok || !createBody?.id) {
    return {
      outcome: "failed_create_new",
      error: `POST ${createRes.status}: ${JSON.stringify(createBody).slice(0, 500)}`,
    };
  }

  const newItemId = String(createBody.id);
  const newPermalink = String(createBody.permalink ?? "");

  // 5) Descrição (só se havia descrição relevante). Se falhar, o item novo
  //    já foi criado com sucesso — não abortamos, mas sinalizamos o outcome
  //    diferente para o suporte reenviar manualmente.
  let descriptionFailed = false;
  let descriptionError: string | undefined;
  if (descriptionText.length > 20) {
    try {
      const dRes = await fetch(
        `https://api.mercadolibre.com/items/${newItemId}/description`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ plain_text: descriptionText }),
        },
      );
      if (!dRes.ok) {
        descriptionFailed = true;
        const t = await dRes.text().catch(() => "");
        descriptionError = `POST description ${dRes.status}: ${t.slice(0, 300)}`;
        console.warn(`[republish] descrição falhou em ${newItemId}: ${descriptionError}`);
      }
    } catch (err) {
      descriptionFailed = true;
      descriptionError = String(err instanceof Error ? err.message : err);
      console.warn(`[republish] descrição throw em ${newItemId}: ${descriptionError}`);
    }
  }


  // 6) Pausa/fecha o antigo (padrão do cleanup-ml-duplicates)
  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  const oldStatus = String(oldItem.status ?? "");
  if (oldStatus === "active") {
    await fetch(`https://api.mercadolibre.com/items/${oldId}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ status: "paused" }),
    }).catch(() => {});
  }
  const closeRes = await fetch(`https://api.mercadolibre.com/items/${oldId}`, {
    method: "PUT",
    headers: authHeaders,
    body: JSON.stringify({ status: "closed" }),
  });
  if (!closeRes.ok) {
    const t = await closeRes.text().catch(() => "");
    // Não desfaz o novo — melhor ter dois anúncios do que nenhum.
    // Registra para tratamento manual.
    await supabase.from("ml_republication_log").insert({
      user_id: row.user_id,
      old_ml_item_id: oldId,
      new_ml_item_id: newItemId,
      catalog_product_id: row.catalog_product_id,
      publication_id: row.id,
      reason: "shipping_dimensions_fix",
      status: "new_created_old_close_failed",
      error: `PUT closed ${closeRes.status}: ${t.slice(0, 300)}`,
      republished_at: new Date().toISOString(),
    });
    return {
      outcome: "failed_close_old",
      newItemId,
      error: `PUT closed ${closeRes.status}: ${t.slice(0, 300)}`,
    };
  }

  // 7) Atualiza user_publications e registra log
  const { error: updErr } = await supabase
    .from("user_publications")
    .update({
      ml_item_id: newItemId,
      permalink: newPermalink || null,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  await supabase.from("ml_republication_log").insert({
    user_id: row.user_id,
    old_ml_item_id: oldId,
    new_ml_item_id: newItemId,
    catalog_product_id: row.catalog_product_id,
    publication_id: row.id,
    reason: "shipping_dimensions_fix",
    status: descriptionFailed ? "success_no_description" : "success",
    error: descriptionError,
    republished_at: new Date().toISOString(),
  });

  if (updErr) {
    return {
      outcome: "failed_db_update",
      newItemId,
      error: updErr.message,
    };
  }
  return {
    outcome: descriptionFailed ? "republished_no_description" : "republished",
    newItemId,
    error: descriptionError,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: userRes } = await supabase.auth.getUser(jwt);
    const caller = userRes?.user;
    if (!caller) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Admin check via user_roles
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const limit = Math.min(20, Math.max(1, parseInt(url.searchParams.get("limit") ?? "3", 10) || 3));
    const dryRun = ["1", "true"].includes(url.searchParams.get("dry_run") ?? "");
    const forcedItemId = url.searchParams.get("item_id");

    // Alvos: publicações ativas, sem pedido em orders (grupo A).
    let query = supabase
      .from("user_publications")
      .select("id, user_id, ml_item_id, catalog_product_id, created_at")
      .in("status", ["active", "published"])
      .not("ml_item_id", "is", null)
      .order("created_at", { ascending: true });

    if (forcedItemId) {
      query = query.eq("ml_item_id", forcedItemId).limit(1);
    } else {
      query = query.limit(limit * 3); // pega mais para filtrar por orders
    }

    const { data: rows, error: fetchErr } = await query;
    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const candidates = (rows ?? []) as Row[];

    // Filtra fora quem tem pedido em orders. Usa uma consulta separada
    // porque `raw->>{...}` não é indexável facilmente com .in().
    const mlbSet = new Set(candidates.map((r) => r.ml_item_id));
    let withOrders = new Set<string>();
    if (mlbSet.size > 0) {
      const { data: ord } = await supabase
        .from("orders")
        .select("raw")
        .filter("raw", "not.is", null);
      for (const o of ord ?? []) {
        try {
          const oid = String((o as { raw: any }).raw?.order_items?.[0]?.item?.id ?? "");
          if (oid && mlbSet.has(oid)) withOrders.add(oid);
        } catch { /* ignora linhas mal formadas */ }
      }
    }

    const targets: Row[] = [];
    for (const r of candidates) {
      if (withOrders.has(r.ml_item_id)) continue;
      targets.push(r);
      if (!forcedItemId && targets.length >= limit) break;
    }

    // Pré-carrega catálogo (peso/categoria)
    const externalIds = Array.from(
      new Set(targets.map((r) => r.catalog_product_id).filter((v): v is string => !!v)),
    );
    const catalogMap = new Map<string, { weight: number | null; category: string | null }>();
    if (externalIds.length > 0) {
      const { data: cats } = await supabase
        .from("catalog_products")
        .select("external_id, weight, category")
        .eq("source", "c7drop")
        .in("external_id", externalIds);
      for (const c of cats ?? []) {
        catalogMap.set(
          (c as { external_id: string }).external_id,
          {
            weight: (c as { weight: number | null }).weight,
            category: (c as { category: string | null }).category,
          },
        );
      }
    }

    const report: ReportEntry[] = [];
    const tokenCache = new Map<string, string | null>();
    const noTokenUsers = new Set<string>();

    for (const row of targets) {
      let token = tokenCache.get(row.user_id);
      if (token === undefined) {
        token = await getFreshToken(supabase, row.user_id);
        tokenCache.set(row.user_id, token);
      }
      if (!token) {
        noTokenUsers.add(row.user_id);
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          old_ml_item_id: row.ml_item_id,
          outcome: "no_token",
          error: "Sem token válido mesmo após tentativa de refresh — usuário precisa reconectar o ML.",
        });
        continue;
      }

      const cat = row.catalog_product_id ? catalogMap.get(row.catalog_product_id) : undefined;
      const weightKg =
        cat && typeof cat.weight === "number" && cat.weight > 0
          ? cat.weight
          : weightFallbackFromCategory(cat?.category ?? null);

      try {
        const result = await republishOne(supabase, row, token, weightKg, dryRun);
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          old_ml_item_id: row.ml_item_id,
          new_ml_item_id: result.newItemId,
          outcome: result.outcome,
          error: result.error,
        });
        console.log(
          `[ml-republish-legacy-shipping] ${row.ml_item_id} -> ${result.outcome}` +
            (result.newItemId ? ` (new ${result.newItemId})` : "") +
            (result.error ? ` :: ${result.error}` : ""),
        );
      } catch (err) {
        const msg = String(err instanceof Error ? err.message : err);
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          old_ml_item_id: row.ml_item_id,
          outcome: "failed_create_new",
          error: msg,
        });
        console.error(`[ml-republish-legacy-shipping] ${row.ml_item_id} threw:`, msg);
      }

      // Respiro entre itens (POST + várias PUTs por item ≈ 4-5 chamadas)
      await new Promise((r) => setTimeout(r, 400));
    }

    const summary = {
      total: report.length,
      republished: report.filter((r) => r.outcome === "republished").length,
      dry_run: report.filter((r) => r.outcome === "dry_run").length,
      skipped_has_orders: report.filter((r) => r.outcome === "skipped_has_orders").length,
      skipped_403_permission: report.filter((r) => r.outcome === "skipped_403_permission").length,
      skipped_404: report.filter((r) => r.outcome === "skipped_404").length,
      no_token: report.filter((r) => r.outcome === "no_token").length,
      failed: report.filter((r) =>
        r.outcome === "failed_get_item" ||
        r.outcome === "failed_create_new" ||
        r.outcome === "failed_close_old" ||
        r.outcome === "failed_db_update"
      ).length,
      sellers_needing_reconnect: Array.from(noTokenUsers),
    };

    return new Response(JSON.stringify({ summary, report }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ml-republish-legacy-shipping error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
