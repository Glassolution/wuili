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
  it("treats an approved refund on another subscription as already refunded", () => expect(getRefundMode(subscription, [{ subscription_id: "old", status: "approved" }], start + day)).toBe("cancelamento"));
  it("lets a rejected request ask again", () => expect(getRefundMode(subscription, [{ subscription_id: subscription.id, status: "rejected" }], start + day)).toBe("reembolso"));
  it("shows the approved refund of this subscription", () => expect(getRefundMode(subscription, [{ subscription_id: subscription.id, status: "processed" }], start + day)).toBe("aprovado"));
  it("shows a cancelled renewal after seven days", () => expect(getRefundMode({ ...subscription, cancel_at_period_end: true }, [], start + 8 * day)).toBe("cancelado"));
  it("has nothing to cancel on a lifetime plan after seven days", () => expect(getRefundMode({ ...subscription, purchase_kind: "lifetime" }, [], start + 8 * day)).toBe("vitalicio"));
  it("still refunds a lifetime plan within seven days", () => expect(getRefundMode({ ...subscription, purchase_kind: "lifetime" }, [], start + day)).toBe("reembolso"));
  it("reports no subscription", () => expect(getRefundMode(null, [], start)).toBe("sem_assinatura"));
});