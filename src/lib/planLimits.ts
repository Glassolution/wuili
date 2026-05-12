import type { PlanName } from "@/hooks/usePlan";

export type LimitValue = number | null;

export type PlanUsage = {
  publishedProducts?: number;
  connectedMarketplaces?: number;
  aiAgents?: number;
  automations?: number;
};

export type OperationalPlanLimits = {
  products: LimitValue;
  marketplaces: LimitValue;
  aiAgents: LimitValue;
  automations: LimitValue;
  analytics: "none" | "basic" | "premium";
  monitoring: "none" | "basic" | "premium";
  autoReplies: "none" | "limited" | "unlimited";
  advancedReports: boolean;
  prioritySupport: boolean;
  dedicatedSupport: boolean;
  apiAccess: boolean;
};

export const PLAN_LIMITS: Record<PlanName, OperationalPlanLimits> = {
  gratis: {
    products: 0,
    marketplaces: 1,
    aiAgents: 0,
    automations: 0,
    analytics: "none",
    monitoring: "none",
    autoReplies: "none",
    advancedReports: false,
    prioritySupport: false,
    dedicatedSupport: false,
    apiAccess: false,
  },
  go: {
    products: 0,
    marketplaces: 1,
    aiAgents: 0,
    automations: 0,
    analytics: "none",
    monitoring: "none",
    autoReplies: "none",
    advancedReports: false,
    prioritySupport: false,
    dedicatedSupport: false,
    apiAccess: false,
  },
  pro: {
    products: 30,
    marketplaces: 2,
    aiAgents: 3,
    automations: 3,
    analytics: "basic",
    monitoring: "basic",
    autoReplies: "limited",
    advancedReports: true,
    prioritySupport: true,
    dedicatedSupport: false,
    apiAccess: false,
  },
  business: {
    products: null,
    marketplaces: null,
    aiAgents: null,
    automations: null,
    analytics: "premium",
    monitoring: "premium",
    autoReplies: "unlimited",
    advancedReports: true,
    prioritySupport: true,
    dedicatedSupport: true,
    apiAccess: true,
  },
};

const NORMALIZE_PLAN: Record<string, PlanName> = {
  gratis: "gratis",
  free: "gratis",
  go: "go",
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

export const canPublishProducts = (
  plan?: string | null,
  usage: PlanUsage = {}
): boolean => {
  const limits = getPlanLimits(plan);
  if (limits.products === 0) return false;
  return !hasReachedLimit(usage.publishedProducts ?? 0, limits.products);
};

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

