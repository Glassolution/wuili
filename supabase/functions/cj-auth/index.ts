import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function getDbClient() {
  const url = Deno.env.get("DB_URL") ?? Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("DB_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}

function checkInternalSecret(req: Request): Response | null {
  const expected = Deno.env.get("INTERNAL_SECRET");
  if (!expected) {
    console.error("INTERNAL_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const got = req.headers.get("x-internal-secret");
  if (got !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const denied = checkInternalSecret(req);
  if (denied) return denied;

  try {
    const supabase = getDbClient();

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
