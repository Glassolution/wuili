export const DEFAULT_SALE_MULTIPLIER = 2.5;

export type ProductPricingEstimate = {
  cost: number;
  suggestedSalePrice: number;
  grossRemainder: number;
};

const roundMoney = (value: number) => Math.round(value * 100) / 100;

export const getProductPricingEstimate = (
  costValue: number | null | undefined,
  storedSuggestedValue?: number | null,
): ProductPricingEstimate => {
  const cost = Math.max(0, Number(costValue) || 0);
  const storedSuggested = Number(storedSuggestedValue) || 0;
  const suggestedSalePrice = roundMoney(
    storedSuggested > cost ? storedSuggested : cost * DEFAULT_SALE_MULTIPLIER,
  );

  return {
    cost,
    suggestedSalePrice,
    grossRemainder: roundMoney(Math.max(0, suggestedSalePrice - cost)),
  };
};