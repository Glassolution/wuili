import { supabase } from "@/integrations/supabase/client";

/**
 * Fila de anúncios prontos que ainda não foram ao ar porque a conta do Mercado
 * Livre não estava habilitada a vender no momento em que a pessoa já tinha
 * pago. O anúncio fica guardado e sobe sozinho assim que a conta é liberada.
 *
 * Só entra aqui quem já pagou e já tentou publicar de verdade: nada é
 * publicado sem intenção explícita do usuário.
 */

export type RascunhoPendente = {
  userId: string;
  productId: string;
  title: string;
  /** Corpo exato aceito pela função `ml-publish`. */
  payload: Record<string, unknown>;
};

export const enfileirarPublicacaoPendente = async (dados: RascunhoPendente) => {
  const { data: existente } = await supabase
    .from("pending_publications")
    .select("id")
    .eq("user_id", dados.userId)
    .eq("product_id", dados.productId)
    .eq("status", "pending")
    .maybeSingle();

  if (existente?.id) {
    await supabase
      .from("pending_publications")
      .update({ payload: dados.payload, title: dados.title })
      .eq("id", existente.id);
    return existente.id;
  }

  const { data } = await supabase
    .from("pending_publications")
    .insert({
      user_id: dados.userId,
      product_id: dados.productId,
      title: dados.title,
      payload: dados.payload,
      reason: "ml_seller_not_ready",
    })
    .select("id")
    .maybeSingle();

  return data?.id ?? null;
};

/**
 * Pede ao servidor para reavaliar a fila do próprio usuário agora (usado no
 * botão "Já criei minha conta, verificar de novo"). Nunca lança: é um empurrão,
 * o cron continua cuidando do resto.
 */
export const tentarPublicarPendentesAgora = async () => {
  try {
    const { data } = await supabase.functions.invoke("auto-publish-pending");
    return { publicados: Number(data?.publicados ?? 0) };
  } catch {
    return { publicados: 0 };
  }
};

export const contarPublicacoesPendentes = async (userId: string) => {
  const { count } = await supabase
    .from("pending_publications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");
  return count ?? 0;
};
