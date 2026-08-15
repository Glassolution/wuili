// ml-sync-stock
// -------------
// Fase 3 do plano de estoque: sincroniza o estoque do fornecedor (C7Drop, já
// atualizado pelo scrape-c7drop em catalog_products) com os anúncios ativos no
// Mercado Livre.
//
// Regras:
//  • Produto sem estoque (stock_quantity = 0) ou inativo (is_active = false)
//    → PUT /items/{id} { status: 'paused' } e marcamos paused_reason =
//      'velo_out_of_stock' para saber que a pausa foi nossa.
//  • Produto voltou (stock > 0 e is_active) → reativamos SOMENTE o que nós
//    pausamos por estoque. Nunca reabrimos o que o vendedor pausou à mão.
//  • available_quantity divergente → corrigimos para min(estoque, 10).
//  • Guarda de segurança: se mais de 20% do catálogo estiver zerado na rodada
//    (sinal de scraper/C7 fora do ar), abortamos sem pausar nada.
//
// Modos:
//  • Cron / service role (sem body): percorre todos os usuários.
//  • Autenticado (JWT) ou { userId }: sincroniza apenas aquele usuário.
//  • { dryRun: true }: só relata o que faria, sem tocar no ML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { mlFetch } from "../_shared/mlClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAUSED_BY_VELO = "velo_out_of_stock";
const MAX_QTY = 10;
const OUT_OF_STOCK_ABORT_RATIO = 0.2;
const REQUEST_DELAY_MS = 120;
const QUANTITY_REFRESH_DAYS = 7;
const TIME_BUDGET_MS = 110_000; // a runtime encerra a invocação bem antes disso

// Status nossos que representam anúncio no ar / pausado por nós.
const SYNCABLE_STATUSES = ["active", "published", "paused"];

type Pub = {
  id: string;
  user_id: string;
  ml_item_id: string;
  status: string;
  catalog_product_id: string | null;
  paused_reason: string | null;
  stock_synced_at?: string | null;
};

type CatalogRow = {
  external_id: string;
  stock_quantity: number | null;
  is_active: boolean | null;
  title: string | null;
};

