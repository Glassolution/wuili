import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://dropvelo.vercel.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { user_id, access_token: bodyToken } = body as {
      user_id?: string;
      access_token?: string;
    };

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve access token: prefer body, otherwise look up in user_integrations
    let token = bodyToken;
    if (!token) {
      const { data: integration, error: intErr } = await supabase
        .from("user_integrations")
        .select("access_token")
        .eq("user_id", user_id)
        .eq("platform", "mercadolivre")
        .maybeSingle();

      if (intErr) {
        console.error("ml-setup-webhook lookup error:", JSON.stringify(intErr));
        return new Response(
          JSON.stringify({ error: "lookup failed", details: intErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      token = integration?.access_token ?? undefined;
    }

    if (!token) {
      console.error("ml-setup-webhook: no access_token for user", user_id);
      return new Response(
        JSON.stringify({ error: "no access_token available", user_id }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const appId = Deno.env.get("ML_CLIENT_ID") ?? "5831446135077053";
    const callbackUrl = `${supabaseUrl}/functions/v1/ml-orders-webhook`;

    // Register webhook topics on Mercado Livre using the /subscriptions endpoint.
    // Authentication uses the USER's access_token (the user must have authorized the app).
    const topics = ["orders_v2", "items", "questions", "messages"];
    const results: Record<string, unknown> = {};

    for (const topic of topics) {
      try {
        const res = await fetch(
          `https://api.mercadolibre.com/applications/${appId}/subscriptions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ topic, callback_url: callbackUrl }),
          },
        );
        const body = await res.text();
        results[topic] = { status: res.status, body };
        if (!res.ok) {
          console.error(
            `ml-setup-webhook topic=${topic} failed status=${res.status} body=${body}`,
          );
        } else {
          console.log(
            `ml-setup-webhook topic=${topic} ok status=${res.status} body=${body}`,
          );
        }
      } catch (e) {
        results[topic] = { error: String(e) };
      }
    }

    console.log(
      "ml-setup-webhook results:",
      JSON.stringify({ user_id, results }),
    );

    return new Response(
      JSON.stringify({ success: true, user_id, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ml-setup-webhook error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
