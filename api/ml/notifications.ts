import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/ml/notifications
 * Endpoint registrado no Mercado Livre para receber notificações (webhooks).
 * Por ora apenas confirma o recebimento com 200 OK.
 */
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ status: "ok" });
}