// deno-lint-ignore no-explicit-any -- cliente supabase sem tipos gerados no Deno
type Supa = any;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getFreshToken(supabase: Supa, userId: string): Promise<string | null> {
  const { data: integ } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", "mercadolivre")
    .maybeSingle();
  if (!integ?.access_token) return null;

  const expiresAt = integ.expires_at ? new Date(integ.expires_at as string) : new Date(0);
  if (expiresAt > new Date(Date.now() + 60_000)) return integ.access_token as string;

  const rr = await mlFetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_CLIENT_ID")!,
      client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
      refresh_token: (integ.refresh_token as string) ?? "",
    }),
  });
  const rd = await rr.json().catch(() => ({}));
  if (!rr.ok || !rd.access_token) return null;

  await supabase
    .from("user_integrations")
    .update({
      access_token: rd.access_token,
      refresh_token: rd.refresh_token ?? integ.refresh_token,
      expires_at: new Date(Date.now() + (rd.expires_in ?? 21600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", "mercadolivre");

  return rd.access_token as string;
}

async function updateItem(
  token: string,
  itemId: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await mlFetch(`https://api.mercadolibre.com/items/${itemId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const txt = await res.text().catch(() => "");
  return { ok: false, error: `HTTP ${res.status}: ${txt.substring(0, 300)}` };
}

async function notify(supabase: Supa, userId: string, title: string, message: string) {
  try {
    await supabase.from("notifications").insert({
      user_id: userId,
      title,
      message,
      type: "warning",
    });
  } catch (e) {
    console.warn("[ml-sync-stock] notificação falhou:", (e as Error).message);
  }
}

// O ML devolve "Cannot update item MLBxxx [status:closed, ...]" quando o anúncio
// já não existe mais como ativo. Não é erro nosso: sincronizamos o status local
// e paramos de tentar nas próximas rodadas.
const DEAD_ML_STATUS = ["closed", "inactive", "under_review", "payment_required"];
function deadStatusFrom(error?: string): string | null {
  const m = /\[status:([a-z_]+)/.exec(error ?? "");
  return m && DEAD_ML_STATUS.includes(m[1]) ? m[1] : null;
}
async function markLocalStatus(supabase: Supa, pubId: string, mlStatus: string) {
  await supabase
    .from("user_publications")
    .update({ status: mlStatus, stock_synced_at: new Date().toISOString() })
    .eq("id", pubId);
}

type UserResult = {
  checked: number;
  paused: number;
  reactivated: number;
  quantityFixed: number;
  errors: number;
  deadListings: number;
  timedOut?: boolean;
  error?: string;
  details: Array<Record<string, unknown>>;
};

async function syncUser(
  supabase: Supa,
  userId: string,
  pubs: Pub[],
  catalog: Map<string, CatalogRow>,
  dryRun: boolean,
  deadline: number,
): Promise<UserResult> {
  const result: UserResult = {
    checked: 0,
    paused: 0,
    reactivated: 0,
    quantityFixed: 0,
    errors: 0,
    deadListings: 0,
    details: [],
  };

  let token: string | null = null;
  if (!dryRun) {
    token = await getFreshToken(supabase, userId);
    if (!token) {
      result.error = "sem_token_ml";
      return result;
    }
  }

  for (const pub of pubs) {
    if (Date.now() > deadline) {
      result.timedOut = true;
      break;
    }
    const product = pub.catalog_product_id ? catalog.get(pub.catalog_product_id) : undefined;
    if (!product) continue; // produto de outra fonte / não rastreado
    result.checked++;

    const stock = Number(product.stock_quantity ?? 0);
    const available = product.is_active !== false && stock > 0;
    const isPaused = pub.status === "paused";
    const pausedByVelo = pub.paused_reason === PAUSED_BY_VELO;

    // ---- 1. Indisponível no fornecedor → pausar
    if (!available && !isPaused) {
      result.details.push({ ml_item_id: pub.ml_item_id, action: "pause", stock, is_active: product.is_active });
      if (dryRun) continue;
      const r = await updateItem(token!, pub.ml_item_id, { status: "paused" });
      await sleep(REQUEST_DELAY_MS);
      if (!r.ok) {
        const dead = deadStatusFrom(r.error);
        if (dead) {
          await markLocalStatus(supabase, pub.id, dead);
          result.deadListings++;
          continue;
        }
        result.errors++;
        console.warn(`[ml-sync-stock] pausa falhou ${pub.ml_item_id}: ${r.error}`);
        continue;
      }
      await supabase
        .from("user_publications")
        .update({
          status: "paused",
          paused_reason: PAUSED_BY_VELO,
          stock_synced_at: new Date().toISOString(),
        })
        .eq("id", pub.id);
      result.paused++;
      await notify(
        supabase,
        userId,
        "Anúncio pausado por falta de estoque",
        `O produto "${product.title ?? pub.ml_item_id}" ficou indisponível no fornecedor e o anúncio foi pausado no Mercado Livre. Ele volta ao ar automaticamente quando o estoque retornar.`,
      );
      continue;
    }

    // ---- 2. Voltou a ter estoque → reativar somente o que nós pausamos
    if (available && isPaused && pausedByVelo) {
      const qty = Math.max(1, Math.min(stock, MAX_QTY));
      result.details.push({ ml_item_id: pub.ml_item_id, action: "reactivate", stock });
      if (dryRun) continue;
      const r = await updateItem(token!, pub.ml_item_id, {
        status: "active",
        available_quantity: qty,
      });
      await sleep(REQUEST_DELAY_MS);
      if (!r.ok) {
        const dead = deadStatusFrom(r.error);
        if (dead) {
          await markLocalStatus(supabase, pub.id, dead);
          result.deadListings++;
          continue;
        }
        result.errors++;
        console.warn(`[ml-sync-stock] reativação falhou ${pub.ml_item_id}: ${r.error}`);
        continue;
      }
      await supabase
        .from("user_publications")
        .update({
          status: "active",
          paused_reason: null,
          stock_synced_at: new Date().toISOString(),
        })
        .eq("id", pub.id);
      result.reactivated++;
      continue;
    }

    // ---- 3. Ajuste de quantidade em anúncio ativo.
    // Só reenviamos a cada QUANTITY_REFRESH_DAYS para não bater na API do ML
    // com milhares de PUTs redundantes a cada rodada.
    if (available && !isPaused) {
      const lastSync = pub.stock_synced_at ? new Date(pub.stock_synced_at).getTime() : 0;
      const stale = Date.now() - lastSync > QUANTITY_REFRESH_DAYS * 86_400_000;
      if (!stale) continue;
      const qty = Math.max(1, Math.min(stock, MAX_QTY));
      result.details.push({ ml_item_id: pub.ml_item_id, action: "quantity", qty });
      if (dryRun) continue;

      const r = await updateItem(token!, pub.ml_item_id, { available_quantity: qty });
      await sleep(REQUEST_DELAY_MS);
      if (!r.ok) {
        const dead = deadStatusFrom(r.error);
        if (dead) {
          await markLocalStatus(supabase, pub.id, dead);
          result.deadListings++;
          continue;
        }
        console.warn(`[ml-sync-stock] quantidade falhou ${pub.ml_item_id}: ${r.error}`);
        result.errors++;
        continue;
      }
      await supabase
        .from("user_publications")
        .update({ stock_synced_at: new Date().toISOString() })
        .eq("id", pub.id);
      result.quantityFixed++;
    }
  }

  return result;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const dryRun = body?.dryRun === true;
    const force = body?.force === true; // ignora a guarda dos 20%

    let targetUserId: string | null = null;
    const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (jwt && jwt !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
      const { data: userRes } = await supabase.auth.getUser(jwt);
      if (userRes?.user) targetUserId = userRes.user.id;
    }
    if (!targetUserId && typeof body?.userId === "string") targetUserId = body.userId as string;

    // ---- Publicações rastreáveis (paginado: o PostgREST corta em 1000 linhas)
    const pubs: Pub[] = [];
    const PAGE = 1000;
    for (let from = 0; from < 20_000; from += PAGE) {
      let pubQuery = supabase
        .from("user_publications")
        .select("id,user_id,ml_item_id,status,catalog_product_id,paused_reason,stock_synced_at")
        .not("catalog_product_id", "is", null)
        .in("status", SYNCABLE_STATUSES)
        .order("stock_synced_at", { ascending: true, nullsFirst: true })
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (targetUserId) pubQuery = pubQuery.eq("user_id", targetUserId);

      const { data: page, error: pubErr } = await pubQuery;
      if (pubErr) throw pubErr;
      const rows = (page ?? []) as Pub[];
      pubs.push(...rows);
      if (rows.length < PAGE) break;
    }


    if (pubs.length === 0) {
      return new Response(
        JSON.stringify({ summary: { publications: 0 }, ranAt: new Date().toISOString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Catálogo correspondente (external_id = catalog_product_id)
    const ids = Array.from(new Set(pubs.map((p) => p.catalog_product_id!).filter(Boolean)));
    const catalog = new Map<string, CatalogRow>();
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const { data, error } = await supabase
        .from("catalog_products")
        .select("external_id,stock_quantity,is_active,title")
        .in("external_id", slice);
      if (error) throw error;
      for (const row of (data ?? []) as CatalogRow[]) catalog.set(row.external_id, row);
    }

    // ---- Guarda de segurança: catálogo zerado em massa = provável falha do scraper
    const tracked = Array.from(catalog.values());
    const outOfStock = tracked.filter(
      (p) => p.is_active === false || Number(p.stock_quantity ?? 0) <= 0,
    ).length;
    const ratio = tracked.length > 0 ? outOfStock / tracked.length : 0;
    if (!force && !dryRun && ratio > OUT_OF_STOCK_ABORT_RATIO) {
      console.error(
        `[ml-sync-stock] ABORTADO: ${outOfStock}/${tracked.length} produtos indisponíveis (${(ratio * 100).toFixed(1)}%) — possível falha do scraper.`,
      );
      return new Response(
        JSON.stringify({
          aborted: true,
          reason: "out_of_stock_ratio_guard",
          outOfStock,
          tracked: tracked.length,
          ratio: Number(ratio.toFixed(3)),
          ranAt: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ---- Agrupa por usuário
    const byUser = new Map<string, Pub[]>();
    for (const p of pubs) {
      const list = byUser.get(p.user_id) ?? [];
      list.push(p);
      byUser.set(p.user_id, list);
    }

    const perUser: Record<string, unknown> = {};
    let checked = 0, paused = 0, reactivated = 0, quantityFixed = 0, errors = 0, deadListings = 0;
    const deadline = Date.now() + TIME_BUDGET_MS;
    let timedOut = false;

    for (const [userId, list] of byUser) {
      if (Date.now() > deadline) { timedOut = true; break; }
      const r = await syncUser(supabase, userId, list, catalog, dryRun, deadline);
      if (r.timedOut) timedOut = true;
      perUser[userId] = r;
      checked += r.checked;
      paused += r.paused;
      reactivated += r.reactivated;
      quantityFixed += r.quantityFixed;
      errors += r.errors;
      deadListings += r.deadListings;
    }

    return new Response(
      JSON.stringify(
        {
          summary: {
            dryRun,
            users: byUser.size,
            publications: pubs.length,
            trackedProducts: tracked.length,
            outOfStockProducts: outOfStock,
            checked,
            paused,
            reactivated,
            quantityFixed,
            errors,
            deadListings,
            timedOut,
          },
          perUser,
          ranAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[ml-sync-stock] fatal:", (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
