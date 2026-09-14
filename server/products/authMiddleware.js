import { createClient } from "@supabase/supabase-js";
import { getProductCurationSupabase } from "./productCurationService.js";

let authClient;

function getAuthClient() {
  if (authClient) return authClient;

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? process.env.DB_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !anonKey) return null;

  authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return authClient;
}

function extractBearerToken(req) {
  const header = req.headers?.authorization ?? req.headers?.Authorization;
  if (typeof header !== "string") return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

export async function getAuthenticatedUserFromRequest(req) {
  const token = extractBearerToken(req);
  if (!token) return null;

  const auth = getAuthClient() ?? getProductCurationSupabase();
  if (!auth?.auth?.getUser) return null;

  const { data, error } = await auth.auth.getUser(token);
  if (error || !data?.user) {
    console.warn("[product-recommendations] token inválido:", error?.message ?? "sem usuário");
    return null;
  }

  return data.user;
}

export async function requireAuthenticatedUser(req, res, next) {
  try {
    const user = await getAuthenticatedUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: "Usuário autenticado é obrigatório." });
    }

    req.user = user;
    return next();
  } catch (error) {
    console.error("[product-recommendations] erro no middleware de auth:", error);
    return res.status(401).json({ error: "Não foi possível autenticar o usuário." });
  }
}

