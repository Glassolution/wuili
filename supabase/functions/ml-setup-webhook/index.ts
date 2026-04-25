import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, access_token } = body as { user_id?: string; access_token?: string };

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = access_token || Deno.env.get("ML_APP_TOKEN");
    if (!token) {
      return new Response(JSON.stringify({ error: "no access_token available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appId = Deno.env.get("ML_CLIENT_ID");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const callbackUrl = `${supabaseUrl}/functions/v1/ml-webhook`;

    // Register webhook topics on Mercado Livre
    const topics = ["orders_v2", "items", "questions", "messages"];
    const results: Record<string, unknown> = {};

    for (const topic of topics) {
      try {
        const res = await fetch(`https://api.mercadolibre.com/applications/${appId}/notifications`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ topic, callback_url: callbackUrl }),
        });
        results[topic] = { status: res.status, body: await res.json().catch(() => null) };
      } catch (e) {
        results[topic] = { error: String(e) };
      }
    }

    console.log("ml-setup-webhook results:", JSON.stringify({ user_id, results }));

    return new Response(JSON.stringify({ success: true, user_id, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ml-setup-webhook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
