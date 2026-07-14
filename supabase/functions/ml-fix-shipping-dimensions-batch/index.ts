// One-off / lote: corrige `shipping.dimensions` e `SELLER_PACKAGE_DIMENSIONS`
// de anúncios publicados antes do fix do ml-publish. Antes o payload enviava
// SELLER_PACKAGE_DIMENSIONS com formato "AxBxC cm" (espaço) e não enviava
// `shipping.dimensions` — o ML descartava as dimensões e aplicava a tabela
// de "pacote grande", gerando fretes absurdos (R$170+ em produto de R$35).
//
// Este batch:
//   1. Puxa publicações ativas em `user_publications`.
//   2. Para cada uma, usa o peso do produto de `catalog_products` (com o
//      mesmo fallback por categoria do ml-publish já corrigido).
//   3. Monta `shipping.dimensions = "AxBxC,pesoGramas"` e
//      `SELLER_PACKAGE_DIMENSIONS = "AxBxC,cm"`.
//   4. PUT em /items/{id} atualizando SOMENTE esses dois campos — nada mais.
//   5. Roda em lote (limit padrão 20/execução) e registra sucesso/erro.
//
// Segurança: exige caller admin (mesmo padrão do ml-fix-model-attribute).
// Query params:
//   ?limit=20  (default 20, max 50) — quantos itens processar nesta execução
//   ?dry_run=1 — só reporta o que faria, não faz PUT

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
  | "fixed"
  | "already_ok"
  | "dry_run"
  | "no_token"
  | "no_catalog_match"
  | "failed_get_item"
  | "failed_put";

type ReportEntry = {
  publication_id: string;
  user_id: string;
  ml_item_id: string;
  outcome: Outcome;
  weight_kg?: number;
  new_dimensions?: string;
  new_shipping_dimensions?: string;
  old_shipping_dimensions?: string | null;
  error?: string;
};

// Mesmas regras usadas no ml-publish corrigido — mantém o batch coerente
// com o fluxo de publicação novo.
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

async function fixItem(
  token: string,
  itemId: string,
  weightKg: number,
  dryRun: boolean,
): Promise<{
  outcome: Outcome;
  error?: string;
  oldShippingDimensions?: string | null;
  newDimensions: string;
  newShippingDimensions: string;
}> {
  const dims = dimsForWeight(weightKg);
  const weightGrams = Math.max(50, Math.round(weightKg * 1000));
  const newDimensions = `${dims[0]}x${dims[1]}x${dims[2]},cm`;
  const newShippingDimensions = `${dims[0]}x${dims[1]}x${dims[2]},${weightGrams}`;

  // 1) GET para saber estado atual — evita PUT redundante quando o anúncio
  //    já foi corrigido em execuções anteriores.
  const getRes = await fetch(
    `https://api.mercadolibre.com/items/${itemId}?attributes=id,shipping,attributes`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!getRes.ok) {
    const t = await getRes.text().catch(() => "");
    return {
      outcome: "failed_get_item",
      error: `GET ${getRes.status}: ${t.slice(0, 300)}`,
      newDimensions,
      newShippingDimensions,
    };
  }
  const item = await getRes.json();
  const oldShippingDimensions: string | null =
    (item?.shipping?.dimensions as string | undefined) ?? null;

  if (oldShippingDimensions === newShippingDimensions) {
    return {
      outcome: "already_ok",
      oldShippingDimensions,
      newDimensions,
      newShippingDimensions,
    };
  }

  if (dryRun) {
    return {
      outcome: "dry_run",
      oldShippingDimensions,
      newDimensions,
      newShippingDimensions,
    };
  }

  // 2) PUT apenas com os campos de frete — nada de título/preço/imagens.
  const putRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shipping: { dimensions: newShippingDimensions },
      attributes: [
        { id: "SELLER_PACKAGE_DIMENSIONS", value_name: newDimensions },
      ],
    }),
  });
  if (!putRes.ok) {
    const t = await putRes.text().catch(() => "");
    return {
      outcome: "failed_put",
      error: `PUT ${putRes.status}: ${t.slice(0, 400)}`,
      oldShippingDimensions,
      newDimensions,
      newShippingDimensions,
    };
  }
  return {
    outcome: "fixed",
    oldShippingDimensions,
    newDimensions,
    newShippingDimensions,
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
    if (!jwt) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userRes } = await supabase.auth.getUser(jwt);
    const caller = userRes?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10) || 20),
    );
    const dryRun = url.searchParams.get("dry_run") === "1" ||
      url.searchParams.get("dry_run") === "true";

    // Ordena pelos mais antigos primeiro — foram publicados antes da correção
    // e são os que geraram frete abusivo há mais tempo.
    const { data: rows, error: fetchErr } = await supabase
      .from("user_publications")
      .select("id, user_id, ml_item_id, catalog_product_id, created_at")
      .in("status", ["active", "published"])
      .not("ml_item_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targets = (rows ?? []) as Row[];

    // Pré-carrega catálogo (external_id -> {weight, category}) num único query.
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

    for (const row of targets) {
      // Peso: usa catalog_products.weight; se ausente, fallback por categoria.
      const cat = row.catalog_product_id ? catalogMap.get(row.catalog_product_id) : undefined;
      const weightKg =
        cat && typeof cat.weight === "number" && cat.weight > 0
          ? cat.weight
          : weightFallbackFromCategory(cat?.category ?? null);

      let token = tokenCache.get(row.user_id);
      if (token === undefined) {
        token = await getFreshToken(supabase, row.user_id);
        tokenCache.set(row.user_id, token);
      }
      if (!token) {
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          ml_item_id: row.ml_item_id,
          outcome: "no_token",
          weight_kg: weightKg,
          error: "Sem token válido — usuário precisa reconectar o Mercado Livre.",
        });
        continue;
      }

      try {
        const result = await fixItem(token, row.ml_item_id, weightKg, dryRun);
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          ml_item_id: row.ml_item_id,
          outcome: result.outcome,
          weight_kg: weightKg,
          new_dimensions: result.newDimensions,
          new_shipping_dimensions: result.newShippingDimensions,
          old_shipping_dimensions: result.oldShippingDimensions,
          error: result.error,
        });
        console.log(
          `[ml-fix-shipping-dimensions-batch] ${row.ml_item_id} -> ${result.outcome}` +
            (result.error ? ` :: ${result.error}` : ""),
        );
      } catch (err) {
        const msg = String(err instanceof Error ? err.message : err);
        report.push({
          publication_id: row.id,
          user_id: row.user_id,
          ml_item_id: row.ml_item_id,
          outcome: "failed_put",
          weight_kg: weightKg,
          error: msg,
        });
        console.error(`[ml-fix-shipping-dimensions-batch] ${row.ml_item_id} threw:`, msg);
      }

      // Pequeno delay para respeitar rate limit do ML (evita 429 em lotes grandes).
      await new Promise((r) => setTimeout(r, 150));
    }

    const summary = {
      total: report.length,
      fixed: report.filter((r) => r.outcome === "fixed").length,
      already_ok: report.filter((r) => r.outcome === "already_ok").length,
      dry_run: report.filter((r) => r.outcome === "dry_run").length,
      no_token: report.filter((r) => r.outcome === "no_token").length,
      no_catalog_match: report.filter((r) => r.outcome === "no_catalog_match").length,
      failed: report.filter((r) =>
        r.outcome === "failed_get_item" || r.outcome === "failed_put"
      ).length,
    };

    return new Response(JSON.stringify({ summary, report }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ml-fix-shipping-dimensions-batch error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
