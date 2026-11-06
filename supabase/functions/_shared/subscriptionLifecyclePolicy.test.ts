import { describe, it, expect, vi } from "vitest";
import { paymentIsBlocked, preservesPaidAccess, confirmProviderCancellation, isPostCancellationPayment, refundExecutionRequested } from "./subscriptionLifecyclePolicy";
const sub = { id: "46da48d0-d850-413d-a648-5d3036875754", user_id: "12287108-8160-45cf-b62e-f4c338cb7435", status: "expired", cancel_at_period_end: true, cancelled_at: "2026-10-06T23:18:29.137Z" };
describe("cancelled recurring payment rules", () => {
  it("a preview never authorizes a refund even when customer amount and reason are supplied", () => {
    const confirmation = { user_id: sub.user_id, amount: 79.80, reason: "Cobrança após cancelamento" };
    expect(refundExecutionRequested({ confirmation })).toBe(false);
    expect(refundExecutionRequested({ dry_run: true, confirmation })).toBe(false);
    expect(refundExecutionRequested({ dry_run: false, confirmation })).toBe(true);
    expect(refundExecutionRequested({ dry_run: false })).toBe(false);
  });
  it("confirmed cancellation preserves the remaining paid period", () => {
    expect(preservesPaidAccess({ ...sub, status: "cancel_scheduled", current_period_end: "2026-11-06T22:28:03.528Z" }, false, Date.parse("2026-11-06T13:05:23Z"))).toBe(true);
  });
  it("blocks the paid November 6 renewal after the October 6 cancellation", () => {
    expect(paymentIsBlocked(sub, true)).toBe(true);
    expect(isPostCancellationPayment("2026-11-06T13:05:23.392Z", sub.cancelled_at)).toBe(true);
    expect(isPostCancellationPayment("2026-10-06T22:27:56.159Z", sub.cancelled_at)).toBe(false);
  });
  it("does not reactivate a refunded subscription without a cancellation flag", () => {
    expect(paymentIsBlocked({ ...sub, cancel_at_period_end: false, cancelled_at: null, status: "refunded" }, false)).toBe(true);
    expect(paymentIsBlocked({ ...sub, cancel_at_period_end: false, cancelled_at: null, status: "pending" }, true)).toBe(true);
  });
  it("permits a different new paid contract", () => {
    expect(paymentIsBlocked({ ...sub, id: "new-contract", status: "pending", cancel_at_period_end: false, cancelled_at: null }, false)).toBe(false);
  });
  it("keeps scheduled cancellation access until the end of the paid period, not beyond it", () => {
    const scheduled = { ...sub, status: "active", current_period_end: "2026-11-06T22:28:03.528Z" };
    expect(preservesPaidAccess(scheduled, false, Date.parse("2026-11-06T13:05:23Z"))).toBe(true);
    expect(preservesPaidAccess(scheduled, false, Date.parse("2026-11-07T00:00:00Z"))).toBe(false);
    expect(preservesPaidAccess(scheduled, true, Date.parse("2026-11-06T13:05:23Z"))).toBe(false);
  });
  it("preserves another legitimate lifetime subscription", () => {
    expect(preservesPaidAccess({ ...sub, status: "active", purchase_kind: "lifetime", cancel_at_period_end: false, cancelled_at: null }, false, Date.now())).toBe(true);
  });
  it("calls provider cancellation then saves only confirmed cancellation", async () => {
    const cancel = vi.fn().mockResolvedValue({ status: "CANCELED" }); const save = vi.fn();
    await confirmProviderCancellation(async () => ({ status: "ACTIVE" }), cancel, save);
    expect(cancel).toHaveBeenCalledOnce(); expect(save).toHaveBeenCalledOnce();
  });
  it("retries missing local confirmation without cancelling an already cancelled provider again", async () => {
    const cancel = vi.fn(); const save = vi.fn();
    await confirmProviderCancellation(async () => ({ status: "CANCELED" }), cancel, save);
    expect(cancel).not.toHaveBeenCalled(); expect(save).toHaveBeenCalledOnce();
  });
  it("does not confirm HTTP success with an active provider", async () => {
    const save = vi.fn();
    await expect(confirmProviderCancellation(async () => ({ status: "ACTIVE" }), async () => null, save)).rejects.toThrow("unconfirmed");
    expect(save).not.toHaveBeenCalled();
  });
  it("does not save confirmation on provider failure", async () => {
    const save = vi.fn();
    await expect(confirmProviderCancellation(async () => ({ status: "ACTIVE" }), async () => { throw new Error("503"); }, save)).rejects.toThrow("503");
    expect(save).not.toHaveBeenCalled();
  });
  it("propagates confirmation storage failure instead of reporting success", async () => {
    await expect(confirmProviderCancellation(async () => ({ status: "CANCELED" }), vi.fn(), async () => { throw new Error("storage"); })).rejects.toThrow("storage");
  });
});