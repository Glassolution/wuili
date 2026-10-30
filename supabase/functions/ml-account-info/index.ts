// Mostra qual conta do Mercado Livre está ligada à Velo (apelido + ID).
//
// Motivo: clientes com mais de uma conta do ML não sabem qual está conectada, e o
// suporte também não via. O apelido é buscado em GET /users/me só quando ainda
// não está salvo (ou quando `refresh` é pedido) e fica gravado na integração.
// Se o token estiver vencido ou o ML falhar, devolve só o ID com um aviso.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getSellerAccessToken } from "../_shared/mlSellerToken.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Apelidos mais velhos que isto são reconferidos (a pessoa pode trocar o apelido no ML). */
const NICKNAME_MAX_AGE_MS = 7 * 24 * 3600 * 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(authHeader.slice(7));
  const callerId = claims?.claims?.sub as string | undefined;
  if (claimsError || !callerId) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  // Admin pode consultar a conta de outro usuário (painel de suporte).
  let targetId = callerId;
  if (typeof body?.user_id === "string" && body.user_id !== callerId) {
    const { data: role } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) return json({ error: "forbidden" }, 403);
    targetId = body.user_id;
  }

  const { data: integration } = await admin
    .from("user_integrations")
    .select("ml_user_id, ml_nickname, ml_nickname_updated_at, access_token")
    .eq("user_id", targetId)
    .eq("platform", "mercadolivre")
    .maybeSingle();

  if (!integration?.access_token) return json({ connected: false });

  const base = {
    connected: true,
    ml_user_id: integration.ml_user_id ? String(integration.ml_user_id) : null,
    nickname: integration.ml_nickname ?? null,
    warning: null as string | null,
  };

  const age = integration.ml_nickname_updated_at
    ? Date.now() - new Date(integration.ml_nickname_updated_at).getTime()
    : Number.POSITIVE_INFINITY;
  const needsLookup = body?.refresh === true || !integration.ml_nickname || age > NICKNAME_MAX_AGE_MS;
  if (!needsLookup) return json(base);

  const token = await getSellerAccessToken(admin, targetId);
  if (!token.ok) {
    return json({
      ...base,
      warning: base.nickname
        ? null
        : "Não conseguimos confirmar o apelido agora: a autorização do Mercado Livre venceu. Reconecte a conta para atualizar.",
    });
  }

  try {
    const res = await fetch("https://api.mercadolibre.com/users/me", {
      headers: { Authorization: `Bearer ${token.accessToken}` },
    });
    const me = await res.json().catch(() => ({}));
    if (!res.ok || !me?.nickname) {
      console.warn("[ml-account-info] users/me falhou", res.status);
      return json({
        ...base,
        warning: base.nickname ? null : "Não conseguimos buscar o apelido no Mercado Livre agora.",
      });
    }

    const now = new Date().toISOString();
    const update: Record<string, unknown> = { ml_nickname: String(me.nickname), ml_nickname_updated_at: now };
    if (me.id && !integration.ml_user_id) update.ml_user_id = me.id;
    await admin.from("user_integrations").update(update).eq("user_id", targetId).eq("platform", "mercadolivre");

    return json({
      ...base,
      ml_user_id: base.ml_user_id ?? (me.id ? String(me.id) : null),
      nickname: String(me.nickname),
    });
  } catch (error) {
    console.warn("[ml-account-info] erro ao consultar o ML", error);
    return json({
      ...base,
      warning: base.nickname ? null : "Não conseguimos buscar o apelido no Mercado Livre agora.",
    });
  }
});
