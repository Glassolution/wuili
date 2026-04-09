import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const userId = url.searchParams.get("state");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const dashboardUrl = `${supabaseUrl.replace(".supabase.co", "").replace("https://", "https://id-preview--")}.lovableproject.com/dashboard/settings`;

  if (!code || !userId) {
    return new Response(null, {
      status: 302,
      headers: { Location: `${dashboardUrl}?ml_error=missing_params` },
    });
  }

  // Exchange code for tokens
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

  // Save to Supabase
  const supabase = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { error } = await supabase.from("user_integrations").upsert(
    {
      user_id: userId,
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
