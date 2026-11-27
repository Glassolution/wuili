import { beforeEach, describe, expect, it, vi } from "vitest";
const cancel = vi.hoisted(() => vi.fn());
const sync = vi.hoisted(() => vi.fn());
const notice = vi.hoisted(() => vi.fn());
vi.mock("./utmify.ts", () => ({ scheduleUtmifyTask: notice, sendUtmifyConfirmedRefund: vi.fn() }));
vi.mock("./providerCancellation.ts", () => ({ requestProviderCancellation: cancel }));
vi.mock("./subscriptionLifecycle.ts", () => ({ syncPaidProfile: sync }));
import { finalizeConfirmedRefund } from "./confirmedRefundLifecycle";

const oldId = "3332ceeb-45cd-4788-92bf-d71cddefd1ff";
const newId = "3baf1da1-b4a3-4799-9212-b9850a832924";
const userId = "41913c41-7566-4a8a-a957-ed283fbe3fef";
const chargeId = "cha_1794575123466_v3t342oi8";
function fixture(status = "refunded") {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    subscriptions: [{ id: oldId, user_id: userId, status }, { id: newId, user_id: userId, status: "active", amount: 39.90 }],
    payment_incidents: [{ id: "bf8e903a-670a-4d11-85e7-fd6a75d8fee8", kind: "post_cancel_renewal", charge_id: chargeId,
      subscription_id: oldId, user_id: userId, amount: 39.90, resolved: false }],
  };
  const admin = { rpc: vi.fn(), from(table: string) {
    const filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | null = null;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push(r => r[key] === value); return query; },
      update: (value: Record<string, unknown>) => { patch = value; return query; },
      maybeSingle: async () => ({ data: tables[table].find(r => filters.every(f => f(r))), error: null }),
      then: (resolve: (value: unknown) => unknown) => {
        const rows = tables[table].filter(r => filters.every(f => f(r)));
        if (patch) rows.forEach(r => Object.assign(r, patch));
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      },
    };
    return query;
  } };
  return { admin, tables };
}
const refund = { subscription_id: oldId, user_id: userId, charge_id: chargeId, keep_access: true };
beforeEach(() => { vi.clearAllMocks(); cancel.mockResolvedValue(true); });
describe("confirmed refund contract isolation", () => {
  it("resolves the exact R$39.90 incident only after confirmed cancellation and leaves card B unchanged", async () => {
    const { admin, tables } = fixture();
    const cardB = { ...tables.subscriptions[1] };
    expect(await finalizeConfirmedRefund(admin, refund)).toBe(true);
    expect(cancel.mock.calls[0][1].id).toBe(oldId);
    expect(tables.payment_incidents[0].resolved).toBe(true);
    expect(tables.payment_incidents[0].amount).toBe(39.90);
    expect(tables.subscriptions[1]).toEqual(cardB);
    expect(sync).not.toHaveBeenCalled();
    expect(notice).not.toHaveBeenCalled();
  });
  it("does not resolve the incident when ValidaPay has not confirmed cancellation", async () => {
    const { admin, tables } = fixture();
    cancel.mockResolvedValue(false);
    expect(await finalizeConfirmedRefund(admin, refund)).toBe(false);
    expect(tables.payment_incidents[0].resolved).toBe(false);
  });
  it("does not cancel a valid contract for a keep-access refund", async () => {
    const { admin, tables } = fixture("active");
    expect(await finalizeConfirmedRefund(admin, refund)).toBe(false);
    expect(cancel).not.toHaveBeenCalled();
    expect(tables.subscriptions[0].status).toBe("active");
  });
  it("queues provider cancellation for a terminating refund on this contract only", async () => {
    const { admin, tables } = fixture("active");
    await finalizeConfirmedRefund(admin, { ...refund, keep_access: false });
    expect(tables.subscriptions[0].status).toBe("refunded");
    expect(tables.subscriptions[0].cancel_at_period_end).toBe(true);
    expect(tables.subscriptions[1].status).toBe("active");
    expect(cancel).toHaveBeenCalledOnce();
    expect(sync).toHaveBeenCalledWith(admin, userId);
    expect(notice).toHaveBeenCalledOnce();
  });
});