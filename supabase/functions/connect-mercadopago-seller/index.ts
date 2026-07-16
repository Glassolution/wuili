import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autenticado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("MP_MARKETPLACE_CLIENT_ID");
    const clientSecret = Deno.env.get("MP_MARKETPLACE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return json({ error: "Credenciais do Mercado Pago não configuradas" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);

    const sellerId = userData.user.id;
    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) return json({ error: "code e redirect_uri são obrigatórios" }, 400);

    console.log("[connect-mp-seller] trocando code por token para seller", sellerId);

    const tokenRes = await fetch("https://api.mercadopago.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("[connect-mp-seller] resposta MP:", { status: tokenRes.status, hasToken: !!tokenData.access_token });

    if (!tokenRes.ok || !tokenData.access_token) {
      return json({ error: "Falha ao conectar com o Mercado Pago", details: tokenData }, 400);
    }

    const expiresIn = Number(tokenData.expires_in ?? 15552000);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: upsertErr } = await admin
      .from("seller_mp_accounts")
      .upsert(
        {
          seller_id: sellerId,
          mp_user_id: String(tokenData.user_id ?? ""),
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? null,
          public_key: tokenData.public_key ?? null,
          token_expires_at: expiresAt,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "seller_id" }
      );

    if (upsertErr) {
      console.error("[connect-mp-seller] erro ao salvar:", upsertErr);
      return json({ error: "Erro ao salvar conexão", details: upsertErr.message }, 500);
    }

    return json({ success: true, mp_user_id: tokenData.user_id, expires_at: expiresAt });
  } catch (err) {
    console.error("[connect-mp-seller] erro:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
