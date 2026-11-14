import { describe, expect, it } from "vitest";
import { upgradeDifference, sameBillingDate, upgradePaymentMatches } from "../../supabase/functions/_shared/planUpgradePolicy";
describe("upgrade pela diferença integral", () => {
  it("Base para Pro cobra R$39,90", () => expect(upgradeDifference("base", "pro")).toBe(39.9));
  it("Pro para Business cobra R$110,10", () => expect(upgradeDifference("pro", "business")).toBe(110.1));
  it("Base para Business cobra R$150,00", () => expect(upgradeDifference("base", "business")).toBe(150));
  it("não aceita downgrade ou recompra", () => {
    expect(() => upgradeDifference("pro", "base")).toThrow();
    expect(() => upgradeDifference("base", "base")).toThrow();
  });
  it("não aceita alteração da data de renovação", () => {
    expect(sameBillingDate("2026-12-11T23:22:00Z", "2026-12-11T23:22:00.000Z")).toBe(true);
    expect(sameBillingDate("2026-12-11T23:22:00Z", "2026-12-14T23:22:00Z")).toBe(false);
  });
  it("exige a diferença exata, não a mensalidade inteira", () => {
    expect(upgradePaymentMatches(39.9, 39.9)).toBe(true);
    expect(upgradePaymentMatches(39.9, 79.8)).toBe(false);
    expect(upgradePaymentMatches(39.9, null)).toBe(false);
  });
});