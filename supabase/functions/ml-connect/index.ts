import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    return new Response(JSON.stringify({ error: "user_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientId = Deno.env.get("ML_CLIENT_ID")!;
  const redirectUri = Deno.env.get("ML_REDIRECT_URI")!;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state: userId,
  });

  const authUrl = `https://auth.mercadolivre.com.br/authorization?${params}`;

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: authUrl },
  });
});
