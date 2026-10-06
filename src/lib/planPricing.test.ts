import { describe, expect, it } from "vitest";
import { effectiveBillingCycle, VELO_PLAN_PRICES } from "./planPricing";

describe("effectiveBillingCycle", () => {
  it("mantém o Business no anual mesmo com Mensal escolhido", () => {
    expect(effectiveBillingCycle("business", "monthly")).toBe("annual");
    expect(effectiveBillingCycle("business", "annual")).toBe("annual");
  });

  it("Base e Pro seguem o seletor Mensal/Anual", () => {
    expect(effectiveBillingCycle("base", "monthly")).toBe("monthly");
    expect(effectiveBillingCycle("base", "annual")).toBe("annual");
    expect(effectiveBillingCycle("pro", "monthly")).toBe("monthly");
    expect(effectiveBillingCycle("pro", "annual")).toBe("annual");
  });

  it("Business anual sai a R$ 189,90 por mês, R$ 2.278,80 no ano", () => {
    expect(VELO_PLAN_PRICES.business.annual).toBe(2278.8);
    expect(VELO_PLAN_PRICES.business.annual / 12).toBeCloseTo(189.9, 2);
  });
});
