import {
  getCuratedProducts,
  getProductCurationCache,
  getProductCurationSupabase,
} from "./productCurationService.js";

const BEGINNER_LIMIT = 20;
const INTERMEDIATE_LIMIT = 40;
const DEFAULT_LIMIT = 30;
const PERSONALIZATION_CACHE_TTL_SECONDS = 60 * 60 * 6;
const USER_CACHE_VERSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const FALLBACK_POPULAR_CATEGORIES = [
  "Eletrônicos e Gadgets",
  "Beleza e Cuidados Pessoais",
  "Casa e Jardim",
  "Organização e Utilidades",
];

function clamp(value, min = 0, max = 100) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
}

function normalizeCategory(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function getProductId(product) {
  return String(product?.id ?? product?.external_id ?? product?.curation?.productId ?? "");
}

function getMargin(product) {
  return toNumber(product?.curation?.criteria?.margin?.estimatedMarginPercent, toNumber(product?.margin_percent, 0));
}

function getShippingDays(product) {
  return toNumber(product?.curation?.criteria?.shipping?.estimatedDays, Infinity);
}

function getCompetitionScore(product) {
  return toNumber(product?.curation?.criteria?.competition?.score, 0);
}

function getDemandScore(product) {
  return toNumber(product?.curation?.criteria?.demand?.score, 0);
}

function getBaseScore(product) {
  return toNumber(product?.curation?.score, 0);
}

function buildCacheKey(userId, filters, version) {
  return [
    "personalized-products",
    userId,
    version,
    JSON.stringify({
      category: filters.category ?? null,
      minScore: filters.minScore ?? null,
      minMargin: filters.minMargin ?? null,
      maxShippingDays: filters.maxShippingDays ?? null,
      limit: filters.limit ?? null,
    }),
  ].join(":");
}

function buildUserVersionKey(userId) {
  return `personalized-products:${userId}:version`;
}

function normalizeProfile(rawProfile = {}, salesHistory = [], preferredCategories = []) {
  const experienceLevel =
    rawProfile.experienceLevel ??
    rawProfile.experience_level ??
    rawProfile.experience ??
    "beginner";

  return {
    ...rawProfile,
    experienceLevel: ["beginner", "intermediate", "advanced"].includes(experienceLevel)
      ? experienceLevel
      : "beginner",
    preferredCategories,
    salesHistory,
    onboardingCompleted: Boolean(
      rawProfile.onboardingCompleted ??
      rawProfile.onboarding_completed ??
      rawProfile.onboarding_complete ??
      false,
    ),
    weeklyAvailability: rawProfile.weeklyAvailability ?? rawProfile.weekly_availability ?? null,
    dismissedProducts: safeArray(
      rawProfile.dismissedProducts ??
      rawProfile.dismissed_products ??
      [],
    ),
  };
}

async function fetchProfile(userId) {
  const supabase = getProductCurationSupabase();
  if (!supabase) {
    return normalizeProfile({}, [], []);
  }

  const [{ data: profile, error: profileError }, { data: orders, error: ordersError }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("orders")
      .select("cj_product_id, product_title, profit, sale_price, cost_price, ordered_at, raw")
      .eq("user_id", userId)
      .order("ordered_at", { ascending: false })
      .limit(200),
  ]);

  if (profileError) {
    console.warn("[product-recommendations] perfil indisponível; usando fallback:", profileError.message);
  }
  if (ordersError) {
    console.warn("[product-recommendations] histórico de vendas indisponível; usando fallback:", ordersError.message);
  }

  const rawProfile = profile ?? {};
  const profileSalesHistory = safeArray(rawProfile.salesHistory ?? rawProfile.sales_history);
  const orderSalesHistory = (orders ?? []).map((order) => ({
    productId: order.cj_product_id ?? order.product_title,
    category: order.raw?.category ?? order.raw?.product?.category ?? null,
    margin: order.profit != null && order.sale_price
      ? Number(((order.profit / order.sale_price) * 100).toFixed(2))
      : order.sale_price && order.cost_price
        ? Number((((order.sale_price - order.cost_price) / order.sale_price) * 100).toFixed(2))
        : null,
    soldAt: order.ordered_at,
  }));

  const preferredCategories = safeArray(
    rawProfile.preferredCategories ??
    rawProfile.preferred_categories ??
    (rawProfile.categoryPreferences ?? rawProfile.category_preferences
      ? Object.entries(rawProfile.categoryPreferences ?? rawProfile.category_preferences)
        .sort((a, b) => toNumber(b[1]) - toNumber(a[1]))
        .map(([category]) => category)
      : null) ??
    rawProfile.interested_categories ??
    rawProfile.nicho,
  );

  return normalizeProfile(
    rawProfile,
    profileSalesHistory.length ? profileSalesHistory : orderSalesHistory,
    preferredCategories,
  );
}

