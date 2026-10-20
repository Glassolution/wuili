import { describe, expect, it } from "vitest";
import { getRefundMode } from "./refundEligibility";

describe("subscription refund eligibility", () => {
  const subscription = { id: "subscription", created_at: "2026-10-19T20:00:00Z", amount: 39.9, current_period_end: null, cancel_at_period_end: false };
  const start = new Date(subscription.created_at).getTime();
  const day = 86_400_000;
  it("offers refund within seven days", () => expect(getRefundMode(subscription, [], start + 2 * day)).toBe("reembolso"));
  it("includes the seven-day boundary", () => expect(getRefundMode(subscription, [], start + 7 * day)).toBe("reembolso"));
  it("offers only cancellation after seven days", () => expect(getRefundMode(subscription, [], start + 7 * day + 1)).toBe("cancelamento"));
  it("does not remove refund eligibility after renewal cancellation", () => expect(getRefundMode({ ...subscription, cancel_at_period_end: true }, [], start + day)).toBe("reembolso"));
  it("shows a submitted request as pending", () => expect(getRefundMode(subscription, [{ subscription_id: subscription.id, status: "pending" }], start + day)).toBe("em_analise"));
  it("preserves the repeated refund restriction", () => expect(getRefundMode(subscription, [{ subscription_id: "old", status: "processed" }], start + day)).toBe("cancelamento"));
});