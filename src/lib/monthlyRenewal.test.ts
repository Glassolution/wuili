import { describe, expect, it } from "vitest";
import { monthlyRenewalDisclosure } from "../../supabase/functions/_shared/monthlyRenewal";

describe("monthly renewal disclosure eligibility", () => {
  it("includes cancellation destination for monthly subscriptions", () => {
    expect(monthlyRenewalDisclosure("monthly")?.cancelPath).toBe("/dashboard/configuracoes?tab=Plano#velo-cancelar-renovacao");
    expect(monthlyRenewalDisclosure("mensal")).not.toBeNull();
  });
  it("excludes one-time lifetime purchases", () => {
    expect(monthlyRenewalDisclosure("lifetime")).toBeNull();
    expect(monthlyRenewalDisclosure("pagamento único")).toBeNull();
  });
});