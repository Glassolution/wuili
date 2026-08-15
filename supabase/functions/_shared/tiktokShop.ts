// Helpers compartilhados para a TikTok Shop Open API.

export const TIKTOK_AUTH_BASE = "https://auth.tiktok-shops.com";
export const TIKTOK_API_BASE = "https://open-api.tiktokglobalshop.com";

export const getTikTokCredentials = () => {
  const appKey = Deno.env.get("TIKTOK_SHOP_APP_KEY");
  const appSecret = Deno.env.get("TIKTOK_SHOP_APP_SECRET");
  if (!appKey || !appSecret) {
    throw new Error("TIKTOK_SHOP_APP_KEY/TIKTOK_SHOP_APP_SECRET nao configurados");
  }
  // O Service ID do Partner Center e diferente do app_key. Caimos no app_key
  // apenas como fallback para nao quebrar ambientes antigos.
  const serviceId = Deno.env.get("TIKTOK_SHOP_SERVICE_ID") || appKey;
  return { appKey, appSecret, serviceId };
};

const hmacSha256Hex = async (secret: string, message: string) => {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Assinatura oficial da TikTok Shop:
 * app_secret + path + (chaves ordenadas, exceto sign/access_token) + body + app_secret
 */
export const signTikTokRequest = async (
  path: string,
  params: Record<string, string>,
  body: string,
  appSecret: string,
) => {
  const keys = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort();
  let base = path;
  for (const k of keys) base += `${k}${params[k]}`;
  const input = `${appSecret}${base}${body}${appSecret}`;
  return await hmacSha256Hex(appSecret, input);
};

export type TikTokCallOptions = {
  path: string;
  method?: "GET" | "POST" | "PUT";
  accessToken: string;
  shopCipher?: string | null;
  query?: Record<string, string>;
  body?: unknown;
  /** Para multipart (upload de imagem) o body nao entra na assinatura. */
  formData?: FormData;
};

export const callTikTokShop = async ({
  path,
  method = "GET",
  accessToken,
  shopCipher,
  query = {},
  body,
  formData,
}: TikTokCallOptions) => {
  const { appKey, appSecret } = getTikTokCredentials();
  const bodyString = formData ? "" : body === undefined ? "" : JSON.stringify(body);

  const params: Record<string, string> = {
    app_key: appKey,
    timestamp: Math.floor(Date.now() / 1000).toString(),
    ...query,
  };
  if (shopCipher) params.shop_cipher = shopCipher;

  params.sign = await signTikTokRequest(path, params, bodyString, appSecret);

  const url = `${TIKTOK_API_BASE}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    method,
    headers: formData
      ? { "x-tts-access-token": accessToken }
      : { "content-type": "application/json", "x-tts-access-token": accessToken },
    body: formData ?? (body === undefined ? undefined : bodyString),
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }

  return { ok: res.ok && (json as { code?: number }).code === 0, status: res.status, json, text };
};

/** Troca o refresh_token por um novo access_token. */
export const refreshTikTokToken = async (refreshToken: string) => {
  const { appKey, appSecret } = getTikTokCredentials();
  const url = `${TIKTOK_AUTH_BASE}/api/v2/token/refresh?${new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  })}`;
  const res = await fetch(url, { headers: { "content-type": "application/json" } });
  const json = await res.json().catch(() => ({}));
  if (json?.code !== 0 || !json?.data?.access_token) {
    throw new Error(`refresh_failed:${json?.code ?? res.status}:${json?.message ?? ""}`);
  }
  return json.data as {
    access_token: string;
    refresh_token?: string;
    access_token_expire_in?: number;
  };
};

type AccountRow = {
  user_id: string;
  shop_id: string | null;
  shop_cipher: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  status: string;
  currency?: string | null;
};

/**
 * Retorna a conta com um access_token valido, renovando automaticamente
 * quando faltam menos de 10 minutos para expirar.
 */
// deno-lint-ignore no-explicit-any -- client Supabase tipado apenas em runtime
export const ensureFreshToken = async (admin: any, account: AccountRow): Promise<AccountRow> => {
  const expMs = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  // Sem data de expiracao conhecida tambem renovamos: e mais seguro do que
  // seguir com um access_token possivelmente vencido.
  const needsRefresh = expMs === 0 || expMs - Date.now() < 10 * 60 * 1000;
  if (!needsRefresh || !account.refresh_token) return account;

  try {
    const data = await refreshTikTokToken(account.refresh_token);
    const expiresAt = data.access_token_expire_in
      ? new Date(Number(data.access_token_expire_in) * 1000).toISOString()
      : null;
    await admin
      .from("tiktok_shop_accounts")
      .update({
        access_token: data.access_token,
        refresh_token: data.refresh_token ?? account.refresh_token,
        token_expires_at: expiresAt,
        status: "connected",
      })
      .eq("user_id", account.user_id);
    console.log("[tiktokShop] token renovado para", account.user_id);
    return { ...account, access_token: data.access_token, token_expires_at: expiresAt };
  } catch (e) {
    console.error("[tiktokShop] falha ao renovar token:", (e as Error).message);
    await admin
      .from("tiktok_shop_accounts")
      .update({ status: "expired" })
      .eq("user_id", account.user_id);
    throw new Error("Sua conexao com a TikTok Shop expirou. Conecte novamente.");
  }
};

/** Faz upload de uma imagem externa e devolve o uri aceito pela Product API. */
export const uploadProductImage = async (
  imageUrl: string,
  accessToken: string,
  shopCipher: string | null,
) => {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`download_failed:${res.status}`);
  const blob = await res.blob();
  if (blob.size > 5 * 1024 * 1024) throw new Error("image_too_large");

  const form = new FormData();
  form.append("data", blob, "image.jpg");
  form.append("use_case", "MAIN_IMAGE");

  const call = await callTikTokShop({
    path: "/product/202309/images/upload",
    method: "POST",
    accessToken,
    shopCipher,
    formData: form,
  });

  const uri = (call.json as { data?: { uri?: string } })?.data?.uri;
  if (!call.ok || !uri) {
    throw new Error(`upload_failed:${call.status}:${call.text.slice(0, 200)}`);
  }
  return uri;
};

/** Pede a categoria recomendada para o titulo/descricao do produto. */
export const recommendCategory = async (
  title: string,
  description: string,
  accessToken: string,
  shopCipher: string | null,
) => {
  const call = await callTikTokShop({
    path: "/product/202309/categories/recommend",
    method: "POST",
    accessToken,
    shopCipher,
    body: { product_title: title, description },
  });
  const id = (call.json as { data?: { leaf_category_id?: string } })?.data?.leaf_category_id;
  if (!call.ok || !id) {
    throw new Error(`category_failed:${call.status}:${call.text.slice(0, 200)}`);
  }
  return id;
};

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
