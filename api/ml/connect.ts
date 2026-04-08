import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/ml/connect?user_id=<uuid>
 * Redireciona o usuário para a tela de autorização do Mercado Livre.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const userId = (req.query.user_id as string) || "";

  if (!userId) {
    return res.status(400).json({ error: "user_id is required" });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.ML_CLIENT_ID!,
    redirect_uri: process.env.ML_REDIRECT_URI!,
    state: userId,
  });

  const authUrl = `https://auth.mercadolivre.com.br/authorization?${params}`;
  return res.redirect(302, authUrl);
}
