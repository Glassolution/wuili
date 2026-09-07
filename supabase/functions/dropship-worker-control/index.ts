import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Supabase = ReturnType<typeof createClient>;

async function isAdmin(admin: Supabase, userId: string) {
  const { data } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo nao permitido" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Nao autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;

    if (!supabaseUrl || !anonKey || !serviceKey || !dbUrl) {
      return json({ error: "Configuracao do servidor incompleta" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(dbUrl, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: userError } = await userClient.auth.getUser();

    if (userError || !userData.user) return json({ error: "Token invalido" }, 401);
    if (!(await isAdmin(admin, userData.user.id))) return json({ error: "Acesso restrito a admins" }, 403);

    const body = await req.json().catch(() => null) as { action?: unknown } | null;
    const action = String(body?.action ?? "");
    if (action !== "start" && action !== "stop") return json({ error: "Acao invalida" }, 400);

    const { data, error } = await admin
      .from("dropship_worker_commands")
      .insert({
        action,
        status: "pending",
        requested_by: userData.user.id,
        message: action === "start"
          ? "Pedido para ligar o worker registrado."
          : "Pedido para desligar o worker registrado.",
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    return json({
      ok: true,
      command: data,
      warning: "Comando registrado. O worker local precisa estar rodando para consumir comandos.",
    });
  } catch (err) {
    console.error("dropship-worker-control erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
