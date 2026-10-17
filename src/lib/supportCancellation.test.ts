import { describe, expect, it } from "vitest";
import { isSelfServiceCancellation, isCancellationConfirmation } from "../../supabase/functions/_shared/supportCancellation";

describe("subscription cancellation routing", () => {
  const paidAt = "2026-10-01T12:00:00Z";
  const day = 86_400_000;
  const start = new Date(paidAt).getTime();
  it("uses self-service after 7 days instead of human refund review", () => {
    expect(isSelfServiceCancellation("reembolso", paidAt, start + 7 * day + 1)).toBe(true);
    expect(isSelfServiceCancellation("cancelamento", paidAt, start + 8 * day)).toBe(true);
  });
  it("preserves refund review through the 7-day boundary", () => {
    expect(isSelfServiceCancellation("reembolso", paidAt, start + 7 * day)).toBe(false);
  });
  it("does not suppress an explicit request for a human", () => {
    expect(isSelfServiceCancellation("pediu_humano", paidAt, start + 8 * day)).toBe(false);
  });
  it("does not treat a completed cancellation as another request", () => {
    expect(isCancellationConfirmation("Cancelamento do plano confirmado.\nMotivo: Tive problemas técnicos.")).toBe(true);
    expect(isCancellationConfirmation("Quero cancelar o plano")).toBe(false);
  });
});