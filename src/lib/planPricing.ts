export type VeloPaidPlanId = "base" | "pro" | "business";

export const VELO_PLAN_PRICES: Record<VeloPaidPlanId, { monthly: number; annual: number }> = {
  base: { monthly: 39.9, annual: 430.92 },
  pro: { monthly: 79.8, annual: 861.84 },
  business: { monthly: 189.9, annual: 2278.8 },
};

export const billingCycleForPlan = (plan: string): "monthly" | "annual" =>
  plan === "business" ? "annual" : "monthly";

export const VELO_STARTING_MONTHLY_PRICE = Math.min(
  ...Object.values(VELO_PLAN_PRICES).map((plan) => plan.monthly),
);

export const formatPlanPriceBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);