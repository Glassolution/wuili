import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  try {
    const internalSecret = Deno.env.get("INTERNAL_SECRET");
    const requestSecret = req.headers.get("x-internal-secret");
    if (!internalSecret || requestSecret !== internalSecret) {
      return new Response(
        JSON.stringify({ error: "Acesso negado" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const ML_APP_ID = Deno.env.get("ML_APP_ID") || Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_ID = Deno.env.get("ML_CLIENT_ID");
    const ML_CLIENT_SECRET = Deno.env.get("ML_CLIENT_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: "ML_CLIENT_ID e ML_CLIENT_SECRET são obrigatórios" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Obter app token via Client Credentials
    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return new Response(
        JSON.stringify({ error: "Falha ao obter token ML", details: tokenData }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const appToken = tokenData.access_token;
    const appId = ML_APP_ID || ML_CLIENT_ID;
    const webhookUrl = `${SUPABASE_URL}/functions/v1/ml-orders-webhook`;

    // Registrar webhook de pedidos
    const webhookRes = await fetch(
      `https://api.mercadolibre.com/applications/${appId}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: "orders_v2",
          callback_url: webhookUrl,
        }),
      }
    );

    const webhookData = await webhookRes.json();

    return new Response(
      JSON.stringify({
        success: true,
        webhook: webhookData,
        webhook_url: webhookUrl,
        app_id: appId,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
