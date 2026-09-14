import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cron: renova tokens que expiram nos próximos 15 dias.
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("MP_MARKETPLACE_CLIENT_ID");
    const clientSecret = Deno.env.get("MP_MARKETPLACE_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "Credenciais MP não configuradas" }, 500);

    const admin = createClient(supabaseUrl, serviceKey);
    const threshold = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString();

    const { data: accounts, error } = await admin
      .from("seller_mp_accounts")
      .select("seller_id, refresh_token, token_expires_at")
      .lte("token_expires_at", threshold);

    if (error) return json({ error: error.message }, 500);
    console.log(`[refresh-mp-tokens] ${accounts?.length ?? 0} contas para renovar`);

    const results: Array<{ seller_id: string; ok: boolean; error?: string }> = [];

    for (const acc of accounts ?? []) {
      if (!acc.refresh_token) {
        results.push({ seller_id: acc.seller_id, ok: false, error: "sem refresh_token" });
        continue;
      }
      try {
        const res = await fetch("https://api.mercadopago.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: acc.refresh_token,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.access_token) {
          console.error("[refresh-mp-tokens] falhou seller", acc.seller_id, data);
          results.push({ seller_id: acc.seller_id, ok: false, error: JSON.stringify(data) });
          continue;
        }
        const expiresAt = new Date(Date.now() + Number(data.expires_in ?? 15552000) * 1000).toISOString();
        await admin.from("seller_mp_accounts").update({
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? acc.refresh_token,
          token_expires_at: expiresAt,
        }).eq("seller_id", acc.seller_id);
        results.push({ seller_id: acc.seller_id, ok: true });
      } catch (err) {
        results.push({ seller_id: acc.seller_id, ok: false, error: (err as Error).message });
      }
    }

    return json({ processed: results.length, results });
  } catch (err) {
    console.error("[refresh-mp-tokens] erro:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
