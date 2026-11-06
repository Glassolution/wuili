import { describe, it, expect } from "vitest";
import { guardPaidSubscription } from "./subscriptionLifecycle";

/** In-memory fluent provider for checking actual writes, not markup or copy. */
function fakeAdmin(refunds: Array<Record<string, unknown>> = []) {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    subscriptions: [{ id: "old", user_id: "customer", status: "expired", cancel_at_period_end: true, cancelled_at: "2026-10-06T23:18:29Z" },
      { id: "new", user_id: "customer", status: "active", plan: "base", purchase_kind: "lifetime" }],
    profiles: [{ user_id: "customer", plano: "base" }], refund_requests: refunds, payment_incidents: [],
  };
  let counter = 0;
  const admin = { from(table: string) {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | null = null;
    const q = {
      select: () => q, limit: () => q,
      eq: (key: string, value: unknown) => { filters.push(r => r[key] === value); return q; },
      in: (key: string, values: unknown[]) => { filters.push(r => values.includes(r[key])); return q; },
      update: (value: Record<string, unknown>) => { patch = value; return q; },
      insert: (value: Record<string, unknown>) => { tables[table].push({ id: `incident-${++counter}`, ...value }); return Promise.resolve({ error: null }); },
      then: (resolve: (value: unknown) => unknown) => {
        const rows = tables[table].filter(r => filters.every(f => f(r)));
        if (patch) for (const row of rows) Object.assign(row, patch);
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return q;
  } };
  return { admin, tables };
}

describe("blocked payment integration", () => {
  it("records one incident on replay and preserves the separate lifetime plan", async () => {
    const { admin, tables } = fakeAdmin();
    const sub = { id: "old", user_id: "customer", status: "expired", cancel_at_period_end: true, cancelled_at: "2026-10-06T23:18:29Z" };
    const evidence = { chargeId: "cha_1793970323780_e9u7mccss", amount: 79.80, paidAt: "2026-11-06T13:05:23.392Z" };
    expect(await guardPaidSubscription(admin, sub, evidence)).toBe(true);
    expect(await guardPaidSubscription(admin, sub, evidence)).toBe(true);
    expect(tables.payment_incidents).toHaveLength(1);
    expect(tables.payment_incidents[0].amount).toBe(79.80);
    expect(tables.profiles[0].plano).toBe("base");
    expect(tables.subscriptions[0].status).toBe("expired");
    expect(tables.refund_requests).toHaveLength(0);
  });
  it("marks an already refunded charge resolved without sending a second refund", async () => {
    const { admin, tables } = fakeAdmin([{ id: "refund", subscription_id: "old", status: "processed", keep_access: false, provider_response: { chargeId: "paid" } }]);
    expect(await guardPaidSubscription(admin, { id: "old", user_id: "customer", status: "cancelled" }, { chargeId: "paid", amount: 39.90, paidAt: null })).toBe(true);
    expect(tables.payment_incidents[0].resolved).toBe(true);
    expect(tables.refund_requests).toHaveLength(1);
  });
  it("missing charge ID stays review-only and cannot trigger money movement", async () => {
    const { admin, tables } = fakeAdmin();
    expect(await guardPaidSubscription(admin, { id: "old", user_id: "customer", status: "refunded" }, { chargeId: null, amount: 39.90, paidAt: null })).toBe(true);
    expect(tables.payment_incidents[0].charge_id).toBeNull();
    expect((tables.payment_incidents[0].details as Record<string, unknown>).money_moved).toBe(false);
    expect(tables.refund_requests).toHaveLength(0);
  });
});