async function getPopularCategories() {
  const cache = getProductCurationCache();
  const cacheKey = "personalized-products:popular-categories";

  try {
    const cached = await cache.get(cacheKey);
    if (cached?.length) return cached;
  } catch (error) {
    console.warn("[product-recommendations] cache de categorias populares indisponível:", error.message);
  }

  const supabase = getProductCurationSupabase();
  if (!supabase) return FALLBACK_POPULAR_CATEGORIES;

  try {
    const { data, error } = await supabase
      .from("catalog_products")
      .select("category, orders_count")
      .eq("source", "c7drop")
      .eq("is_active", true)
      .not("category", "is", null)
      .order("orders_count", { ascending: false })
      .limit(250);

    if (error) throw error;

    const totals = new Map();
    for (const product of data ?? []) {
      const category = product.category;
      if (!category) continue;
      totals.set(category, (totals.get(category) ?? 0) + toNumber(product.orders_count, 0));
    }

    const categories = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category]) => category)
      .slice(0, 5);

    const resolved = categories.length ? categories : FALLBACK_POPULAR_CATEGORIES;
    await cache.set(cacheKey, resolved, PERSONALIZATION_CACHE_TTL_SECONDS);
    return resolved;
  } catch (error) {
    console.warn("[product-recommendations] erro ao calcular categorias populares:", error.message);
    return FALLBACK_POPULAR_CATEGORIES;
  }
}

function hasExploredProduct(product, salesHistory) {
  const productId = getProductId(product);
  const productCategory = normalizeCategory(product.category);

  return salesHistory.some((sale) => {
    const soldProductId = String(sale.productId ?? sale.product_id ?? "");
    const soldCategory = normalizeCategory(sale.category);
    return (!!productId && productId === soldProductId) || (!!productCategory && productCategory === soldCategory);
  });
}

function opportunityScore(product, salesHistory) {
  const margin = getMargin(product);
  const competition = getCompetitionScore(product);
  const unexploredBonus = hasExploredProduct(product, salesHistory) ? 0 : 18;
  return Math.round(clamp(margin * 0.9 + competition * 0.45 + unexploredBonus));
}

function withPersonalizedScore(product, score, rule, extra = {}) {
  return {
    ...product,
    personalizedScore: Math.round(clamp(score)),
    personalizationRule: rule,
    ...extra,
  };
}

function personalizeForBeginner(products) {
  return products
    .filter((product) => {
      const margin = getMargin(product);
      const shippingDays = getShippingDays(product);
      const shippingScore = toNumber(product?.curation?.criteria?.shipping?.score, 0);
      const competitionScore = getCompetitionScore(product);

      return margin >= 20 && margin <= 60 && (shippingDays < 15 || shippingScore >= 85) && competitionScore >= 50;
    })
    .map((product) => {
      const margin = getMargin(product);
      const marginFit = 100 - Math.abs(40 - margin) * 2;
      const score = getBaseScore(product) * 0.35 +
        toNumber(product?.curation?.criteria?.shipping?.score, 0) * 0.35 +
        getCompetitionScore(product) * 0.2 +
        marginFit * 0.1;
      return withPersonalizedScore(product, score, "beginner_fast_shipping_low_competition");
    })
    .sort((a, b) => b.personalizedScore - a.personalizedScore)
    .slice(0, BEGINNER_LIMIT);
}

function filterDismissedProducts(products, dismissedProducts) {
  const dismissed = new Set(safeArray(dismissedProducts).map(String));
  if (!dismissed.size) return products;

  return products.filter((product) => {
    const candidates = [
      product?.id,
      product?.external_id,
      product?.curation?.productId,
    ].filter(Boolean).map(String);

    return !candidates.some((candidate) => dismissed.has(candidate));
  });
}

function personalizeForIntermediate(products, profile, limit) {
  const preferredSet = new Set(profile.preferredCategories.map(normalizeCategory));

  const scored = products.map((product) => {
    const isPreferred = preferredSet.has(normalizeCategory(product.category));
    const comfortBonus = isPreferred ? 14 : 6;
    const noveltyBonus = isPreferred ? 0 : 12;
    const score = getBaseScore(product) * 0.25 +
      getDemandScore(product) * 0.3 +
      toNumber(product?.curation?.criteria?.margin?.score, 0) * 0.3 +
      getCompetitionScore(product) * 0.1 +
      comfortBonus +
      noveltyBonus;

    return withPersonalizedScore(product, score, isPreferred ? "intermediate_preferred_category" : "intermediate_discovery", {
      outsideComfortZone: !isPreferred,
    });
  });

  const preferred = scored
    .filter((product) => !product.outsideComfortZone)
    .sort((a, b) => b.personalizedScore - a.personalizedScore);
  const discovery = scored
    .filter((product) => product.outsideComfortZone)
    .sort((a, b) => b.personalizedScore - a.personalizedScore);

  const discoveryTarget = Math.max(Math.floor(limit * 0.25), discovery.length ? 1 : 0);
  const mixed = [
    ...preferred.slice(0, Math.max(limit - discoveryTarget, 0)),
    ...discovery.slice(0, discoveryTarget),
  ];

  return mixed
    .sort((a, b) => b.personalizedScore - a.personalizedScore)
    .slice(0, limit);
}

