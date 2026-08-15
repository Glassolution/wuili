import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  TIKTOK_AUTH_BASE,
  callTikTokShop,
  getTikTokCredentials,
} from "../_shared/tiktokShop.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code") ?? url.searchParams.get("auth_code");
  const state = url.searchParams.get("state");

  const defaultAppUrl = (
    Deno.env.get("VITE_PUBLIC_APP_URL") ||
    Deno.env.get("PUBLIC_APP_URL") ||
    "https://velods.com.br"
  ).replace(/\/+$/, "");

  let appUrl = defaultAppUrl;
  const redirect = (qs: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${appUrl}/dashboard/integracoes?${qs}` },
    });

  console.log("[tiktok-shop-oauth-callback] params:", Object.fromEntries(url.searchParams));

  if (!code || !state) return redirect("tiktok_error=missing_params");

  let appKey: string;
  let appSecret: string;
  try {
    ({ appKey, appSecret } = getTikTokCredentials());
  } catch {
    return redirect("tiktok_error=missing_config");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: oauthState } = await supabase
    .from("tiktok_shop_oauth_states")
    .select("state,user_id,expires_at,consumed_at,redirect_to")
    .eq("state", state)
    .maybeSingle();

  if (
    !oauthState ||
    oauthState.consumed_at ||
    new Date(oauthState.expires_at).getTime() <= Date.now()
  ) {
    console.error("[tiktok-shop-oauth-callback] state invalido:", state);
    return redirect("tiktok_error=invalid_state");
  }

  if (oauthState.redirect_to && /^https?:\/\//.test(oauthState.redirect_to)) {
    appUrl = oauthState.redirect_to.replace(/\/+$/, "");
  }

  await supabase
    .from("tiktok_shop_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("state", state);

  // 1) Troca o auth_code por tokens
  const tokenUrl = `${TIKTOK_AUTH_BASE}/api/v2/token/get?${new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    auth_code: code,
    grant_type: "authorized_code",
  })}`;

  // deno-lint-ignore no-explicit-any -- resposta dinamica da TikTok Open API
  let tokenJson: any = {};
  try {
    const res = await fetch(tokenUrl, { headers: { "content-type": "application/json" } });
    tokenJson = await res.json();
  } catch (e) {
    console.error("[tiktok-shop-oauth-callback] token fetch falhou:", (e as Error).message);
    return redirect("tiktok_error=token_failed");
  }

  const tokenData = tokenJson?.data ?? {};
  console.log("[tiktok-shop-oauth-callback] token response code:", tokenJson?.code, tokenJson?.message);

  if (tokenJson?.code !== 0 || !tokenData.access_token) {
    console.error("[tiktok-shop-oauth-callback] token error:", JSON.stringify(tokenJson));
    return redirect("tiktok_error=token_failed");
  }

  // 2) Busca a loja autorizada (shop_id + shop_cipher + regiao/moeda)
  let shopId: string | null = null;
  let shopCipher: string | null = null;
  let shopName: string | null = null;
  let region: string | null = null;
  let currency: string | null = null;
  try {
    const shops = await callTikTokShop({
      path: "/authorization/202309/shops",
      accessToken: tokenData.access_token,
    });
    // deno-lint-ignore no-explicit-any -- resposta dinamica da TikTok Open API
    const list = (shops.json as any)?.data?.shops ?? [];
    if (list.length > 0) {
      shopId = list[0].id ?? null;
      shopCipher = list[0].cipher ?? null;
      shopName = list[0].name ?? null;
      region = list[0].region ?? null;
      // A moeda e definida pela regiao da loja, nao pelo Velo.
      currency = list[0].seller_type === "CROSS_BORDER" ? "USD" : (list[0].currency ?? null);
    }
    console.log("[tiktok-shop-oauth-callback] shop_id:", shopId, "region:", region, "shops:", list.length);
  } catch (e) {
    console.warn("[tiktok-shop-oauth-callback] falha ao buscar lojas:", (e as Error).message);
  }

  const expiresIn = Number(tokenData.access_token_expire_in ?? 0);
  const { error } = await supabase.from("tiktok_shop_accounts").upsert(
    {
      user_id: oauthState.user_id,
      shop_id: shopId,
      shop_cipher: shopCipher,
      shop_name: shopName,
      region,
      currency,
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token ?? null,
      token_expires_at: expiresIn
        ? new Date(expiresIn * 1000).toISOString()
        : null,
      connected_at: new Date().toISOString(),
      status: "connected",
    },
    { onConflict: "user_id" },
  );

  if (error) {
    console.error("[tiktok-shop-oauth-callback] db error:", error.message);
    return redirect("tiktok_error=db_failed");
  }

  return redirect("tiktok_connected=true");
});
