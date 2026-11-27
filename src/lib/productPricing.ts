export const DEFAULT_SALE_MULTIPLIER = 2;

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
  // Regra Velo: o preço sugerido é sempre o dobro do custo, em todo produto.
  void storedSuggestedValue;
  const suggestedSalePrice = roundMoney(cost * DEFAULT_SALE_MULTIPLIER);

  return {
    cost,
    suggestedSalePrice,
    grossRemainder: roundMoney(Math.max(0, suggestedSalePrice - cost)),
  };
};