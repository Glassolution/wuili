import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SCOPES = "read_products,read_inventory,read_orders";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidShopDomain(shop: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(shop);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("SHOPIFY_CLIENT_ID");
    const redirectUri = Deno.env.get("SHOPIFY_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      return json({ error: "Shopify não configurado (client_id/redirect_uri ausentes)" }, 500);
    }

    // Get authenticated user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const url = new URL(req.url);
    let shop = url.searchParams.get("shop") ?? "";
    if (!shop && req.method === "POST") {
      try {
        const body = await req.json();
        shop = body.shop ?? "";
      } catch { /* ignore */ }
    }
    shop = shop.trim().toLowerCase();

    if (!shop || !isValidShopDomain(shop)) {
      return json({ error: "Domínio inválido. Use o formato nomedaloja.myshopify.com" }, 400);
    }

    // Generate random state
    const stateBytes = new Uint8Array(24);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes).map((b) => b.toString(16).padStart(2, "0")).join("");

    // Persist state → user_id + shop
    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertErr } = await admin
      .from("shopify_oauth_states")
      .insert({ state, user_id: userId, shop_domain: shop });
    if (insertErr) {
      console.error("[shopify-authorize] erro ao salvar state:", insertErr);
      return json({ error: "Erro ao iniciar autorização" }, 500);
    }

    const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    console.log(`[shopify-authorize] user=${userId} shop=${shop} state=${state.slice(0, 8)}...`);

    return json({ auth_url: authUrl.toString(), state });
  } catch (err) {
    console.error("[shopify-authorize] erro:", err);
    return json({ error: (err as Error).message }, 500);
  }
});
