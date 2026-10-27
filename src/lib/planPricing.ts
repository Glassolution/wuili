export type VeloPaidPlanId = "base" | "pro" | "business";

export const VELO_PLAN_PRICES: Record<VeloPaidPlanId, { monthly: number; annual: number; lifetime: number; compareAt: number }> = {
  base: { monthly: 39.9, annual: 430.92, lifetime: 39.9, compareAt: 47.88 },
  pro: { monthly: 79.8, annual: 861.84, lifetime: 79.8, compareAt: 95.76 },
  business: { monthly: 189.9, annual: 2278.8, lifetime: 189.9, compareAt: 227.88 },
};

export const billingCycleForPlan = (_plan: string): "monthly" => "monthly";

export const VELO_STARTING_MONTHLY_PRICE = Math.min(
  ...Object.values(VELO_PLAN_PRICES).map((plan) => plan.monthly),
);

export const formatPlanPriceBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);