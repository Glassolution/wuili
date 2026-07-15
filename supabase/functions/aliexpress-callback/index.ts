import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

/**
 * Assinatura HMAC-SHA256 padrão AliExpress Open Platform para endpoints /rest/*.
 * Formato: apiName + (k1+v1) + (k2+v2) + ... em ordem alfabética das chaves,
 * HMAC-SHA256 com app_secret como chave, resultado em HEX MAIÚSCULO.
 */
function signRest(apiName: string, params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort();
  const base = apiName + sorted.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", secret).update(base).digest("hex").toUpperCase();
}

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
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");

    console.log("[aliexpress-callback] incoming:", {
      hasCode: !!code,
      hasState: !!state,
    });

    if (!code) {
      console.error("[aliexpress-callback] missing code param");
      return Response.redirect(`${dashboardUrl}?ali_error=missing_params`, 302);
    }

    const appKey = Deno.env.get("ALIEXPRESS_APP_KEY")?.trim();
    const appSecret = Deno.env.get("ALIEXPRESS_APP_SECRET")?.trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!appKey || !appSecret || !supabaseUrl || !serviceRoleKey) {
      throw new Error("Configuração do servidor incompleta");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Resolve target user_id: prefer state (secure), fallback to first admin
    let targetUserId: string | null = null;

    if (state) {
      const { data: oauthState } = await admin
        .from("aliexpress_oauth_states")
        .select("state,user_id,expires_at,consumed_at")
        .eq("state", state)
        .maybeSingle();

      if (
        oauthState &&
        !oauthState.consumed_at &&
        new Date(oauthState.expires_at).getTime() > Date.now()
      ) {
        await admin
          .from("aliexpress_oauth_states")
          .update({ consumed_at: new Date().toISOString() })
          .eq("state", state)
          .is("consumed_at", null);
        targetUserId = oauthState.user_id as string;
      } else {
        console.warn("[aliexpress-callback] state inválido/expirado, aplicando fallback admin");
      }
    } else {
      console.warn("[aliexpress-callback] sem state, aplicando fallback admin");
    }

    if (!targetUserId) {
      const { data: firstAdmin } = await admin
        .from("profiles")
        .select("user_id")
        .eq("is_admin", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      targetUserId = firstAdmin?.user_id ?? null;
    }

    if (!targetUserId) {
      console.error("[aliexpress-callback] nenhum admin encontrado");
      return Response.redirect(`${dashboardUrl}?ali_error=no_admin`, 302);
    }

    const redirectUri = `${supabaseUrl}/functions/v1/aliexpress-callback`;

    console.log(
      `[aliexpress-callback] ALIEXPRESS_APP_KEY masked: ${appKey.slice(0, 2)}...${appKey.slice(-2)} (len=${appKey.length})`,
    );
    console.log(`[aliexpress-callback] redirect_uri: ${redirectUri}`);

    // AliExpress Open Platform token exchange (assinado HMAC-SHA256)
    const apiName = "/auth/token/create";
    const signParams: Record<string, string> = {
      app_key: appKey,
      code,
      sign_method: "sha256",
      timestamp: String(Date.now()),
    };
    const sign = signRest(apiName, signParams, appSecret);

    const tokenBody = new URLSearchParams({ ...signParams, sign });
    const tokenUrl = `https://api-sg.aliexpress.com/rest${apiName}`;

    console.log("[aliexpress-callback] signing base params keys:", Object.keys(signParams).sort().join(","));

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: tokenBody,
    });

    const tokenText = await tokenRes.text();
    console.log("[aliexpress-callback] token response status:", tokenRes.status);
    console.log("[aliexpress-callback] token response body:", tokenText);

    let tokenData: Record<string, any> = {};
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error("[aliexpress-callback] non-JSON token response");
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
      .eq("user_id", targetUserId);

    if (updateError) {
      console.error("[aliexpress-callback] profile update error:", updateError.message);
      return Response.redirect(`${dashboardUrl}?ali_error=db_failed`, 302);
    }

    console.log("[aliexpress-callback] success for user:", targetUserId);
    return Response.redirect(`${dashboardUrl}?ali_connected=true`, 302);
  } catch (err) {
    console.error("[aliexpress-callback] error:", err);
    return Response.redirect(`${dashboardUrl}?ali_error=unknown`, 302);
  }
});
