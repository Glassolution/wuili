import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Hybrid deployment: DB may live on a different project than the functions
    const dbUrl = Deno.env.get("DB_URL") ?? supabaseUrl;
    const dbKey = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? serviceKey;
    const supabase = createClient(dbUrl, dbKey);

    // Check cache first
    const { data: cached } = await supabase
      .from("cj_token_cache")
      .select("*")
      .eq("id", 1)
      .single();

    if (cached && new Date(cached.expires_at) > new Date()) {
      return new Response(
        JSON.stringify({ accessToken: cached.access_token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authenticate with CJ API
    const apiKey = Deno.env.get("CJ_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "CJ_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const res = await fetch(
      "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      }
    );

    const json = await res.json();

    if (!json.result || json.code !== 200) {
      return new Response(
        JSON.stringify({ error: "CJ auth failed", details: json }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { accessToken, refreshToken } = json.data;
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert token cache
    await supabase.from("cj_token_cache").upsert({
      id: 1,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });

    return new Response(
      JSON.stringify({ accessToken }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
