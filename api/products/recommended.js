import { getAuthenticatedUserFromRequest } from "../../server/products/authMiddleware.js";
import { getPersonalizedProducts } from "../../server/products/personalizedProductService.js";

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
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Usuário autenticado é obrigatório." });
    }

    const filters = {
      category: typeof req.query.category === "string" ? req.query.category : undefined,
      minScore: parseNumberQuery(req.query.minScore, 0),
      minMargin: parseNumberQuery(req.query.minMargin),
      maxShippingDays: parseNumberQuery(req.query.maxShippingDays),
      limit: parseNumberQuery(req.query.limit),
    };

    const recommendations = await getPersonalizedProducts(user.id, filters);

    return res.status(200).json({
      ...recommendations,
      filters,
    });
  } catch (error) {
    console.error("[product-recommendations] erro na função /api/products/recommended:", error);
    return res.status(500).json({
      error: "Não foi possível carregar recomendações personalizadas agora.",
      products: [],
    });
  }
}

