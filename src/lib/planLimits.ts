import type { PlanName } from "@/hooks/usePlan";

export type LimitValue = number | null;

export type PlanUsage = {
  publishedProducts?: number;
  connectedMarketplaces?: number;
  aiAgents?: number;
  automations?: number;
};

export type OperationalPlanLimits = {
  /** Anúncios ativos no Mercado Livre. */
  products: LimitValue;
  /** Novas publicações no Mercado Livre por mês. */
  productsPerMonth: LimitValue;
  /** Publicar vários anúncios de uma vez. */
  bulkPublish: boolean;
  /** Publicar com variações (cor/tamanho). */
  mlVariations: boolean;
  /** Sincronização automática de preço e estoque. */
  mlAutoSync: boolean;
  marketplaces: LimitValue;
  aiAgents: LimitValue;
  automations: LimitValue;
  salesPages: LimitValue;
  stores: LimitValue;
  /** Imagens com IA por mês. */
  aiImagesPerMonth: LimitValue;
  /** Vídeos com IA por mês. */
  aiVideosPerMonth: LimitValue;
  /** Personagens/influencers de IA na biblioteca. */
  aiCharacters: LimitValue;
  /** Mensagens do Atlas com modelo, por dia. */
  atlasMessagesPerDay: LimitValue;
  analytics: "none" | "basic" | "premium";
  monitoring: "none" | "basic" | "premium";
  autoReplies: "none" | "limited" | "unlimited";
  advancedReports: boolean;
  prioritySupport: boolean;
  dedicatedSupport: boolean;
  apiAccess: boolean;
};

/**
 * Matriz única de limites por plano (frontend).
 *
 * Espelha `supabase/functions/_shared/plan-limits.ts`. Aqui é só exibição e
 * bloqueio de UI; o bloqueio real acontece nas edge functions.
 *
 * O Pro é o plano-âncora. O Base começa a operação e o Business amplia volume,
 * mas mesmo o Business tem teto nas features de IA (custo por uso).
 */
export const PLAN_LIMITS: Record<PlanName, OperationalPlanLimits> = {
  gratis: {
    products: 0, productsPerMonth: 0, bulkPublish: false, mlVariations: false, mlAutoSync: false,
    marketplaces: 1, aiAgents: 0, automations: 0,
    salesPages: 0, stores: 0,
    aiImagesPerMonth: 3, aiVideosPerMonth: 0, aiCharacters: 1, atlasMessagesPerDay: 10,
    analytics: "none", monitoring: "none", autoReplies: "none",
    advancedReports: false, prioritySupport: false, dedicatedSupport: false, apiAccess: false,
  },
  // Plano legado (não vendido): tratado como Base.
  go: {
    products: 50, productsPerMonth: 50, bulkPublish: false, mlVariations: false, mlAutoSync: false,
    marketplaces: 1, aiAgents: 0, automations: 0,
    salesPages: 1, stores: 0,
    aiImagesPerMonth: 20, aiVideosPerMonth: 0, aiCharacters: 3, atlasMessagesPerDay: 40,
    analytics: "basic", monitoring: "basic", autoReplies: "none",
    advancedReports: false, prioritySupport: false, dedicatedSupport: false, apiAccess: false,
  },
  base: {
    products: 50, productsPerMonth: 50, bulkPublish: false, mlVariations: false, mlAutoSync: false,
    marketplaces: 1, aiAgents: 0, automations: 0,
    salesPages: 1, stores: 0,
    aiImagesPerMonth: 20, aiVideosPerMonth: 0, aiCharacters: 3, atlasMessagesPerDay: 40,
    analytics: "basic", monitoring: "basic", autoReplies: "none",
    advancedReports: false, prioritySupport: false, dedicatedSupport: false, apiAccess: false,
  },
  pro: {
    products: 300, productsPerMonth: 300, bulkPublish: true, mlVariations: true, mlAutoSync: true,
    marketplaces: 2, aiAgents: 3, automations: 3,
    salesPages: 10, stores: 3,
    aiImagesPerMonth: 100, aiVideosPerMonth: 10, aiCharacters: 10, atlasMessagesPerDay: 150,
    analytics: "basic", monitoring: "basic", autoReplies: "limited",
    advancedReports: true, prioritySupport: true, dedicatedSupport: false, apiAccess: false,
  },
  business: {
    products: null, productsPerMonth: null, bulkPublish: true, mlVariations: true, mlAutoSync: true,
    marketplaces: null, aiAgents: null, automations: null,
    salesPages: null, stores: null,
    aiImagesPerMonth: 300, aiVideosPerMonth: 30, aiCharacters: 30, atlasMessagesPerDay: 400,
    analytics: "premium", monitoring: "premium", autoReplies: "unlimited",
    advancedReports: true, prioritySupport: true, dedicatedSupport: true, apiAccess: true,
  },
};

