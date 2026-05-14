import { getAuthenticatedUserFromRequest } from "../../server/products/authMiddleware.js";
import { trackEventFireAndForget } from "../../server/products/feedbackService.js";

const VALID_FEEDBACK_EVENTS = new Set([
  "product_viewed",
  "product_clicked_buy",
  "product_sold",
  "product_dismissed",
]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Usuário autenticado é obrigatório." });
    }

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

    trackEventFireAndForget(user.id, eventType, {
      productId,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
      category: metadata?.category,
      margin: metadata?.margin,
    });

    return res.status(202).json({ accepted: true });
  } catch (error) {
    console.error("[product-feedback] erro na função /api/products/feedback:", error);
    return res.status(202).json({ accepted: true, logged: false });
  }
}
