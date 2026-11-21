export type VeloPaidPlanId = "base" | "pro" | "business";

export const VELO_PLAN_PRICES: Record<VeloPaidPlanId, { monthly: number; annual: number; lifetime: number; compareAt: number }> = {
  base: { monthly: 39.9, annual: 430.92, lifetime: 89.9, compareAt: 107.88 },
  pro: { monthly: 79.8, annual: 861.84, lifetime: 179.8, compareAt: 215.76 },
  business: { monthly: 189.9, annual: 2278.8, lifetime: 427.9, compareAt: 513.48 },
};

// Teste de 2 semanas (desde 2026-11-20): Vitalício fora da venda.
// Só esconde a oferta (modal de planos, checkout, landing). Quem já comprou
// continua vitalício: a regra é subscriptions.purchase_kind, que não muda.
// Para voltar a vender: true.
export const LIFETIME_PLAN_ENABLED = false;

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