import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Não autorizado" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appKey = Deno.env.get("ALIEXPRESS_APP_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !appKey) {
    return json({ error: "Configuração do servidor incompleta" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return json({ error: "Token inválido" }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const state = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: stateError } = await adminClient
    .from("aliexpress_oauth_states")
    .insert({ state, user_id: userData.user.id, expires_at: expiresAt });

  if (stateError) {
    console.error("[aliexpress-connect] state insert error:", stateError.message);
    return json({ error: "Não foi possível iniciar a conexão" }, 500);
  }

  const redirectUri = `${supabaseUrl}/functions/v1/aliexpress-callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: appKey,
    redirect_uri: redirectUri,
    state,
  });

  const authUrl = `https://api-sg.aliexpress.com/oauth/authorize?${params}`;
  return json({ authUrl, auth_url: authUrl, url: authUrl });
});
