export const LIFETIME_PLANS = {
  base: { amount: 89.9, compareAt: 107.88, priceId: "price_1793125420003_5gt3zbea5" },
  pro: { amount: 179.8, compareAt: 215.76, priceId: "price_1793125429007_fbi5w2tq6" },
  business: { amount: 427.9, compareAt: 513.48, priceId: "price_1793125430695_yh8nh20by" },
} as const;

export const lifetimePaymentMatches = (expected: number, paid: number | null) =>
  paid !== null && expected > 0 && Math.round(expected * 100) === Math.round(paid * 100);

export const lifetimePeriod = {
  current_period_end: null,
  next_charge_at: null,
  next_charge_amount: null,
  cancel_at_period_end: false,
};