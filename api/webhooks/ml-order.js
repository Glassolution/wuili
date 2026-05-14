import {
  processMercadoLivreOrderWebhookFireAndForget,
  validateMercadoLivreWebhookSignature,
} from "../../server/products/mlWebhookService.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido." });
  }

  const payload = req.body ?? {};

  if (!validateMercadoLivreWebhookSignature(payload, req.headers)) {
    return res.status(401).json({ error: "Assinatura inválida." });
  }

  processMercadoLivreOrderWebhookFireAndForget(payload, req.headers);
  return res.status(202).json({ accepted: true });
}

