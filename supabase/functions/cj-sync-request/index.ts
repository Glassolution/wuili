import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Nao autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalSecret = Deno.env.get("INTERNAL_SECRET");

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !internalSecret) {
      return jsonResponse({ error: "Variaveis internas nao configuradas" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return jsonResponse({ error: "Token invalido" }, 401);
    }

    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/cj-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        "x-internal-secret": internalSecret,
      },
    });

    const text = await syncResponse.text();
    let payload: Record<string, unknown>;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { error: text || "Resposta invalida do sincronizador" };
    }

    return jsonResponse(payload, syncResponse.status);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[cj-sync-request] error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
