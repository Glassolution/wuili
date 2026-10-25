// Obtém (e renova quando necessário) o access_token do Mercado Livre de um seller.
// Usado pelos jobs em segundo plano (correção em massa de anúncios).
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { mlFetch } from "./mlClient.ts";

export type SellerTokenResult =
  | { ok: true; accessToken: string; mlUserId: number | null }
  | { ok: false; error: string };

/**
 * Erro de refresh que NUNCA se resolve sozinho: o refresh_token foi emitido
 * por outro app do Mercado Livre (client_id antigo) ou já foi usado/expirou.
 * Insistir só gera chamadas inúteis (e cara de abuso) a cada rodada de cron.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- corpo de erro do ML, formato livre
export function isDeadRefreshError(status: number, body: any): boolean {
  if (status !== 400) return false;
  const txt = JSON.stringify(body ?? {});
  return txt.includes("invalid_grant") || txt.includes("client_id does not match");
}

/**
 * Marca a integração como "token morto" (refresh_failed_at) para os jobs
 * pararem de tentar renovar, e avisa o usuário uma vez por semana para
 * reconectar a conta. A reconexão (ml-callback) limpa a marca.
 */
export async function markRefreshTokenDead(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("user_integrations")
    .update({ refresh_failed_at: now, updated_at: now })
    .eq("user_id", userId)
    .eq("platform", "mercadolivre");

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "ml_reconnect_required")
    .gt("created_at", since)
    .limit(1);
  if (existing?.length) return;

  await supabase.from("notifications").insert({
    user_id: userId,
    type: "ml_reconnect_required",
    title: "Reconecte sua conta do Mercado Livre",
    message:
      "A autorização da sua conta do Mercado Livre expirou e não conseguimos renová-la automaticamente. " +
      "Toque em reconectar para voltar a publicar e sincronizar seus anúncios.",
    action_url: "/dashboard/integracoes",
    metadata: { reason: reason.slice(0, 200) },
  });
}

export async function getSellerAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<SellerTokenResult> {
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at, ml_user_id")
    .eq("user_id", userId)
    .eq("platform", "mercadolivre")
    .maybeSingle();

  if (!integration?.access_token) {
    return { ok: false, error: "seller sem integração ativa com o Mercado Livre" };
  }

  const expiresAt = integration.expires_at ? new Date(integration.expires_at) : new Date(0);
  if (expiresAt > new Date(Date.now() + 60_000)) {
    return { ok: true, accessToken: integration.access_token, mlUserId: integration.ml_user_id ?? null };
  }

  const res = await mlFetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: Deno.env.get("ML_CLIENT_ID")!,
      client_secret: Deno.env.get("ML_CLIENT_SECRET")!,
      refresh_token: integration.refresh_token ?? "",
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    return { ok: false, error: `falha ao renovar token do seller (${res.status})` };
  }

  await supabase
    .from("user_integrations")
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + Number(data.expires_in ?? 21600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("platform", "mercadolivre");

  return { ok: true, accessToken: data.access_token, mlUserId: integration.ml_user_id ?? null };
}
