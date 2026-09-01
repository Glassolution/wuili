/**
 * mlShippingLabel
 * ---------------
 * Busca a etiqueta de envio (PDF) de um pedido no Mercado Livre, guarda o
 * arquivo no bucket privado `shipping-labels` e devolve uma URL assinada de
 * longa duração para o worker baixar.
 *
 * Quando o ML ainda não gerou a etiqueta (pedido não pago / não pronto para
 * envio / flex), devolvemos `url: null` e o pedido fica com
 * `needs_shipping_label = true` até uma próxima tentativa.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { mlFetch } from "./mlClient.ts";

const BUCKET = "shipping-labels";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 ano

// deno-lint-ignore no-explicit-any -- estrutura crua do pedido varia por versão da API do ML
type MlOrder = any;

/** Token válido do seller no ML (renova se estiver expirado). */
export async function getMlAccessToken(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: integration } = await supabase
    .from("user_integrations")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .eq("platform", "mercadolivre")
    .maybeSingle();

  if (!integration?.access_token) return null;

  const expiresAt = integration.expires_at ? new Date(integration.expires_at as string) : null;
  if (expiresAt && expiresAt > new Date()) return integration.access_token as string;
  if (!integration.refresh_token) return integration.access_token as string;

  try {
    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: Deno.env.get("ML_CLIENT_ID") ?? "",
        client_secret: Deno.env.get("ML_CLIENT_SECRET") ?? "",
        refresh_token: integration.refresh_token as string,
      }),
    });
    const json = await res.json();
    if (!res.ok || !json?.access_token) return null;

    await supabase
      .from("user_integrations")
      .update({
        access_token: json.access_token,
        refresh_token: json.refresh_token ?? integration.refresh_token,
        expires_at: new Date(Date.now() + (json.expires_in ?? 21600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("platform", "mercadolivre");

    return json.access_token as string;
  } catch (e) {
    console.warn("[etiqueta] falha ao renovar token ML:", (e as Error).message);
    return null;
  }
}

export function extractShipmentId(mlOrder: MlOrder): string | null {
  const id = mlOrder?.shipping?.id ?? mlOrder?.shipment?.id ?? null;
  return id ? String(id) : null;
}

/**
 * Baixa a etiqueta do ML e sobe no storage.
 * Retorna `{ url, path }` ou `null` quando a etiqueta ainda não existe.
 */
export async function fetchAndStoreShippingLabel(
  supabase: SupabaseClient,
  params: { mlOrderId: string; shipmentId: string; accessToken: string },
): Promise<{ url: string; path: string } | null> {
  const { mlOrderId, shipmentId, accessToken } = params;

  try {
    const res = await mlFetch(
      `https://api.mercadolibre.com/shipment_labels?shipment_ids=${shipmentId}&response_type=pdf`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/pdf" } },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.warn(
        `[etiqueta] ML ${res.status} para shipment ${shipmentId}: ${detail.slice(0, 200)}`,
      );
      return null;
    }

    const bytes = new Uint8Array(await res.arrayBuffer());
    // Resposta pode vir como JSON de erro com status 200 em alguns casos
    if (bytes.byteLength < 1024) {
      console.warn(`[etiqueta] resposta muito pequena para shipment ${shipmentId}`);
      return null;
    }

    const path = `mercadolivre/${mlOrderId}/${shipmentId}.pdf`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: "application/pdf",
      upsert: true,
    });
    if (upErr) {
      console.error("[etiqueta] falha no upload:", upErr.message);
      return null;
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      console.error("[etiqueta] falha ao assinar URL:", signErr?.message);
      return null;
    }

    return { url: signed.signedUrl, path };
  } catch (e) {
    console.warn("[etiqueta] erro inesperado:", (e as Error).message);
    return null;
  }
}

/** Tenta resolver a etiqueta de um pedido; nunca lança. */
export async function resolveShippingLabel(
  supabase: SupabaseClient,
  params: { mlOrderId: string; userId: string; mlOrder: MlOrder; accessToken?: string | null },
): Promise<{ url: string | null; path: string | null }> {
  const shipmentId = extractShipmentId(params.mlOrder);
  if (!shipmentId) return { url: null, path: null };

  const token = params.accessToken ?? (await getMlAccessToken(supabase, params.userId));
  if (!token) return { url: null, path: null };

  const result = await fetchAndStoreShippingLabel(supabase, {
    mlOrderId: String(params.mlOrderId),
    shipmentId,
    accessToken: token,
  });

  return { url: result?.url ?? null, path: result?.path ?? null };
}
