// Fonte única de verdade dos preços dos planos (FRONTEND).
//
// Qualquer tela que mostre preço de assinatura (modal de planos, checkout,
// modal de importação, editor de loja, etc.) deve importar daqui — assim, mudar
// o valor em um lugar atualiza a aplicação inteira.
//
// ⚠️ ATENÇÃO — o valor REALMENTE COBRADO é definido no servidor, em
// `supabase/functions/mp-checkout/index.ts` (objeto `plans`). Ao alterar um
// preço aqui, altere TAMBÉM lá, senão o usuário vê um valor e é cobrado outro.

export type PlanId = "base" | "pro" | "business";

export const PLAN_IDS: PlanId[] = ["base", "pro", "business"];

export const PLAN_NAMES: Record<PlanId, string> = {
  base: "Base",
  pro: "Pro",
  business: "Business",
};

/** Preço mensal cobrado hoje (valor promocional vigente). */
export const PLAN_MONTHLY_AMOUNTS: Record<PlanId, number> = {
  base: 29.9,
  pro: 79.8,
  business: 159.6,
};

/** Preço "de" (antes da promoção). Só existe quando há desconto ativo. */
export const PLAN_ORIGINAL_MONTHLY_AMOUNTS: Partial<Record<PlanId, number>> = {
  base: 39.9,
};

/** Preço anual (12 meses com 10% de desconto). */
export const PLAN_ANNUAL_AMOUNTS: Record<PlanId, number> = {
  base: 322.92, // 29.90 * 12 * 0.9
  pro: 861.84, // 79.80 * 12 * 0.9
  business: 1723.68, // 159.60 * 12 * 0.9
};

export const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);

/** Ex.: "R$ 79,80" — preço mensal formatado do plano. */
export const getPlanMonthlyLabel = (planId: PlanId) => formatBRL(PLAN_MONTHLY_AMOUNTS[planId]);

/** Ex.: "R$ 861,84" — preço anual formatado do plano. */
export const getPlanAnnualLabel = (planId: PlanId) => formatBRL(PLAN_ANNUAL_AMOUNTS[planId]);
