export const LIFETIME_PLANS = {
  base: { amount: 39.9, compareAt: 47.88, priceId: "price_1793065896792_cxyb9wfkm" },
  pro: { amount: 79.8, compareAt: 95.76, priceId: "price_1793065897559_eqn1ftdww" },
  business: { amount: 189.9, compareAt: 227.88, priceId: "price_1793065897948_asqb0fd9h" },
} as const;

export const lifetimePaymentMatches = (expected: number, paid: number | null) =>
  paid !== null && expected > 0 && Math.round(expected * 100) === Math.round(paid * 100);

export const lifetimePeriod = {
  current_period_end: null,
  next_charge_at: null,
  next_charge_amount: null,
  cancel_at_period_end: false,
};