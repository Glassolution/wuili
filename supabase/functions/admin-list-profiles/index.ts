// Retorna nome/email/avatar de vários usuários para telas administrativas.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const cleanText = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
};

const isGenericName = (value: string | null | undefined) => {
  const normalized = (value ?? "").trim().toLowerCase();
  return !normalized || normalized === "usuario" || normalized === "usuário";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const callerId = claims?.claims?.sub as string | undefined;
    if (!callerId) return json({ error: "Token inválido" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
    if (!roleRow) return json({ error: "Acesso restrito a administradores" }, 403);

    const body = await req.json().catch(() => ({})) as { user_ids?: unknown };
    const ids = Array.isArray(body.user_ids)
      ? body.user_ids.filter((v): v is string => typeof v === "string").slice(0, 2000)
      : [];
    if (!ids.length) return json({ profiles: {} });

    const map: Record<string, { display_name: string | null; email: string | null; avatar_url: string | null }> = {};
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data, error } = await admin
        .from("profiles")
        .select("user_id, display_name, email, avatar_url")
        .in("user_id", ids.slice(i, i + CHUNK));
      if (error) {
        console.error("admin-list-profiles", error.message);
        continue;
      }
      for (const p of data ?? []) {
        map[p.user_id] = {
          display_name: p.display_name ?? null,
          email: p.email ?? null,
          avatar_url: p.avatar_url ?? null,
        };
      }
    }

    // Completa nome/e-mail ausentes direto do cadastro de autenticação.
    const faltando = ids.filter((id) => !map[id]?.email || isGenericName(map[id]?.display_name));
    for (const id of faltando.slice(0, 300)) {
      const { data } = await admin.auth.admin.getUserById(id);
      const authEmail = cleanText(data?.user?.email);
      const metadata = data?.user?.user_metadata ?? {};
      const authName =
        cleanText(metadata.full_name) ??
        cleanText(metadata.name) ??
        (authEmail ? cleanText(authEmail.split("@")[0]) : null);
      if (authEmail || authName) {
        map[id] = {
          display_name: isGenericName(map[id]?.display_name) ? authName : map[id]?.display_name ?? authName,
          avatar_url: map[id]?.avatar_url ?? null,
          email: map[id]?.email ?? authEmail,
        };
      }
    }

    return json({ profiles: map });
  } catch (err) {
    console.error("admin-list-profiles erro", err);
    return json({ error: "Erro interno" }, 500);
  }
});
