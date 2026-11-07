import { describe, expect, it, vi } from "vitest";
vi.mock("../../supabase/functions/_shared/validapay.ts", () => ({ getCharge: vi.fn(), validaPayFetch: vi.fn() }));
import { courtesyConfirmationMatches } from "../../supabase/functions/_shared/adminCourtesyRefund";

describe("courtesy refund transaction confirmation", () => {
  const input = { subscription_id: "8ee4e190-fabc-432f-a59e-5d2af023cacb", charge_id: "cha_1794056729053_du9gn1qc2",
    user_id: "8fdfbd11-d2f3-4036-943e-64f1a96a0168", amount: 79.80,
    reason: "Cortesia: renovação cobrada e cancelada em menos de 1 hora (ticket 162bc4e0)" };
  it("requires the exact approved customer, amount and reason", () => {
    expect(courtesyConfirmationMatches({ ...input, confirmation: input })).toBe(true);
    expect(courtesyConfirmationMatches({ ...input, confirmation: { ...input, amount: 39.90 } })).toBe(false);
    expect(courtesyConfirmationMatches({ ...input, confirmation: { ...input, user_id: "another-user" } })).toBe(false);
    expect(courtesyConfirmationMatches({ ...input, confirmation: { ...input, reason: "" } })).toBe(false);
  });
});