import { beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => vi.fn());
const cancel = vi.hoisted(() => vi.fn());
const notice = vi.hoisted(() => vi.fn());
vi.mock("../../supabase/functions/_shared/validapay.ts", () => ({
  getCharge: vi.fn().mockResolvedValue({ chargeId: "test-charge", amount: 39.90, status: "PAID" }),
  validaPayFetch: provider,
}));
vi.mock("../../supabase/functions/_shared/providerCancellation.ts", () => ({ requestProviderCancellation: cancel }));
vi.mock("../../supabase/functions/_shared/subscriptionLifecycle.ts", () => ({ syncPaidProfile: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../../supabase/functions/_shared/utmify.ts", () => ({ scheduleUtmifyTask: notice, sendUtmifyConfirmedRefund: vi.fn() }));
import { adminCourtesyRefund } from "../../supabase/functions/_shared/adminCourtesyRefund";

function fixture() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    subscriptions: [{ id: "test-sub", user_id: "test-user", validapay_charge_id: "test-charge", validapay_subscription_id: "test-contract", provider: "validapay", purchase_kind: "monthly", amount: 39.90, status: "active" }],
    validapay_webhook_events: [{ id: "test-webhook", charge_id: "test-charge", subscription_id: "test-contract" }], refund_requests: [], post_cancel_refund_operations: [],
  };
  const admin = { rpc: vi.fn(), from(table: string) {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | undefined;
    const query = {
      select: () => query, limit: () => query,
      eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query; },
      in: (key: string, value: unknown[]) => { filters.push(row => value.includes(row[key])); return query; },
      insert: (row: Record<string, unknown>) => { tables[table].push({ id: `test-${table}`, ...row }); return query; },
      update: (value: Record<string, unknown>) => { patch = value; return query; },
      maybeSingle: async () => ({ data: tables[table].find(row => filters.every(f => f(row))), error: null }),
      single: async () => ({ data: tables[table].find(row => filters.every(f => f(row))), error: null }),
      then: (resolve: (value: unknown) => unknown) => {
        const data = tables[table].filter(row => filters.every(f => f(row)));
        if (patch) data.forEach(row => Object.assign(row, patch));
        return Promise.resolve({ data, error: null }).then(resolve);
      },
    };
    return query;
  } };
  const transaction = { subscription_id: "test-sub", user_id: "test-user", charge_id: "test-charge", amount: 39.90, reason: "Simulação local" };
  return { admin, tables, body: { ...transaction, confirmation: transaction, dry_run: false } };
}
beforeEach(() => { vi.clearAllMocks(); cancel.mockResolvedValue(true); });
describe("Utmify observes only confirmed courtesy refunds", () => {
  it("PROCESSING changes existing local state but does not notify Utmify", async () => {
    const f = fixture(); provider.mockResolvedValue({ status: "PROCESSING" });
    const result = await adminCourtesyRefund(f.admin, f.body);
    expect(result.success).toBe(true);
    expect(f.tables.subscriptions[0].status).toBe("refunded");
    expect(notice).not.toHaveBeenCalled();
  });
  it("confirmed refund schedules once after existing work, without changing result", async () => {
    const f = fixture(); provider.mockResolvedValue({ status: "CONFIRMED" });
    const result = await adminCourtesyRefund(f.admin, f.body);
    expect(result.success).toBe(true);
    expect(result.provider_cancelled).toBe(true);
    expect(notice).toHaveBeenCalledOnce();
  });
  it("unconfirmed cancellation preserves existing failure and still observes confirmed refund", async () => {
    const f = fixture(); provider.mockResolvedValue({ status: "CONFIRMED" }); cancel.mockResolvedValue(false);
    const result = await adminCourtesyRefund(f.admin, f.body);
    expect(result.success).toBe(false);
    expect(result.requires_manual_review).toBe(true);
    expect(notice).toHaveBeenCalledOnce();
  });
  it("dry run neither requests a refund nor schedules a notice", async () => {
    const f = fixture();
    await adminCourtesyRefund(f.admin, { ...f.body, dry_run: true });
    expect(provider).not.toHaveBeenCalled();
    expect(notice).not.toHaveBeenCalled();
  });
});