const NORMALIZE_PLAN: Record<string, PlanName> = {
  gratis: "gratis",
  free: "gratis",
  go: "go",
  base: "base",
  plus: "pro",
  pro: "pro",
  business: "business",
};

export const normalizePlanName = (plan?: string | null): PlanName =>
  NORMALIZE_PLAN[String(plan ?? "gratis").toLowerCase()] ?? "gratis";

export const getPlanLimits = (plan?: string | null): OperationalPlanLimits =>
  PLAN_LIMITS[normalizePlanName(plan)];

export const hasReachedLimit = (used: number, limit: LimitValue): boolean =>
  typeof limit === "number" && used >= limit;

export const remainingLimit = (used: number, limit: LimitValue): number | null =>
  typeof limit === "number" ? Math.max(limit - used, 0) : null;

export const formatLimit = (limit: LimitValue): string =>
  limit === null ? "ilimitado" : String(limit);

export const canPublishProducts = (
  plan?: string | null,
  usage: PlanUsage = {}
): boolean => {
  const limits = getPlanLimits(plan);
  if (limits.products === 0) return false;
  return !hasReachedLimit(usage.publishedProducts ?? 0, limits.products);
};

export const canBulkPublish = (plan?: string | null): boolean =>
  getPlanLimits(plan).bulkPublish;

export const canUseMlVariations = (plan?: string | null): boolean =>
  getPlanLimits(plan).mlVariations;

export const canUseMlAutoSync = (plan?: string | null): boolean =>
  getPlanLimits(plan).mlAutoSync;

export const canCreateAutomation = (
  plan?: string | null,
  usage: PlanUsage = {}
): boolean => {
  const limits = getPlanLimits(plan);
  if (limits.automations === 0) return false;
  return !hasReachedLimit(usage.automations ?? 0, limits.automations);
};

export const canUseAdvancedAI = (plan?: string | null): boolean =>
  normalizePlanName(plan) === "business";

export const canCreateAgent = (
  plan?: string | null,
  usage: PlanUsage = {}
): boolean => {
  const limits = getPlanLimits(plan);
  if (limits.aiAgents === 0) return false;
  return !hasReachedLimit(usage.aiAgents ?? 0, limits.aiAgents);
};

export const canConnectMarketplace = (
  plan?: string | null,
  usage: PlanUsage = {}
): boolean => {
  const limits = getPlanLimits(plan);
  return !hasReachedLimit(usage.connectedMarketplaces ?? 0, limits.marketplaces);
};

export const canCreateStore = (
  plan?: string | null,
  currentStoreCount = 0,
): boolean => {
  const limits = getPlanLimits(plan);
  if (limits.stores === 0) return false;
  return !hasReachedLimit(currentStoreCount, limits.stores);
};

export const canCreateSalesPage = (
  plan?: string | null,
  currentPageCount = 0,
): boolean => {
  const limits = getPlanLimits(plan);
  if (limits.salesPages === 0) return false;
  return !hasReachedLimit(currentPageCount, limits.salesPages);
};
