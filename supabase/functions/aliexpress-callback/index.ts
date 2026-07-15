import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const appUrl = (
    Deno.env.get("APP_URL") ||
    Deno.env.get("VITE_PUBLIC_APP_URL") ||
    "https://velods.com.br"
  ).replace(/\/+$/, "");
  const dashboardUrl = `${appUrl}/admin/aliexpress`;

  try {
    // AliExpress redirects with GET ?code=...&state=...
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    if (!code || !state) {
      return Response.redirect(`${dashboardUrl}?ali_error=missing_params`, 302);
    }

    const appKey = Deno.env.get("ALIEXPRESS_APP_KEY");
    const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!appKey || !appSecret || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Configuração do servidor incompleta");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Validate & consume state
    const { data: oauthState, error: stateError } = await admin
      .from("aliexpress_oauth_states")
      .select("state,user_id,expires_at,consumed_at")
      .eq("state", state)
      .maybeSingle();

    if (
      stateError ||
      !oauthState ||
      oauthState.consumed_at ||
      new Date(oauthState.expires_at).getTime() <= Date.now()
    ) {
      console.error("[aliexpress-callback] invalid state:", stateError?.message ?? state);
      return Response.redirect(`${dashboardUrl}?ali_error=invalid_state`, 302);
    }

    const { error: consumeError } = await admin
      .from("aliexpress_oauth_states")
      .update({ consumed_at: new Date().toISOString() })
      .eq("state", state)
      .is("consumed_at", null);

    if (consumeError) {
      console.error("[aliexpress-callback] consume error:", consumeError.message);
      return Response.redirect(`${dashboardUrl}?ali_error=invalid_state`, 302);
    }

    const redirectUri = `${supabaseUrl}/functions/v1/aliexpress-callback`;

    // Exchange authorization code for access token
    const tokenRes = await fetch("https://api-sg.aliexpress.com/rest/auth/token/create", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: appKey,
        client_secret: appSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const tokenText = await tokenRes.text();
    let tokenData: Record<string, any> = {};
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error("[aliexpress-callback] non-JSON token response:", tokenText);
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token ?? null;
    const expiresIn = Number(tokenData.expires_in ?? 86400);

    if (!tokenRes.ok || !accessToken) {
      console.error("[aliexpress-callback] token error:", tokenRes.status, tokenText);
      return Response.redirect(`${dashboardUrl}?ali_error=token_failed`, 302);
    }

    const { error: updateError } = await admin
      .from("profiles")
      .update({
        aliexpress_access_token: accessToken,
        aliexpress_refresh_token: refreshToken,
        aliexpress_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      })
      .eq("user_id", oauthState.user_id);

    if (updateError) {
      console.error("[aliexpress-callback] profile update error:", updateError.message);
      return Response.redirect(`${dashboardUrl}?ali_error=db_failed`, 302);
    }

    return Response.redirect(`${dashboardUrl}?ali_connected=true`, 302);
  } catch (err) {
    console.error("[aliexpress-callback] error:", err);
    return Response.redirect(`${dashboardUrl}?ali_error=unknown`, 302);
  }
});
