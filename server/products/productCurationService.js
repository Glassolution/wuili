import { createClient } from "@supabase/supabase-js";

// Env knobs:
// PRODUCT_CURATION_WEIGHTS='{"margin":0.3,"shipping":0.2,"supplier":0.2,"demand":0.2,"competition":0.1}'
// UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN or REDIS_URL enable Redis cache; otherwise memory cache is used.
const CACHE_TTL_SECONDS = 60 * 60 * 6;
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;
const MIN_PUBLISHABLE_SCORE = 40;
const ML_SEARCH_URL = "https://api.mercadolibre.com/sites/MLB/search";
const DEFAULT_SUPABASE_URL = "https://nqzpoioxvbqavrtphtoa.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk";

const DEFAULT_WEIGHTS = {
  margin: 0.3,
  shipping: 0.2,
  supplier: 0.2,
  demand: 0.2,
  competition: 0.1,
};

const CATEGORY_MAP = {
  beleza: "Beleza e Cuidados Pessoais",
  casa: "Casa e Jardim",
  eletronicos: "Eletrônicos e Gadgets",
  moda: "Moda Feminina",
  esporte: "Esporte e Lazer",
  pet: "Pet",
  bebes: "Bebês e Crianças",
  organizacao: "Organização e Utilidades",
};

let supabaseClient;
let cacheInstance;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeJson(value, fallback = null) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stableProductId(product) {
  return String(product?.id ?? product?.external_id ?? product?.pid ?? product?.title ?? "unknown");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function pickSearchTitle(product) {
  const title = String(product?.title ?? product?.productNameEn ?? product?.productName ?? "").trim();
  return title
    .replace(/\b(dropshipping|novo|original|produto)\b/gi, "")
    .replace(/\s+/g, " ")
    .slice(0, 90)
    .trim();
}

function createMemoryCache() {
  const store = new Map();

  return {
    name: "memory",
    async get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async set(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },
  };
}

function createUpstashCache() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const fallback = createMemoryCache();

  async function command(args) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) throw new Error(`Upstash Redis error ${response.status}`);
    const data = await response.json();
    return data?.result;
  }

  return {
    name: "upstash",
    async get(key) {
      try {
        const result = await command(["GET", key]);
        if (!result) return null;
        return JSON.parse(result);
      } catch (error) {
        console.warn("[product-curation] Upstash indisponível, lendo cache em memória:", error.message);
        return fallback.get(key);
      }
    },
    async set(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
      try {
        await command(["SET", key, JSON.stringify(value), "EX", String(ttlSeconds)]);
      } catch (error) {
        console.warn("[product-curation] Upstash indisponível, salvando cache em memória:", error.message);
        await fallback.set(key, value, ttlSeconds);
      }
    },
  };
}

function createNodeRedisCache() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  const fallback = createMemoryCache();
  let clientPromise;

  async function getClient() {
    if (!clientPromise) {
      clientPromise = import("redis")
        .then(({ createClient }) => {
          const client = createClient({ url: redisUrl });
          client.on("error", (error) => console.error("[product-curation] Redis error:", error.message));
          return client.connect().then(() => client);
        })
        .catch((error) => {
          console.warn("[product-curation] Redis indisponível, usando cache em memória:", error.message);
          return null;
        });
    }
    return clientPromise;
  }

  return {
    name: "redis",
    async get(key) {
      const client = await getClient();
      if (!client) return fallback.get(key);
      const raw = await client.get(key);
      return raw ? JSON.parse(raw) : null;
    },
    async set(key, value, ttlSeconds = CACHE_TTL_SECONDS) {
      const client = await getClient();
      if (!client) return fallback.set(key, value, ttlSeconds);
      await client.setEx(key, ttlSeconds, JSON.stringify(value));
    },
  };
}

export function getProductCurationCache() {
  if (cacheInstance) return cacheInstance;
  cacheInstance = createUpstashCache() ?? createNodeRedisCache() ?? createMemoryCache();
  console.log(`[product-curation] score cache ativo: ${cacheInstance.name}`);
  return cacheInstance;
}

