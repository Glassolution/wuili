/**
 * Cota diária do Atlas, por usuário e por plano.
 *
 * Só conta o que realmente custou: linhas de `atlas_usage_logs` com
 * `origem = 'modelo'`. Resposta resolvida em código (FAQ, guia, recusa) não
 * gasta cota, porque não chamou modelo nenhum.
 *
 * O resumo progressivo de contexto também chama modelo, mas é custo interno da
 * plataforma e não uma resposta pedida pelo usuário — por isso a etapa
 * `resumo_contexto` fica de fora da contagem.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type Client = SupabaseClient<any> | null;

export const ATLAS_ETAPA_RESUMO = "resumo_contexto";

/** Ponto de partida. Vamos calibrar com dados reais de atlas_usage_logs. */
export const ATLAS_QUOTAS: Record<string, number | null> = {
  gratis: 15,
  base: 60,
  pro: 200,
  business: null, // ilimitado, com alerta interno
};

/** Acima disso um usuário business vira log de alerta para revisarmos. */
const ALERTA_BUSINESS = 300;

export type AtlasQuota = {
  plano: string;
  limite: number | null;
  usadas: number;
  restantes: number | null;
  permitido: boolean;
};

const inicioDoDiaUTC = () => {
  const agora = new Date();
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate())).toISOString();
};

const normalizarPlano = (valor: unknown) => {
  const plano = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  return plano in ATLAS_QUOTAS ? plano : "gratis";
};

/**
 * Estado da cota do usuário agora.
 *
 * Nunca lança: se o banco não responder, libera a conversa. Bloquear alguém por
 * causa de uma falha nossa de leitura é o pior dos dois erros possíveis.
 */
export const checarQuotaAtlas = async (supabase: Client, userId: string): Promise<AtlasQuota> => {
  const liberado = (plano = "gratis"): AtlasQuota => ({
    plano,
    limite: ATLAS_QUOTAS[plano] ?? null,
    usadas: 0,
    restantes: ATLAS_QUOTAS[plano] ?? null,
    permitido: true,
  });

  if (!supabase) return liberado();

  try {
    const { data: perfil } = await supabase
      .from("profiles")
      .select("plano")
      .eq("user_id", userId)
      .maybeSingle();

    const plano = normalizarPlano((perfil as { plano?: unknown } | null)?.plano);
    const limite = ATLAS_QUOTAS[plano] ?? null;

    const { count, error } = await supabase
      .from("atlas_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("origem", "modelo")
      .neq("etapa", ATLAS_ETAPA_RESUMO)
      .gte("created_at", inicioDoDiaUTC());

    if (error) {
      console.error("atlas quota leitura falhou", error.message);
      return liberado(plano);
    }

    const usadas = count ?? 0;

    if (limite === null) {
      if (usadas >= ALERTA_BUSINESS) {
        console.warn("atlas quota alerta business", JSON.stringify({ userId, usadas }));
      }
      return { plano, limite: null, usadas, restantes: null, permitido: true };
    }

    return {
      plano,
      limite,
      usadas,
      restantes: Math.max(0, limite - usadas),
      permitido: usadas < limite,
    };
  } catch (e) {
    console.error("atlas quota falhou", e);
    return liberado();
  }
};

export const mensagemDeQuotaEsgotada = (quota: AtlasQuota) =>
  quota.plano === "gratis"
    ? `Você já usou as ${quota.limite} mensagens de hoje com o Atlas. 😄\n\nElas voltam amanhã. Se quiser conversar sem esse limite apertado, os planos pagos liberam bem mais mensagens por dia.`
    : `Você chegou ao limite de ${quota.limite} mensagens do Atlas por hoje. Elas voltam amanhã.\n\nEnquanto isso, dá para seguir publicando e acompanhando seus anúncios normalmente.`;
