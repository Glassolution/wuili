import { describe, expect, it } from "vitest";
import { VELO_PLAN_PRICES, billingCycleForPlan } from "./planPricing";
import { LIFETIME_PLANS, lifetimePaymentMatches, lifetimePeriod } from "../../supabase/functions/_shared/lifetimePlans";

describe("oferta vitalícia", () => {
  it.each([
    ["base", 89.9, 107.88], ["pro", 179.8, 215.76], ["business", 427.9, 513.48],
  ] as const)("vitalício %s custa o valor definido e a referência é 20% maior", (plan, amount, reference) => {
    expect(VELO_PLAN_PRICES[plan].lifetime).toBe(amount);
    expect(VELO_PLAN_PRICES[plan].compareAt).toBe(reference);
    expect(LIFETIME_PLANS[plan].amount).toBe(amount);
    expect(LIFETIME_PLANS[plan].compareAt).toBe(reference);
  });
  it("mensal continua igual", () => {
    expect(VELO_PLAN_PRICES.base.monthly).toBe(39.9);
    expect(VELO_PLAN_PRICES.pro.monthly).toBe(79.8);
    expect(VELO_PLAN_PRICES.business.monthly).toBe(189.9);
  });
  it("mantém os valores anuais anteriores sem transformar contratos existentes", () => {
    expect(VELO_PLAN_PRICES.base.annual).toBe(430.92);
    expect(VELO_PLAN_PRICES.pro.annual).toBe(861.84);
    expect(VELO_PLAN_PRICES.business.annual).toBe(2278.8);
  });
  it("vitalício não expira nem tem nova cobrança", () => {
    expect(lifetimePeriod.current_period_end).toBeNull();
    expect(lifetimePeriod.next_charge_at).toBeNull();
    expect(lifetimePeriod.next_charge_amount).toBeNull();
    expect(lifetimePeriod.cancel_at_period_end).toBe(false);
  });
  it("só confirma o valor integral esperado", () => {
    expect(lifetimePaymentMatches(39.9, 39.9)).toBe(true);
    expect(lifetimePaymentMatches(39.9, 39.89)).toBe(false);
    expect(lifetimePaymentMatches(39.9, null)).toBe(false);
  });
  it("Business não obriga novos compradores a contratar anual", () => {
    expect(billingCycleForPlan("business")).toBe("monthly");
  });
});