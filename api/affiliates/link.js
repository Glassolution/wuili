import { createClient } from "@supabase/supabase-js";
import { getAffiliateLinkForUser } from "../../server/affiliates/affiliateLinkService.js";

function extractBearerToken(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function getAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? process.env.DB_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAuthenticatedUserFromRequest(req) {
  const token = extractBearerToken(req);
  if (!token) return null;
  const auth = getAuthClient();
  if (!auth?.auth?.getUser) return null;
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Metodo nao permitido." });
  }

  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Usuario autenticado e obrigatorio." });
    }

    const affiliateLink = await getAffiliateLinkForUser(req, user.id);
    return res.status(200).json(affiliateLink);
  } catch (error) {
    console.error("[affiliates] erro completo em GET /api/affiliates/link:", error);
    return res.status(500).json({
      error: "Nao foi possivel buscar o link de afiliado.",
      message: error?.message ?? "Erro desconhecido.",
    });
  }
}

