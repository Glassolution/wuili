import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const timestamp = new Date().toISOString();
  const clientId = Deno.env.get("MP_MARKETPLACE_CLIENT_ID");
  const envRedirectUri = Deno.env.get("MP_MARKETPLACE_REDIRECT_URI");

  // Try to identify seller from auth header
  let sellerId: string | null = null;
  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      sellerId = data.user?.id ?? null;
    }
  } catch (e) {
    console.warn("[mp-seller-auth-url] falha ao identificar seller:", (e as Error).message);
  }

  console.log("[mp-seller-auth-url] payload:", JSON.stringify({
    timestamp,
    seller_id: sellerId,
    client_id: clientId,
    redirect_uri: envRedirectUri,
    has_client_id: !!clientId,
    has_redirect_uri: !!envRedirectUri,
  }));

  if (!clientId) {
    console.error("[mp-seller-auth-url] MP_MARKETPLACE_CLIENT_ID não configurado");
    return new Response(JSON.stringify({ error: "MP client_id não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!envRedirectUri) {
    console.error("[mp-seller-auth-url] MP_MARKETPLACE_REDIRECT_URI não configurado");
    return new Response(JSON.stringify({ error: "MP_MARKETPLACE_REDIRECT_URI não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const redirectUri = envRedirectUri;
  const authUrl =
    `https://auth.mercadopago.com.br/authorization?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log("[mp-seller-auth-url] auth_url gerada:", authUrl);
  console.log("[mp-seller-auth-url] seller_id solicitante:", sellerId);

  return new Response(JSON.stringify({ auth_url: authUrl, redirect_uri: redirectUri }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