function personalizeForAdvanced(products, profile, limit) {
  return products
    .map((product) => {
      const opportunity = opportunityScore(product, profile.salesHistory);
      const score = getBaseScore(product) * 0.65 + opportunity * 0.35;
      return withPersonalizedScore(product, score, "advanced_opportunity_score", {
        opportunityScore: opportunity,
      });
    })
    .sort((a, b) => b.personalizedScore - a.personalizedScore)
    .slice(0, limit);
}

function baseLimitForProfile(profile, filters) {
  if (filters.limit) return toNumber(filters.limit, DEFAULT_LIMIT);
  const base = profile.experienceLevel === "beginner"
    ? BEGINNER_LIMIT
    : profile.experienceLevel === "intermediate"
      ? INTERMEDIATE_LIMIT
      : DEFAULT_LIMIT;

  if (profile.weeklyAvailability === "Menos de 2h" || profile.weeklyAvailability === "less_than_2h") {
    return Math.min(base, profile.experienceLevel === "beginner" ? 12 : 24);
  }
  if (profile.weeklyAvailability === "Mais de 5h" || profile.weeklyAvailability === "more_than_5h") {
    return Math.min(Math.round(base * 1.25), 60);
  }
  return base;
}

export async function getPersonalizedProducts(userId, filters = {}) {
  if (!userId) throw new Error("userId é obrigatório.");

  const cache = getProductCurationCache();
  const version = await getUserRecommendationCacheVersion(userId);
  const cacheKey = buildCacheKey(userId, filters, version);

  try {
    const cached = await cache.get(cacheKey);
    if (cached) return { ...cached, cached: true };
  } catch (error) {
    console.warn("[product-recommendations] cache personalizado indisponível:", error.message);
  }

  const [profile, popularCategories] = await Promise.all([
    fetchProfile(userId),
    getPopularCategories(),
  ]);

  if (!profile.preferredCategories.length) {
    profile.preferredCategories = popularCategories;
  }

  const limit = baseLimitForProfile(profile, filters);
  const baseFilters = {
    ...filters,
    limit: Math.min(Math.max(limit * 3, limit), 100),
  };

  if (profile.experienceLevel === "beginner" && !profile.onboardingCompleted) {
    baseFilters.category = popularCategories[0];
  }

  const curatedProducts = filterDismissedProducts(
    await getCuratedProducts({ ...baseFilters, userId }),
    profile.dismissedProducts,
  );
  let products;
  let rule;

  if (profile.experienceLevel === "beginner") {
    rule = profile.onboardingCompleted
      ? "beginner_fast_shipping_low_competition"
      : "beginner_onboarding_popular_category";
    products = personalizeForBeginner(curatedProducts);
  } else if (profile.experienceLevel === "intermediate") {
    rule = "intermediate_preferred_plus_discovery";
    products = personalizeForIntermediate(curatedProducts, profile, limit);
  } else {
    rule = "advanced_min_score_with_opportunity";
    products = personalizeForAdvanced(curatedProducts, profile, limit);
  }

  const result = {
    products,
    total: products.length,
    rule,
    profile: {
      experienceLevel: profile.experienceLevel,
      preferredCategories: profile.preferredCategories,
      onboardingCompleted: profile.onboardingCompleted,
      weeklyAvailability: profile.weeklyAvailability,
      dismissedProductsCount: profile.dismissedProducts.length,
    },
    generatedAt: new Date().toISOString(),
  };

  console.log("[product-recommendations] regra aplicada", {
    userId,
    rule,
    experienceLevel: profile.experienceLevel,
    preferredCategories: profile.preferredCategories,
    returned: products.length,
  });

  try {
    await cache.set(cacheKey, result, PERSONALIZATION_CACHE_TTL_SECONDS);
  } catch (error) {
    console.warn("[product-recommendations] falha ao salvar cache personalizado:", error.message);
  }

  return result;
}

export async function getUserRecommendationCacheVersion(userId) {
  const cache = getProductCurationCache();
  const key = buildUserVersionKey(userId);

  try {
    const version = await cache.get(key);
    return version ?? "v1";
  } catch (error) {
    console.warn("[product-recommendations] falha ao ler versão do cache:", error.message);
    return "v1";
  }
}

export async function invalidateUserRecommendations(userId) {
  if (!userId) return null;

  const cache = getProductCurationCache();
  const key = buildUserVersionKey(userId);
  const version = `v${Date.now()}`;

  try {
    await cache.set(key, version, USER_CACHE_VERSION_TTL_SECONDS);
    console.log("[product-recommendations] cache do usuário invalidado", { userId, version });
    return version;
  } catch (error) {
    console.warn("[product-recommendations] falha ao invalidar cache do usuário:", error.message);
    return null;
  }
}
