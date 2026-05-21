import { getAuthenticatedUserFromRequest } from "../../server/products/authMiddleware.js";
import { productCurationConfig } from "../../server/products/productCurationService.js";
import { getPersonalizedProducts, invalidateUserRecommendations } from "../../server/products/personalizedProductService.js";

const SUPABASE_FUNCTIONS_URL = "https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1";

function parseNumberQuery(value, fallback = undefined) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAuthorizationHeader(req) {
  return req.headers?.authorization ?? req.headers?.Authorization ?? null;
}

async function requestCatalogSync(req) {
  const authorization = getAuthorizationHeader(req);
  if (!authorization) return { ok: false, reason: "missing_authorization" };

  try {
    const response = await fetch(`${SUPABASE_FUNCTIONS_URL}/cj-sync-request`, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
    });

    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      console.warn("[product-curation] sync CJ não concluiu:", response.status, payload);
      return { ok: false, status: response.status, payload };
    }

    console.log("[product-curation] sync CJ concluído:", payload);
    return { ok: true, status: response.status, payload };
  } catch (error) {
    console.error("[product-curation] erro ao solicitar sync CJ:", error);
    return { ok: false, error: error?.message ?? String(error) };
  }
}

async function loadCuratedProducts(userId, filters) {
  const recommendations = await getPersonalizedProducts(userId, filters);
  const products = Array.isArray(recommendations?.products)
    ? recommendations.products.slice(0, 3)
    : [];

  return { recommendations, products };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Usuário autenticado é obrigatório." });
    }

    const filters = {
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      minScore: parseNumberQuery(req.query.minScore, 0),
      minMargin: parseNumberQuery(req.query.minMargin),
      maxShippingDays: parseNumberQuery(req.query.maxShippingDays),
      limit: parseNumberQuery(req.query.limit, 3),
    };

    let { recommendations, products } = await loadCuratedProducts(user.id, filters);
    let sync = null;

    if (products.length === 0) {
      console.warn("[product-curation] curadoria vazia; solicitando sync do catálogo CJ.");
      sync = await requestCatalogSync(req);

      if (sync?.ok) {
        await invalidateUserRecommendations(user.id);
        ({ recommendations, products } = await loadCuratedProducts(user.id, filters));
      }
    }

    return res.status(200).json({
      products,
      total: products.length,
      filters,
      profile: recommendations.profile,
      rule: recommendations.rule,
      sync,
      scoring: {
        weights: productCurationConfig.activeWeights(),
        cacheTtlSeconds: productCurationConfig.cacheTtlSeconds,
      },
    });
  } catch (error) {
    console.error("[product-curation] erro na função /api/products/curated:", error);
    return res.status(500).json({
      error: "Não foi possível carregar produtos curados agora.",
      details: error?.message ?? String(error),
      products: [],
    });
  }
}