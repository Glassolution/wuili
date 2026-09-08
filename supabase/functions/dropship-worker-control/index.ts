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
type WorkerAudience = "geral" | "admin";
type WorkerAction = "start" | "stop" | "set_audience";

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

    const body = await req.json().catch(() => null) as { action?: unknown; audience?: unknown } | null;
    const action = String(body?.action ?? "");
    if (action !== "start" && action !== "stop" && action !== "set_audience") return json({ error: "Acao invalida" }, 400);

    const typedAction = action as WorkerAction;
    const audience = String(body?.audience ?? "");
    if (typedAction === "set_audience" && audience !== "geral" && audience !== "admin") {
      return json({ error: "Publico invalido" }, 400);
    }

    const settingsPatch: Record<string, unknown> = {
      id: true,
      updated_by: userData.user.id,
      updated_at: new Date().toISOString(),
    };

    if (typedAction === "start") settingsPatch.enabled = true;
    if (typedAction === "stop") settingsPatch.enabled = false;
    if (typedAction === "set_audience") settingsPatch.audience = audience as WorkerAudience;

    const { data: settings, error: settingsError } = await admin
      .from("dropship_worker_settings")
      .upsert(settingsPatch, { onConflict: "id" })
      .select("enabled,audience,updated_at")
      .single();

    if (settingsError) return json({ error: settingsError.message }, 500);

    if (typedAction === "set_audience") {
      return json({
        ok: true,
        settings,
        warning: audience === "admin"
          ? "Bot visivel apenas para admins."
          : "Bot visivel para todos quando estiver ligado.",
      });
    }

    const { data, error } = await admin
      .from("dropship_worker_commands")
      .insert({
        action: typedAction,
        status: "pending",
        requested_by: userData.user.id,
        message: typedAction === "start"
          ? "Pedido para ligar o worker registrado."
          : "Pedido para desligar o worker registrado.",
      })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    return json({
      ok: true,
      command: data,
      settings,
      warning: typedAction === "start"
        ? "Bot ligado. O fluxo automatico volta a aparecer conforme o publico escolhido."
        : "Bot desligado. A compra no fornecedor voltou para o fluxo manual.",
    });
  } catch (err) {
    console.error("dropship-worker-control erro:", err);
    return json({ error: "Erro interno" }, 500);
  }
});
