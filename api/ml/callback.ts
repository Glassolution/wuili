import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const DASHBOARD_URL = "https://wuili.vercel.app/dashboard";

/**
 * GET /api/ml/callback?code=<code>&state=<user_id>
 * Recebe o code do Mercado Livre, troca por tokens e salva no Supabase.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = req.query.code as string;
  const userId = req.query.state as string; // state = user_id passado no connect

  if (!code || !userId) {
    return res.redirect(302, `${DASHBOARD_URL}?ml_error=missing_params`);
  }

  // Trocar o code por access_token + refresh_token
  let tokens: Record<string, any>;
  try {
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.ML_CLIENT_ID!,
        client_secret: process.env.ML_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.ML_REDIRECT_URI!,
      }),
    });
    tokens = await tokenRes.json();
  } catch {
    return res.redirect(302, `${DASHBOARD_URL}?ml_error=token_failed`);
  }

  if (!tokens.access_token) {
    console.error("ML token error:", JSON.stringify(tokens));
    return res.redirect(302, `${DASHBOARD_URL}?ml_error=token_failed`);
  }

  // Salvar no Supabase usando service role (bypassa RLS)
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: userId,
      platform: "mercadolivre",
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      ml_user_id: tokens.user_id ?? null,
      expires_at: new Date(Date.now() + (tokens.expires_in ?? 21600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,platform" }
  );

  if (error) {
    console.error("Supabase upsert error:", error.message);
    return res.redirect(302, `${DASHBOARD_URL}?ml_error=db_failed`);
  }

  return res.redirect(302, `${DASHBOARD_URL}?ml_connected=true`);
}