export function getProductCurationSupabase() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = process.env.DB_URL ?? process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? DEFAULT_SUPABASE_URL;
  const supabaseKey =
    process.env.DB_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("[product-curation] Supabase não configurado; catálogo curado retornará vazio.");
    return null;
  }

  supabaseClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseClient;
}
export async function logAiActivity(userId, message, metadata = {}) {
  if (!userId || !message) return null;

  const supabase = getProductCurationSupabase();
  if (!supabase) return null;

  try {
    const { error } = await supabase
      .from("ai_activity_logs")
      .insert({
        user_id: userId,
        message,
        metadata,
      });

    if (error) throw error;
  } catch (error) {
    console.warn("[product-curation] não foi possível registrar atividade da IA:", error.message);
  }

  return null;
}

function getScoreWeights() {
  const rawJson = process.env.PRODUCT_CURATION_WEIGHTS ?? process.env.PRODUCT_SCORE_WEIGHTS;
  let weights = { ...DEFAULT_WEIGHTS };

  if (rawJson) {
    try {
      weights = { ...weights, ...JSON.parse(rawJson) };
    } catch (error) {
      console.warn("[product-curation] PRODUCT_CURATION_WEIGHTS inválido; usando pesos padrão:", error.message);
    }
  }

  weights.margin = toNumber(process.env.PRODUCT_SCORE_MARGIN_WEIGHT, weights.margin);
  weights.shipping = toNumber(process.env.PRODUCT_SCORE_SHIPPING_WEIGHT, weights.shipping);
  weights.supplier = toNumber(process.env.PRODUCT_SCORE_SUPPLIER_WEIGHT, weights.supplier);
  weights.demand = toNumber(process.env.PRODUCT_SCORE_DEMAND_WEIGHT, weights.demand);
  weights.competition = toNumber(process.env.PRODUCT_SCORE_COMPETITION_WEIGHT, weights.competition);

  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(toNumber(value), 0), 0);
  if (total <= 0) return DEFAULT_WEIGHTS;

  return Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, Math.max(toNumber(value), 0) / total]),
  );
}

