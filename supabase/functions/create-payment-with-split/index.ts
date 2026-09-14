import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MP_FEE_BRL = 1.0;
const RENEW_THRESHOLD_MS = 15 * 24 * 60 * 60 * 1000; // 15 dias

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("MP_MARKETPLACE_CLIENT_ID");
    const clientSecret = Deno.env.get("MP_MARKETPLACE_CLIENT_SECRET");
    if (!clientId || !clientSecret) return json({ error: "Credenciais MP não configuradas" }, 500);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Não autenticado" }, 401);

    const body = await req.json();
    const { product_id, seller_id, valor, buyer, payment_method_id, token, installments, description } = body;
    if (!seller_id || !valor) return json({ error: "seller_id e valor são obrigatórios" }, 400);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: account, error: accErr } = await admin
      .from("seller_mp_accounts")
      .select("*")
      .eq("seller_id", seller_id)
      .maybeSingle();

    if (accErr) return json({ error: "Erro ao buscar conta MP", details: accErr.message }, 500);
    if (!account) {
      return json({
        error: "SELLER_NOT_CONNECTED",
        message: "Este vendedor ainda não conectou a conta Mercado Pago.",
      }, 400);
    }

    let accessToken = account.access_token;
    const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
    const needsRenew = !expiresAt || expiresAt - Date.now() < RENEW_THRESHOLD_MS;

    if (needsRenew && account.refresh_token) {
      console.log("[create-payment-split] renovando token para seller", seller_id);
      const refreshRes = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: account.refresh_token,
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshRes.ok && refreshData.access_token) {
        accessToken = refreshData.access_token;
        const newExp = new Date(Date.now() + Number(refreshData.expires_in ?? 15552000) * 1000).toISOString();
        await admin.from("seller_mp_accounts").update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token ?? account.refresh_token,
          token_expires_at: newExp,
        }).eq("seller_id", seller_id);
      } else {
        console.error("[create-payment-split] falha ao renovar:", refreshData);
        if (!expiresAt || expiresAt < Date.now()) {
          return json({
            error: "TOKEN_EXPIRED",
            message: "Token do vendedor expirado. É necessário reconectar a conta Mercado Pago.",
          }, 401);
        }
      }
    }

    const idempotencyKey = crypto.randomUUID();
    const payload: Record<string, unknown> = {
      transaction_amount: Number(valor),
      description: description ?? `Pedido ${product_id ?? ""}`.trim(),
      payment_method_id,
      installments: installments ?? 1,
      application_fee: MP_FEE_BRL,
      external_reference: product_id ?? undefined,
      payer: buyer
        ? {
            email: buyer.email,
            first_name: buyer.first_name,
            last_name: buyer.last_name,
            identification: buyer.identification,
          }
        : undefined,
    };
    if (token) payload.token = token;

    console.log("[create-payment-split] criando pagamento", { seller_id, valor });

    const payRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });

    const payData = await payRes.json();
    console.log("[create-payment-split] resposta MP:", { status: payRes.status, id: payData?.id, statusPay: payData?.status });

    if (!payRes.ok) {
      return json({ error: "Falha ao criar pagamento", details: payData }, payRes.status);
    }

    return json({
      success: true,
      payment_id: payData.id,
      status: payData.status,
      status_detail: payData.status_detail,
      payment: payData,
    });
  } catch (err) {
    console.error("[create-payment-split] erro:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
