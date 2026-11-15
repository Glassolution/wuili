import { describe, expect, it } from "vitest";
import { hasRefundWindowException } from "../../supabase/functions/_shared/refundPolicy";
import { getRefundMode } from "./refundEligibility";

const id = "2af69ba1-536e-42a9-970f-ef69508b7880";
const email = "lucassrby@gmail.com";
const sub = { id: "paid-sub", created_at: "2026-01-01T00:00:00Z" };
const now = Date.parse("2026-11-15T18:20:00Z");
const options = { waiveWindow: hasRefundWindowException(id, email, true) };

describe("account-scoped admin refund window", () => {
  it("lets the specified admin request well after seven days", () => {
    expect(getRefundMode(sub, [], now, options)).toBe("reembolso");
  });
  it("requires the protected admin role", () => {
    expect(hasRefundWindowException(id, email, false)).toBe(false);
  });
  it("does not extend the exception to another admin", () => {
    expect(hasRefundWindowException("another-id", "another@example.com", true)).toBe(false);
  });
  it("does not trust a copied email on another identity", () => {
    expect(hasRefundWindowException("another-id", email, true)).toBe(false);
  });
  it("requires the matching authenticated email", () => {
    expect(hasRefundWindowException(id, "another@example.com", true)).toBe(false);
  });
  it("preserves the standard seven-day limit", () => {
    expect(getRefundMode(sub, [], now)).toBe("cancelamento");
  });
  it("still blocks a duplicate pending request", () => {
    expect(getRefundMode(sub, [{ subscription_id: sub.id, status: "pending" }], now, options)).toBe("em_analise");
  });
  it("still blocks a repeated completed refund", () => {
    expect(getRefundMode(sub, [{ subscription_id: "old", status: "processed" }], now, options)).toBe("cancelamento");
  });
  it("still requires an eligible subscription", () => {
    expect(getRefundMode(null, [], now, options)).toBe("sem_assinatura");
  });
  it("also waives the window on a lifetime subscription", () => {
    expect(getRefundMode({ ...sub, purchase_kind: "lifetime" }, [], now, options)).toBe("reembolso");
  });
});