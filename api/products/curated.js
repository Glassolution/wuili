import { getCuratedProducts, productCurationConfig } from "../../server/products/productCurationService.js";

function parseNumberQuery(value, fallback = undefined) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const filters = {
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      minScore: parseNumberQuery(req.query.minScore, 0),
      minMargin: parseNumberQuery(req.query.minMargin),
      maxShippingDays: parseNumberQuery(req.query.maxShippingDays),
      limit: parseNumberQuery(req.query.limit, 30),
    };

    const products = await getCuratedProducts(filters);

    return res.status(200).json({
      products,
      total: products.length,
      filters,
      scoring: {
        weights: productCurationConfig.activeWeights(),
        cacheTtlSeconds: productCurationConfig.cacheTtlSeconds,
      },
    });
  } catch (error) {
    console.error("[product-curation] erro na função /api/products/curated:", error);
    return res.status(500).json({
      error: "Não foi possível carregar produtos curados agora.",
      products: [],
    });
  }
}

