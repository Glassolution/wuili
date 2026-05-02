import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const appUrl = Deno.env.get("APP_URL") || "https://wuili.lovable.app";
  const dashboardUrl = `${appUrl}/dashboard/integracoes`;

  if (!code || !state) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${dashboardUrl}?ml_error=missing_params` },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
  const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceRoleKey;
  const supabase = createClient(dbUrl, dbKey);

  const { data: oauthState, error: stateError } = await supabase
    .from("ml_oauth_states")
    .select("state,user_id,expires_at,consumed_at")
    .eq("state", state)
    .maybeSingle();

  if (
    stateError ||
    !oauthState ||
    oauthState.consumed_at ||
    new Date(oauthState.expires_at).getTime() <= Date.now()
  ) {
    console.error("[ml-callback] invalid state:", stateError?.message ?? state);
    return new Response(null, {
      status: 302,
      headers: { Location: `${dashboardUrl}?ml_error=invalid_state` },
    });
  }

  const { error: consumeError } = await supabase
    .from("ml_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("state", state)
    .is("consumed_at", null);

  if (consumeError) {
    console.error("[ml-callback] state consume error:", consumeError.message);
    return new Response(null, {
      status: 302,
      headers: { Location: `${dashboardUrl}?ml_error=invalid_state` },
    });
  }

  let tokens: Record<string, any>;
  try {
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: Deno.env.get("ML_CLIENT_ID")!,
        client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
        code,
        redirect_uri: Deno.env.get("ML_REDIRECT_URI")!,
      }),
    });
    tokens = await tokenRes.json();
  } catch {
    return new Response(null, {
      status: 302,
      headers: { Location: `${dashboardUrl}?ml_error=token_failed` },
    });
  }

  if (!tokens.access_token) {
    console.error("ML token error:", JSON.stringify(tokens));
    return new Response(null, {
      status: 302,
      headers: { Location: `${dashboardUrl}?ml_error=token_failed` },
    });
  }

  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: oauthState.user_id,
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
    return new Response(null, {
      status: 302,
      headers: { Location: `${dashboardUrl}?ml_error=db_failed` },
    });
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `${dashboardUrl}?ml_connected=true` },
  });
});
