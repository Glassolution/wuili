// Cliente único para todas as chamadas à API do Mercado Livre.
//
// Objetivo: conformidade com a política de uso da API (o que motivou as
// suspensões anteriores). Todo acesso ao ML deve passar por `mlFetch`:
//
//  - User-Agent identificando a Velo (apps identificados são tratados melhor;
//    mascarar identidade é violação de política e não é feito aqui)
//  - throttle global entre chamadas (rate limit)
//  - cache PERSISTENTE (tabela ml_api_cache) para GETs de dados públicos
//    (categorias, atributos, domain_discovery) — some o efeito "scraping"
//  - respeito a Retry-After + backoff exponencial em 429/5xx
//  - circuit breaker persistente: sequência de 403/429 abre o circuito e
//    para de chamar o ML por um tempo, em vez de insistir e virar abuso
//
// Uso: `await mlFetch(url, init)` — assinatura igual à do fetch.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export const ML_USER_AGENT = "Velo/1.0 (+https://velods.com.br; integracao Mercado Livre)";

export const ML_MIN_INTERVAL_MS = 350;
const MAX_RETRIES = 2;
const PUBLIC_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // categorias/atributos mudam pouco
const CIRCUIT_WINDOW_MS = 10 * 60 * 1000;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 30 * 60 * 1000;

export class MlCircuitOpenError extends Error {
  constructor(public readonly openUntil: string) {
    super(
      "Integração com o Mercado Livre temporariamente pausada (proteção contra bloqueio). Tente novamente mais tarde.",
    );
    this.name = "MlCircuitOpenError";
  }
}

let lastCallAt = 0;
async function throttle(minIntervalMs = ML_MIN_INTERVAL_MS): Promise<void> {
  const wait = lastCallAt + minIntervalMs - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCallAt = Date.now();
}

// cache de 1º nível (isolate) na frente do cache persistente
const memCache = new Map<string, { value: unknown; expiresAt: number }>();

let admin: SupabaseClient | null = null;
function db(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  if (!admin) admin = createClient(url, key, { auth: { persistSession: false } });
  return admin;
}

// ---- cache público --------------------------------------------------------
const PUBLIC_CACHEABLE = [
  "/categories/",
  "/sites/MLB/domain_discovery",
  "/sites/MLB/categories",
  "/currencies",
];

function isPublicCacheable(method: string, url: string): boolean {
  if (method !== "GET") return false;
  return PUBLIC_CACHEABLE.some((p) => url.includes(p));
}

async function readCache(key: string): Promise<string | null> {
  const hit = memCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as string;
  if (hit) memCache.delete(key);

  const supabase = db();
  if (!supabase) return null;
  const { data } = await supabase
    .from("ml_api_cache")
    .select("body, expires_at")
    .eq("cache_key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!data?.body) return null;
  const body = data.body as string;
  memCache.set(key, { value: body, expiresAt: new Date(data.expires_at as string).getTime() });
  return body;
}

async function writeCache(key: string, body: string, ttlMs: number): Promise<void> {
  memCache.set(key, { value: body, expiresAt: Date.now() + ttlMs });
  const supabase = db();
  if (!supabase) return;
  await supabase.from("ml_api_cache").upsert(
    {
      cache_key: key,
      body,
      expires_at: new Date(Date.now() + ttlMs).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cache_key" },
  );
}

// ---- circuit breaker (DESATIVADO) -----------------------------------------
// O disjuntor global foi removido: um 403 de autorização de um seller
// específico (token da app antiga / item de outra conta) derrubava as
// publicações de TODOS os usuários. Agora apenas registramos as rejeições
// para telemetria — nenhuma chamada é bloqueada.
async function registerRejection(status: number, url: string): Promise<void> {
  const supabase = db();
  if (!supabase) return;
  const now = new Date();
  await supabase.from("ml_api_circuit").upsert(
    {
      id: "mercadolivre",
      failure_count: 0,
      window_started_at: null,
      last_status: status,
      last_url: url.slice(0, 300),
      open_until: null,
      updated_at: now.toISOString(),
    },
    { onConflict: "id" },
  );
}

async function registerSuccess(): Promise<void> {
  const supabase = db();
  if (!supabase) return;
  await supabase.from("ml_api_circuit").upsert(
    {
      id: "mercadolivre",
      failure_count: 0,
      window_started_at: null,
      open_until: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
}

// ---- fetch ----------------------------------------------------------------
export async function mlFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : input.toString();
  const method = (init.method ?? "GET").toUpperCase();



  const cacheKey = isPublicCacheable(method, url) ? `ml:${url}` : null;
  if (cacheKey) {
    const cached = await readCache(cacheKey);
    if (cached !== null) {
      return new Response(cached, {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Velo-Cache": "hit" },
      });
    }
  }

  const headers = new Headers(init.headers ?? {});
  headers.set("User-Agent", ML_USER_AGENT);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  let attempt = 0;
  let lastResponse: Response | null = null;

  while (attempt <= MAX_RETRIES) {
    await throttle();
    const res = await fetch(url, { ...init, headers });

    if (res.status === 429 || res.status >= 500) {
      if (res.status === 429) await registerRejection(res.status, url);
      if (attempt === MAX_RETRIES) return res;
      const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
      const waitMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * Math.pow(2, attempt);
      console.warn(`[mlClient] ${res.status} em ${url} — retry em ${waitMs}ms`);
      await new Promise((r) => setTimeout(r, waitMs));
      attempt++;
      lastResponse = res;
      continue;
    }

    if (res.status === 403) {
      await registerRejection(res.status, url);
      return res;
    }

    if (res.ok) {
      await registerSuccess();
      if (cacheKey) {
        const body = await res.clone().text();
        await writeCache(cacheKey, body, PUBLIC_CACHE_TTL_MS);
      }
    }
    return res;
  }

  return lastResponse ?? new Response("ml_fetch_failed", { status: 599 });
}
