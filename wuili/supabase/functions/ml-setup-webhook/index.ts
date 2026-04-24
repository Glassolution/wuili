/**
 * ml-setup-webhook
 * ----------------
 * One-time setup: registers the ml-orders-webhook URL with the Mercado Livre
 * Notifications API so ML pushes order events to our function.
 *
 * Call once after deploying ml-orders-webhook:
 *   curl -X POST https://<project>.supabase.co/functions/v1/ml-setup-webhook \
 *        -H "Authorization: Bearer <service_role_key>"
 *
 * Required env vars:
 *   ML_APP_ID     — numeric ML application ID (same as ML_CLIENT_ID)
 *   ML_APP_TOKEN  — app-level access token (not user token)
 *   SUPABASE_URL  — used to build the callback URL
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const mlAppId    = Deno.env.get("ML_APP_ID") ?? Deno.env.get("ML_CLIENT_ID");
  const mlAppToken = Deno.env.get("ML_APP_TOKEN");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!mlAppId || !mlAppToken) {
    return new Response(
      JSON.stringify({ error: "ML_APP_ID e ML_APP_TOKEN são obrigatórios" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const callbackUrl = `${supabaseUrl}/functions/v1/ml-orders-webhook`;

  try {
    // 1. Check existing subscriptions
    const listRes = await fetch(
      `https://api.mercadolibre.com/applications/${mlAppId}/subscriptions`,
      { headers: { Authorization: `Bearer ${mlAppToken}` } }
    );
    const existing = await listRes.json().catch(() => []);
    const already  = Array.isArray(existing)
      ? existing.find((s: { topic: string; callback_url: string }) =>
          s.topic === "orders_v2" && s.callback_url === callbackUrl
        )
      : null;

    if (already) {
      return new Response(
        JSON.stringify({ already_registered: true, subscription: already }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Register orders_v2 webhook
    const regRes = await fetch(
      `https://api.mercadolibre.com/applications/${mlAppId}/subscriptions`,
      {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${mlAppToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic:        "orders_v2",
          callback_url: callbackUrl,
        }),
      }
    );

    const regData = await regRes.json();
    console.log("[ml-setup-webhook] ML response:", JSON.stringify(regData));

    if (!regRes.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao registrar webhook", details: regData }),
        { status: regRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, subscription: regData, callback_url: callbackUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[ml-setup-webhook] error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
