export type TrendingMetricProduct = {
  id: string;
  title?: string | null;
  images?: unknown;
  category?: string | null;
  suggested_price?: number | null;
  cost_price?: number | null;
  original_price?: number | null;
  margin_percent?: number | null;
  rating?: number | null;
  orders_count?: number | null;
  stock_quantity?: number | null;
  demand_score?: number | null;
  score?: number | null;
};

export type TrendingDisplayMetrics = {
  monthlySales: number;
  monthlyRevenue: number;
  rating: number;
  reviewsCount: number;
  estimatedSales: boolean;
  estimatedRating: boolean;
};

export const MIN_TRENDING_MONTHLY_SALES = 24;
export const MIN_TRENDING_RATING = 4.3;
export const MIN_TRENDING_REVIEWS = 80;
export const MAX_TRENDING_RATING = 4.8;

const hashToUnit = (seed: string) => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 10000) / 10000;
};

const normalizeText = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");

const getCategoryMultiplier = (category: string | null | undefined) => {
  const normalized = normalizeText(category);
  if (/beleza|barbearia|maquiagem|saude|bem-estar|cuidados/.test(normalized)) return 1.22;
  if (/casa|decoracao|cozinha|organizacao/.test(normalized)) return 1.16;
  if (/fone|som|eletron|informatica|smart|audio|caixa/.test(normalized)) return 1.12;
  if (/moda|acessorio|relogio|bolsa|joia/.test(normalized)) return 1.08;
  if (/pet|infantil|bebe|brinquedo/.test(normalized)) return 1.04;
  if (/ferramenta|automotivo|moto/.test(normalized)) return 0.96;
  return 1;
};

const getImageCount = (images: unknown) => {
  if (Array.isArray(images)) {
    return Math.max(1, images.filter((item) => typeof item === "string" && item.trim().length > 0).length);
  }

  if (typeof images === "string" && images.trim()) {
    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? Math.max(1, parsed.length) : 1;
    } catch {
      return 1;
    }
  }

  return 1;
};

const priceMultiplier = (price: number) => {
  if (price <= 0) return 1;
  if (price <= 45) return 1.2;
  if (price <= 90) return 1.1;
  if (price <= 160) return 1;
  if (price <= 320) return 0.88;
  return 0.76;
};

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

const roundRating = (value: number) =>
  Math.min(MAX_TRENDING_RATING, Math.max(MIN_TRENDING_RATING, Math.round(value * 10) / 10));

export const getTrendingDisplayMetrics = (product: TrendingMetricProduct): TrendingDisplayMetrics => {
  const price = Number(product.suggested_price ?? product.original_price ?? product.cost_price ?? 0);
  const rawSales = Math.round(Number(product.orders_count ?? 0));
  const seed = `${product.id}:${product.title ?? ""}:${product.category ?? ""}`;
  const demandSeed = hashToUnit(`${seed}:demand`);
  const ratingSeed = hashToUnit(`${seed}:rating`);
  const reviewSeed = hashToUnit(`${seed}:reviews`);
  const imageCount = getImageCount(product.images);
  const margin = Number(product.margin_percent ?? 0);
  const stock = product.stock_quantity === null || product.stock_quantity === undefined ? 120 : Number(product.stock_quantity);
  const score = Math.max(0, Math.min(1, Number(product.score ?? product.demand_score ?? 0)));

  const shouldEstimateSales = rawSales < MIN_TRENDING_MONTHLY_SALES || rawSales === 10;
  const baseSales = 38 + demandSeed * 170;
  const marginFactor = 0.82 + Math.min(0.42, Math.max(0, margin) / 140);
  const stockFactor = stock <= 20 ? 0.82 : stock <= 60 ? 0.94 : stock >= 300 ? 1.16 : 1.04;
  const imageFactor = 1 + Math.min(10, imageCount) * 0.025;
  const scoreFactor = 0.92 + score * 0.26;
  const estimatedSales = Math.max(
    MIN_TRENDING_MONTHLY_SALES,
    Math.round(baseSales * getCategoryMultiplier(product.category) * priceMultiplier(price) * marginFactor * stockFactor * imageFactor * scoreFactor),
  );
  const monthlySales = shouldEstimateSales ? estimatedSales : rawSales;

  const rawRating = Number(product.rating ?? 0);
  const shouldEstimateRating = rawRating < MIN_TRENDING_RATING;
  const catalogRating = 4.35 + ratingSeed * 0.5 + Math.min(0.08, monthlySales / 2400);
  const rating = shouldEstimateRating ? roundRating(catalogRating) : roundRating(rawRating);
  const reviewsBase = monthlySales * (2.1 + reviewSeed * 2.4) + 35 + imageCount * 3;
  const reviewsCount = Math.max(MIN_TRENDING_REVIEWS, Math.round(reviewsBase));

  return {
    monthlySales,
    monthlyRevenue: price * monthlySales,
    rating,
    reviewsCount,
    estimatedSales: shouldEstimateSales,
    estimatedRating: shouldEstimateRating,
  };
};

export const getTrendingDisplayScore = (product: TrendingMetricProduct) => {
  const metrics = getTrendingDisplayMetrics(product);
  const margin = Number(product.margin_percent ?? 0);
  const imageCount = getImageCount(product.images);
  const demandScore = clampUnit(Math.log1p(metrics.monthlySales) / Math.log(501));
  const marginScore = clampUnit(margin / 70);
  const ratingScore = clampUnit((metrics.rating - MIN_TRENDING_RATING) / (MAX_TRENDING_RATING - MIN_TRENDING_RATING));
  const reviewsScore = clampUnit(Math.log1p(metrics.reviewsCount) / Math.log(1501));
  const imageScore = clampUnit(imageCount / 10);

  return demandScore * 0.42 + marginScore * 0.22 + ratingScore * 0.18 + reviewsScore * 0.12 + imageScore * 0.06;
};
