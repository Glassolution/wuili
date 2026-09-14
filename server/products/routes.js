import { Router } from "express";
import { productCurationConfig, scoreProduct } from "./productCurationService.js";
import { requireAuthenticatedUser } from "./authMiddleware.js";
import { getPersonalizedProducts, invalidateUserRecommendations } from "./personalizedProductService.js";
import { trackEventFireAndForget } from "./feedbackService.js";
import {
  OnboardingError,
  completeOnboarding,
  getOnboardingStatus,
  saveOnboardingStep,
} from "./onboardingService.js";
import {
  processMercadoLivreOrderWebhookFireAndForget,
  validateMercadoLivreWebhookSignature,
} from "./mlWebhookService.js";

const router = Router();

const SUPABASE_FUNCTIONS_URL = "https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1";

function getAuthorizationHeader(req) {
  return req.headers?.authorization ?? req.headers?.Authorization ?? null;
}

// Catálogo alimentado exclusivamente pelo scraper C7Drop. Mantemos a função
// como no-op para preservar a assinatura usada em loadCuratedProducts.
async function requestCatalogSync(_req) {
  return { ok: false, reason: "catalog_sync_managed_by_c7drop_cron" };
}


async function loadCuratedProducts(userId, filters) {
  const recommendations = await getPersonalizedProducts(userId, filters);
  const products = Array.isArray(recommendations?.products)
    ? recommendations.products.slice(0, 3)
    : [];

  return { recommendations, products };
}
const VALID_FEEDBACK_EVENTS = new Set([
  "product_viewed",
  "product_clicked_buy",
  "product_sold",
  "product_dismissed",
]);

function parseNumberQuery(value, fallback = undefined) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

router.get("/api/products/curated", requireAuthenticatedUser, async (req, res) => {
  try {
    const filters = {
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      minScore: parseNumberQuery(req.query.minScore, 0),
      minMargin: parseNumberQuery(req.query.minMargin),
      maxShippingDays: parseNumberQuery(req.query.maxShippingDays),
      limit: parseNumberQuery(req.query.limit, 3),
    };

    let { recommendations, products } = await loadCuratedProducts(req.user.id, filters);
    let sync = null;

    if (products.length === 0) {
      console.warn("[product-curation] curadoria vazia; aguardando próximo cron C7Drop.");
      sync = await requestCatalogSync(req);

      if (sync?.ok) {
        await invalidateUserRecommendations(req.user.id);
        ({ recommendations, products } = await loadCuratedProducts(req.user.id, filters));
      }
    }

    return res.json({
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
    console.error("[product-curation] erro no endpoint /api/products/curated:", error);
    return res.status(500).json({
      error: "Não foi possível carregar produtos curados agora.",
      details: error?.message ?? String(error),
      products: [],
    });
  }
});

router.get("/api/products/recommended", requireAuthenticatedUser, async (req, res) => {
  try {
    const filters = {
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      minScore: parseNumberQuery(req.query.minScore, 0),
      minMargin: parseNumberQuery(req.query.minMargin),
      maxShippingDays: parseNumberQuery(req.query.maxShippingDays),
      limit: parseNumberQuery(req.query.limit),
    };

    const recommendations = await getPersonalizedProducts(req.user.id, filters);

    return res.json({
      ...recommendations,
      filters,
    });
  } catch (error) {
    console.error("[product-recommendations] erro no endpoint /api/products/recommended:", error);
    return res.status(500).json({
      error: "Não foi possível carregar recomendações personalizadas agora.",
      products: [],
    });
  }
});

router.post("/api/products/feedback", requireAuthenticatedUser, async (req, res) => {
  const { productId, eventType, metadata } = req.body ?? {};

  if (!productId || typeof productId !== "string") {
    return res.status(400).json({ error: "productId é obrigatório." });
  }

  if (!eventType || typeof eventType !== "string") {
    return res.status(400).json({ error: "eventType é obrigatório." });
  }
  if (!VALID_FEEDBACK_EVENTS.has(eventType)) {
    return res.status(400).json({ error: "eventType inválido." });
  }

  trackEventFireAndForget(req.user.id, eventType, {
    productId,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
    category: metadata?.category,
    margin: metadata?.margin,
  });

  return res.status(202).json({ accepted: true });
});

router.get("/api/onboarding/status", requireAuthenticatedUser, async (req, res) => {
  try {
    return res.json(await getOnboardingStatus(req.user.id));
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    console.error("[onboarding] erro ao carregar status:", error);
    return res.status(status).json({ error: error.message ?? "Não foi possível carregar o onboarding." });
  }
});

router.post("/api/onboarding/step/:stepNumber", requireAuthenticatedUser, async (req, res) => {
  try {
    return res.json(await saveOnboardingStep(req.user.id, req.params.stepNumber, req.body ?? {}));
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    console.error("[onboarding] erro ao salvar etapa:", error);
    return res.status(status).json({ error: error.message ?? "Não foi possível salvar o onboarding." });
  }
});

router.post("/api/onboarding/complete", requireAuthenticatedUser, async (req, res) => {
  try {
    return res.json(await completeOnboarding(req.user.id));
  } catch (error) {
    const status = error instanceof OnboardingError ? error.status : 500;
    console.error("[onboarding] erro ao concluir:", error);
    return res.status(status).json({ error: error.message ?? "Não foi possível concluir o onboarding." });
  }
});

router.post("/api/webhooks/ml-order", (req, res) => {
  const payload = req.body ?? {};

  if (!validateMercadoLivreWebhookSignature(payload, req.headers)) {
    return res.status(401).json({ error: "Assinatura inválida." });
  }

  processMercadoLivreOrderWebhookFireAndForget(payload, req.headers);
  return res.status(202).json({ accepted: true });
});

router.post("/api/products/curated/score", async (req, res) => {
  try {
    if (!req.body?.product) {
      return res.status(400).json({ error: "product é obrigatório." });
    }

    const score = await scoreProduct(req.body.product);
    return res.json(score);
  } catch (error) {
    console.error("[product-curation] erro no endpoint /api/products/curated/score:", error);
    return res.status(500).json({ error: "Não foi possível calcular o score do produto." });
  }
});

export default router;
