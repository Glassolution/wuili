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
    const body = await req.json().catch(() => ({}));
    const { code, error: clientReportedError, error_description: clientReportedErrorDesc } = body ?? {};

    if (clientReportedError || clientReportedErrorDesc) {
      console.error("[connect-mp-seller] callback com erro reportado pelo cliente:", JSON.stringify({
        seller_id: sellerId,
        error: clientReportedError,
        error_description: clientReportedErrorDesc,
      }));
    }

    if (!code) {
      console.error("[connect-mp-seller] code ausente para seller", sellerId);
      return json({ error: "code é obrigatório" }, 400);
    }

    const maskedCode = typeof code === "string" && code.length > 10
      ? `${code.slice(0, 6)}...${code.slice(-4)} (len=${code.length})`
      : `(len=${String(code).length})`;

    const envRedirectUri = Deno.env.get("MP_MARKETPLACE_REDIRECT_URI");
    if (!envRedirectUri) {
      console.error("[connect-mp-seller] MP_MARKETPLACE_REDIRECT_URI não configurado");
      return json({ error: "MP_MARKETPLACE_REDIRECT_URI não configurado" }, 500);
    }
    const bodyRedirectUri: string | undefined = body?.redirect_uri;
    if (bodyRedirectUri && bodyRedirectUri !== envRedirectUri) {
      console.error("[connect-mp-seller] redirect_uri mismatch", JSON.stringify({
        seller_id: sellerId,
        fromBody: bodyRedirectUri,
        fromEnv: envRedirectUri,
      }));
      return json({ error: "redirect_uri não corresponde ao configurado no servidor" }, 400);
    }
    const redirect_uri = envRedirectUri;
    console.log("[connect-mp-seller] iniciando troca code->token:", JSON.stringify({
      timestamp: new Date().toISOString(),
      seller_id: sellerId,
      client_id: clientId,
      redirect_uri,
      code_masked: maskedCode,
    }));

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

    const rawBody = await tokenRes.text();
    let tokenData: any = {};
    try {
      tokenData = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseErr) {
      console.error("[connect-mp-seller] resposta MP não-JSON:", JSON.stringify({
        seller_id: sellerId,
        status: tokenRes.status,
        raw_body: rawBody,
      }));
    }

    if (!tokenRes.ok || !tokenData.access_token) {
      // Log completo do erro retornado pelo Mercado Pago
      console.error("[connect-mp-seller] erro do Mercado Pago ao trocar code:", JSON.stringify({
        seller_id: sellerId,
        status: tokenRes.status,
        status_text: tokenRes.statusText,
        mp_error: tokenData?.error ?? null,
        mp_message: tokenData?.message ?? null,
        mp_error_description: tokenData?.error_description ?? null,
        mp_cause: tokenData?.cause ?? null,
        full_body: tokenData,
        raw_body: rawBody,
      }));
      return json({ error: "Falha ao conectar com o Mercado Pago", details: tokenData }, 400);
    }

    console.log("[connect-mp-seller] token obtido com sucesso:", JSON.stringify({
      seller_id: sellerId,
      status: tokenRes.status,
      mp_user_id: tokenData.user_id,
      scope: tokenData.scope,
      expires_in: tokenData.expires_in,
      live_mode: tokenData.live_mode,
    }));

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
