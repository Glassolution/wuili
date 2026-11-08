import { describe, expect, it } from "vitest";
import { monthlyRenewalDisclosure } from "../../supabase/functions/_shared/monthlyRenewal";
import { CANCEL_PAGE_PATH } from "../../supabase/functions/_shared/refundPolicy";

describe("monthly renewal disclosure eligibility", () => {
  it("includes cancellation destination for monthly subscriptions", () => {
    expect(monthlyRenewalDisclosure("monthly")?.cancelPath).toBe(CANCEL_PAGE_PATH);
    expect(monthlyRenewalDisclosure("mensal")).not.toBeNull();
  });
  it("excludes one-time lifetime purchases", () => {
    expect(monthlyRenewalDisclosure("lifetime")).toBeNull();
    expect(monthlyRenewalDisclosure("pagamento único")).toBeNull();
  });
});