import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const clientId = Deno.env.get("MP_MARKETPLACE_CLIENT_ID");
  if (!clientId) {
    return new Response(JSON.stringify({ error: "MP client_id não configurado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const url = new URL(req.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const authUrl =
    `https://auth.mercadopago.com.br/authorization?client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code&platform_id=mp&redirect_uri=${encodeURIComponent(redirectUri)}`;
  return new Response(JSON.stringify({ auth_url: authUrl }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
