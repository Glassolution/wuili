import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function redirect(to: string) {
  return new Response(null, { status: 302, headers: { ...corsHeaders, Location: to } });
}

function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const appUrl = (Deno.env.get("APP_URL") ?? "https://www.velods.com.br").replace(/\/+$/, "");
  const errorRedirect = `${appUrl}/dashboard/configuracoes?shopify=erro`;
  const successRedirect = `${appUrl}/dashboard/configuracoes?shopify=conectado`;

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const shopRaw = url.searchParams.get("shop") ?? "";
    const state = url.searchParams.get("state");
    const shop = shopRaw.trim().toLowerCase();

    if (!code || !state || !shop || !isValidShopDomain(shop)) {
      console.error("[shopify-callback] parâmetros inválidos", { hasCode: !!code, hasState: !!state, shop });
      return redirect(errorRedirect);
    }

    const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
    const clientSecret = Deno.env.get("SHOPIFY_CLIENT_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!clientId || !clientSecret) {
      console.error("[shopify-callback] credenciais Shopify ausentes");
      return redirect(errorRedirect);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Look up state → user_id
    const { data: stateRow, error: stateErr } = await admin
      .from("shopify_oauth_states")
      .select("user_id, shop_domain")
      .eq("state", state)
      .maybeSingle();

    if (stateErr || !stateRow) {
      console.error("[shopify-callback] state inválido:", stateErr);
      return redirect(errorRedirect);
    }
    if (stateRow.shop_domain !== shop) {
      console.error("[shopify-callback] shop divergente do state");
      return redirect(errorRedirect);
    }

    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    console.log("[shopify-callback] resposta Shopify:", { status: tokenRes.status, hasToken: !!tokenData.access_token });

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("[shopify-callback] falha ao trocar code:", tokenData);
      return redirect(errorRedirect);
    }

    // Upsert connection
    const { error: upsertErr } = await admin
      .from("shopify_connections")
      .upsert(
        {
          user_id: stateRow.user_id,
          shop_domain: shop,
          access_token: tokenData.access_token,
          scope: tokenData.scope ?? null,
        },
        { onConflict: "shop_domain" }
      );

    if (upsertErr) {
      console.error("[shopify-callback] erro ao salvar conexão:", upsertErr);
      return redirect(errorRedirect);
    }

    // Cleanup state
    await admin.from("shopify_oauth_states").delete().eq("state", state);

    return redirect(successRedirect);
  } catch (err) {
    console.error("[shopify-callback] erro:", err);
    return redirect(errorRedirect);
  }
});
