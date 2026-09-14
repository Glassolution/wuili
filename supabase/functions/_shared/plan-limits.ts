/**
 * Matriz única de limites por plano (backend).
 *
 * Espelha `src/lib/planLimits.ts`. Sempre que mudar um número aqui, mude lá
 * também — o frontend só exibe, quem bloqueia de fato é a edge function.
 *
 * Filosofia comercial: o Pro é o plano-âncora (melhor custo-benefício). O Base
 * serve pra começar, e o Business amplia volume — mas nem o Business é
 * "infinito" nas features de IA, que têm custo por uso.
 */

export type PlanKey = "gratis" | "base" | "pro" | "business";

/** null = sem teto. */
export type PlanLimits = {
  /** Anúncios ativos no Mercado Livre. */
  mlActiveListings: number | null;
  /** Novas publicações no Mercado Livre por mês. */
  mlPublicationsPerMonth: number | null;
  /** Publicar vários anúncios de uma vez. */
  mlBulkPublish: boolean;
  /** Publicar com variações (cor/tamanho). */
  mlVariations: boolean;
  /** Sincronização automática de preço e estoque. */
  mlAutoSync: boolean;
  /** Marketplaces conectados simultaneamente. */
  marketplaces: number | null;
  /** Imagens com IA por mês. */
  aiImagesPerMonth: number | null;
  /** Vídeos com IA por mês. */
  aiVideosPerMonth: number | null;
  /** Personagens/influencers de IA (TikTok) na biblioteca. */
  aiCharacters: number | null;
  /** Mensagens do Atlas que chamam modelo, por dia. */
  atlasMessagesPerDay: number | null;
  /** Páginas de venda geradas por IA. */
  salesPages: number | null;
  /** Lojas completas geradas por IA. */
  stores: number | null;
};

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  gratis: {
    mlActiveListings: 0,
    mlPublicationsPerMonth: 0,
    mlBulkPublish: false,
    mlVariations: false,
    mlAutoSync: false,
    marketplaces: 1,
    aiImagesPerMonth: 3,
    aiVideosPerMonth: 0,
    aiCharacters: 1,
    atlasMessagesPerDay: 10,
    salesPages: 0,
    stores: 0,
  },
  base: {
    mlActiveListings: 50,
    mlPublicationsPerMonth: 50,
    mlBulkPublish: false,
    mlVariations: false,
    mlAutoSync: false,
    marketplaces: 1,
    aiImagesPerMonth: 20,
    aiVideosPerMonth: 0,
    aiCharacters: 3,
    atlasMessagesPerDay: 40,
    salesPages: 1,
    stores: 0,
  },
  pro: {
    mlActiveListings: 300,
    mlPublicationsPerMonth: 300,
    mlBulkPublish: true,
    mlVariations: true,
    mlAutoSync: true,
    marketplaces: 2,
    aiImagesPerMonth: 100,
    aiVideosPerMonth: 10,
    aiCharacters: 10,
    atlasMessagesPerDay: 150,
    salesPages: 10,
    stores: 3,
  },
  business: {
    mlActiveListings: null,
    mlPublicationsPerMonth: null,
    mlBulkPublish: true,
    mlVariations: true,
    mlAutoSync: true,
    marketplaces: null,
    aiImagesPerMonth: 300,
    aiVideosPerMonth: 30,
    aiCharacters: 30,
    atlasMessagesPerDay: 400,
    salesPages: null,
    stores: null,
  },
};

/** 'go'/'plus' são planos legados: mapeados pro equivalente vendido hoje. */
export function normalizePlanKey(plan: unknown): PlanKey {
  const value = String(plan ?? "gratis").trim().toLowerCase();
  if (value === "free") return "gratis";
  if (value === "go") return "base";
  if (value === "plus") return "pro";
  if (value === "base" || value === "pro" || value === "business") return value;
  return "gratis";
}

export function getPlanLimits(plan: unknown): PlanLimits {
  return PLAN_LIMITS[normalizePlanKey(plan)];
}