async function fetchJsonWithRetry(url, options = {}, config = {}) {
  const {
    retries = 3,
    baseDelayMs = 450,
    label = "external-api",
  } = config;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      const shouldRetry = response.status === 429 || response.status >= 500;
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        if (shouldRetry && attempt < retries) throw new Error(`${label} ${response.status}: ${text.slice(0, 180)}`);
        throw new Error(`${label} ${response.status}: ${text.slice(0, 180)}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt >= retries) {
        console.error(`[product-curation] ${label} falhou após retry:`, error.message);
        throw error;
      }

      const jitter = Math.round(Math.random() * 120);
      const delay = baseDelayMs * 2 ** attempt + jitter;
      console.warn(`[product-curation] ${label} tentativa ${attempt + 1} falhou; retry em ${delay}ms:`, error.message);
      await sleep(delay);
    }
  }

  return null;
}

async function fetchCatalogProducts(filters = {}) {
  const supabase = getProductCurationSupabase();
  if (!supabase) return [];

  const limit = clamp(toNumber(filters.limit, DEFAULT_LIMIT), 1, MAX_LIMIT);
  const candidateLimit = clamp(Math.max(limit * 4, 50), 1, 180);

  let query = supabase
    .from("catalog_products")
    .select(
      [
        "id",
        "source",
        "external_id",
        "title",
        "description",
        "images",
        "cost_price",
        "original_price",
        "suggested_price",
        "margin_percent",
        "category",
        "supplier_name",
        "stock_quantity",
        "is_active",
        "weight",
        "variants",
        "rating",
        "orders_count",
      ].join(","),
    )
    .eq("is_active", true)
    .gt("stock_quantity", 0)
    .order("orders_count", { ascending: false })
    .limit(candidateLimit);

  const mappedCategory = CATEGORY_MAP[String(filters.category ?? "").toLowerCase()];
  if (mappedCategory) query = query.eq("category", mappedCategory);
  else if (filters.category && filters.category !== "todos") query = query.ilike("category", `%${filters.category}%`);

  const { data, error } = await query;
  if (error) {
    console.error("[product-curation] erro ao buscar catalog_products:", error.message);
    return [];
  }
  return data ?? [];
}

async function fetchMlReference(product) {
  const title = pickSearchTitle(product);
  if (!title) return null;

  const url = new URL(ML_SEARCH_URL);
  url.searchParams.set("q", title);
  url.searchParams.set("limit", "20");

  const headers = {};
  if (process.env.ML_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.ML_ACCESS_TOKEN}`;

  const data = await fetchJsonWithRetry(url, { headers }, { label: "mercado-livre-search" });
  const items = Array.isArray(data?.results) ? data.results : [];
  if (!items.length) {
    return {
      items: [],
      averagePrice: null,
      soldQuantityTotal: 0,
      sellersCount: 0,
      totalResults: toNumber(data?.paging?.total, 0),
    };
  }

  const priced = items.map((item) => toNumber(item.price, 0)).filter((price) => price > 0);
  const averagePrice = priced.length
    ? priced.reduce((sum, price) => sum + price, 0) / priced.length
    : null;

  const sellers = new Set(items.map((item) => item?.seller?.id).filter(Boolean));
  const soldQuantityTotal = items.reduce((sum, item) => sum + toNumber(item?.sold_quantity, 0), 0);

  return {
    items,
    averagePrice,
    soldQuantityTotal,
    sellersCount: sellers.size,
    totalResults: toNumber(data?.paging?.total, items.length),
  };
}

function extractCostPrice(product) {
  const directCost = toNumber(product?.cost_price, 0);
  if (directCost > 0) return directCost;

  const variants = safeJson(product?.variants, []);
  const prices = Array.isArray(variants)
    ? variants.map((variant) => toNumber(variant?.price ?? variant?.sellPrice, 0)).filter((price) => price > 0)
    : [];

  if (prices.length) return Math.min(...prices);
  return toNumber(product?.original_price ?? product?.suggested_price, 0);
}

function scoreMargin(product, mlReference) {
  const supplierCost = extractCostPrice(product);
  const mlAveragePrice = toNumber(mlReference?.averagePrice, 0);
  const fallbackSuggested = toNumber(product?.suggested_price, 0);
  const referencePrice = mlAveragePrice > 0 ? mlAveragePrice : fallbackSuggested;

  if (supplierCost <= 0 || referencePrice <= 0) {
    return {
      score: 35,
      supplierCost,
      mlAveragePrice: mlAveragePrice || null,
      estimatedMarginPercent: null,
      reason: "dados insuficientes para margem real",
    };
  }

  const estimatedMarginPercent = ((referencePrice - supplierCost) / referencePrice) * 100;
  return {
    score: Math.round(clamp(estimatedMarginPercent * 2.2)),
    supplierCost: Number(supplierCost.toFixed(2)),
    mlAveragePrice: Number(referencePrice.toFixed(2)),
    estimatedMarginPercent: Number(estimatedMarginPercent.toFixed(2)),
  };
}

function extractShippingSignals(product) {
  const haystack = normalizeText(JSON.stringify(product));
  const hasBrazilWarehouse =
    haystack.includes("warehouse br") ||
    haystack.includes("br warehouse") ||
    haystack.includes("brazil warehouse") ||
    haystack.includes("brasil") ||
    haystack.includes('"br"');

  const explicitDays = [
    product?.shipping_days,
    product?.shippingDays,
    product?.delivery_days,
    product?.deliveryDays,
    product?.estimatedShippingDays,
  ]
    .map((value) => toNumber(value, 0))
    .filter((value) => value > 0);

  const parsedFromText = Array.from(haystack.matchAll(/(\d{1,2})\s*(?:-|a|to)?\s*(\d{1,2})?\s*dias?/g))
    .map((match) => toNumber(match[2] ?? match[1], 0))
    .filter((value) => value > 0);

  const estimatedDays = explicitDays.length || parsedFromText.length
    ? Math.min(...explicitDays, ...parsedFromText)
    : hasBrazilWarehouse
      ? 7
      : 25;

  return { hasBrazilWarehouse, estimatedDays };
}

function scoreShipping(product) {
  const { hasBrazilWarehouse, estimatedDays } = extractShippingSignals(product);
  let score;

  if (hasBrazilWarehouse) score = 100;
  else if (estimatedDays <= 7) score = 95;
  else if (estimatedDays <= 15) score = 85;
  else if (estimatedDays <= 25) score = 55;
  else if (estimatedDays <= 35) score = 30;
  else score = 10;

  return {
    score,
    estimatedDays,
    hasBrazilWarehouse,
  };
}

function scoreSupplier(product) {
  const rating = toNumber(product?.rating, 0);
  const ordersCount = toNumber(product?.orders_count, 0);
  const disputeRate = toNumber(product?.dispute_rate, NaN);
  const disputeCount = toNumber(product?.dispute_count, NaN);

  const ratingScore = rating > 0 ? clamp((rating / 5) * 100) : 65;
  const ordersScore = ordersCount > 0 ? clamp(Math.log10(ordersCount + 1) * 25) : 45;
  const disputeScore = Number.isFinite(disputeRate)
    ? clamp(100 - disputeRate * 100)
    : Number.isFinite(disputeCount)
      ? clamp(100 - disputeCount * 5)
      : 70;

  return {
    score: Math.round(ratingScore * 0.5 + ordersScore * 0.25 + disputeScore * 0.25),
    rating: rating || null,
    ordersCount,
    disputeRate: Number.isFinite(disputeRate) ? disputeRate : null,
    disputeCount: Number.isFinite(disputeCount) ? disputeCount : null,
  };
}

function scoreDemand(mlReference) {
  const soldQuantity = toNumber(mlReference?.soldQuantityTotal, 0);
  const totalResults = toNumber(mlReference?.totalResults, 0);
  const score = clamp(Math.log10(soldQuantity + 1) * 35 + Math.log10(totalResults + 1) * 12);

  return {
    score: Math.round(score),
    soldQuantity,
    totalResults,
  };
}

function scoreCompetition(mlReference) {
  const sellersCount = toNumber(mlReference?.sellersCount, 0);
  const totalResults = toNumber(mlReference?.totalResults, 0);
  const competitionCount = sellersCount || totalResults;
  let score = 70;

  if (competitionCount <= 0) score = 45;
  else if (competitionCount <= 3) score = 100;
  else if (competitionCount <= 8) score = 82;
  else if (competitionCount <= 15) score = 64;
  else if (competitionCount <= 30) score = 40;
  else score = 20;

  return {
    score,
    sellersCount,
    totalResults,
  };
}

function buildDiscardReasons(score) {
  const reasons = [];
  const criteria = score?.criteria ?? {};

  for (const [key, value] of Object.entries(criteria)) {
    if (toNumber(value?.score, 100) < 40) {
      reasons.push(`${key}:${value.score}`);
    }
  }

  if (criteria.margin?.estimatedMarginPercent != null && criteria.margin.estimatedMarginPercent < 10) {
    reasons.push(`margem baixa:${criteria.margin.estimatedMarginPercent}%`);
  }
  if (criteria.shipping?.estimatedDays > 25) {
    reasons.push(`envio lento:${criteria.shipping.estimatedDays} dias`);
  }

  return reasons.length ? reasons : ["score final abaixo de 40"];
}

function buildCacheKey(product) {
  const weights = getScoreWeights();
  return [
    "product-curation-score",
    stableProductId(product),
    product?.updated_at ?? "no-updated-at",
    JSON.stringify(weights),
  ].join(":");
}

export async function scoreProduct(product) {
  const cache = getProductCurationCache();
  const cacheKey = buildCacheKey(product);

  try {
    const cached = await cache.get(cacheKey);
    if (cached) return { ...cached, cached: true };
  } catch (error) {
    console.warn("[product-curation] falha ao ler cache:", error.message);
  }

  let mlReference = null;
  try {
    mlReference = await fetchMlReference(product);
  } catch (error) {
    console.error(`[product-curation] ML indisponível para ${stableProductId(product)}:`, error.message);
  }

  const criteria = {
    margin: scoreMargin(product, mlReference),
    shipping: scoreShipping(product),
    supplier: scoreSupplier(product),
    demand: scoreDemand(mlReference),
    competition: scoreCompetition(mlReference),
  };

  const weights = getScoreWeights();
  const finalScore = Math.round(
    criteria.margin.score * weights.margin +
    criteria.shipping.score * weights.shipping +
    criteria.supplier.score * weights.supplier +
    criteria.demand.score * weights.demand +
    criteria.competition.score * weights.competition,
  );

  const result = {
    productId: stableProductId(product),
    score: finalScore,
    weights,
    criteria,
    references: {
      mercadoLivre: {
        averagePrice: criteria.margin.mlAveragePrice,
        soldQuantity: criteria.demand.soldQuantity,
        sellersCount: criteria.competition.sellersCount,
        totalResults: criteria.demand.totalResults,
      },
    },
    scoredAt: new Date().toISOString(),
  };

  try {
    await cache.set(cacheKey, result, CACHE_TTL_SECONDS);
  } catch (error) {
    console.warn("[product-curation] falha ao salvar cache:", error.message);
  }

  return result;
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function applyResultFilters(product, score, filters) {
  const minScore = toNumber(filters.minScore, 0);
  const minMargin = filters.minMargin == null ? null : toNumber(filters.minMargin, null);
  const maxShippingDays = filters.maxShippingDays == null ? null : toNumber(filters.maxShippingDays, null);

  if (score.score < minScore) return false;
  if (minMargin != null && toNumber(score.criteria?.margin?.estimatedMarginPercent, -Infinity) < minMargin) return false;
  if (maxShippingDays != null && toNumber(score.criteria?.shipping?.estimatedDays, Infinity) > maxShippingDays) return false;
  if (product?.source && product.source !== "c7drop") return false;
  return true;
}

export async function getCuratedProducts(filters = {}) {
  const limit = clamp(toNumber(filters.limit, DEFAULT_LIMIT), 1, MAX_LIMIT);
  const products = await fetchCatalogProducts({ ...filters, limit });
  const scoredProducts = await mapWithConcurrency(products, 3, async (product) => {
    try {
      const score = await scoreProduct(product);

      if (score.score < MIN_PUBLISHABLE_SCORE) {
        console.warn("[product-curation] produto descartado por score baixo", {
          productId: stableProductId(product),
          title: product.title,
          score: score.score,
          reasons: buildDiscardReasons(score),
        });
        return null;
      }

      if (!applyResultFilters(product, score, filters)) return null;

      return {
        ...product,
        curation: score,
      };
    } catch (error) {
      console.error("[product-curation] erro ao pontuar produto", {
        productId: stableProductId(product),
        title: product?.title,
        error: error.message,
      });
      return null;
    }
  });

  const curated = scoredProducts
    .filter(Boolean)
    .sort((a, b) => b.curation.score - a.curation.score)
    .slice(0, limit);

  if (filters.userId) {
    await logAiActivity(
      filters.userId,
      `${curated.length} produtos C7Drop selecionados pela IA`,
      {
        source: "product_curation",
        analyzed: scoredProducts.length,
        selected: curated.length,
        limit,
        minScore: filters.minScore ?? null,
        category: filters.category ?? null,
      },
    );
  }

  return curated;
}

export const productCurationConfig = {
  cacheTtlSeconds: CACHE_TTL_SECONDS,
  defaultWeights: DEFAULT_WEIGHTS,
  activeWeights: getScoreWeights,
};
