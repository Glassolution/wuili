import { beforeEach, describe, expect, it, vi } from "vitest";
declare global {
  // Edge modules use Deno secrets; this test runs them with a mocked runtime in Vitest.
  const Deno: { env: { get(name: string): string | undefined } };
}
const provider = vi.hoisted(() => ({ fetch: vi.fn(), charge: vi.fn() }));
vi.mock("../../supabase/functions/_shared/validapay.ts", () => ({
  validaPayFetch: provider.fetch, getCharge: provider.charge, isPaidStatus: (s: string) => s === "PAID",
}));
vi.stubGlobal("Deno", { env: { get: () => "price_pro" } });
import { confirmUpgrade, finishUpgrade } from "../../supabase/functions/_shared/planUpgrade";

const date = "2026-12-11T23:22:00.000Z";
function fixture(state = "awaiting_payment") {
  const row = { id: "upgrade-1", user_id: "u", subscription_id: "s", provider_subscription_id: "sub_1", from_plan: "base", to_plan: "pro",
    amount: 39.9, recurring_amount: 79.8, period_start: "2026-11-11T23:22:00.000Z", period_end: date,
    next_charge_date: date, provider_item_id: "item_base", target_price_id: "price_pro", difference_price_id: "price_diff",
    charge_id: "cha_diff", state, expires_at: "2099-01-01T00:00:00Z", provider_response: null };
  const sub = { status: "active", plan: "base", current_period_start: row.period_start, current_period_end: date, cancelled_at: null, cancel_at_period_end: false };
  const rpc = vi.fn(async () => { row.state = "completed"; return { error: null }; });
  const admin = { rpc, from: (table: string) => {
    let patch: Record<string, unknown> | undefined;
    const filters: ((r: typeof row) => boolean)[] = [];
    const value = () => {
      const match = filters.every(f => f(row));
      if (patch && match) Object.assign(row, patch);
      return { data: table === "refund_requests" ? [] : table === "subscriptions" ? sub : match ? { ...row } : null, error: null };
    };
    const q = {
      select: () => q, update: (p: Record<string, unknown>) => { patch = p; return q; },
      eq: (key: string, val: unknown) => { if (key === "state") filters.push(r => r.state === val); return q; },
      neq: (key: string, val: unknown) => { if (key === "state") filters.push(r => r.state !== val); return q; },
      in: (key: string, values: string[]) => { if (key === "state") filters.push(r => values.includes(r.state)); return q; },
      limit: () => q, single: async () => value(), maybeSingle: async () => value(),
      then: (resolve: (v: ReturnType<typeof value>) => unknown) => Promise.resolve(value()).then(resolve),
    }; return q;
  } };
  const contract = { subscriptionId: "sub_1", status: "ACTIVE", cancelAtPeriodEnd: false, nextCycleChargeDate: date,
    nextCycleAmount: 79.8, items: [{ type: "RECURRING", status: "ACTIVE", itemId: "item_base", priceId: "price_base", quantity: 1 }] };
  provider.fetch.mockImplementation(async (_path: string, init?: { method?: string }) => {
    if (init?.method === "PUT") { contract.items[0].priceId = "price_pro"; return { amounts: { chargeTotal: 0 } }; }
    return contract;
  });
  provider.charge.mockResolvedValue({ status: "PAID", amount: 39.9 });
  return { row, sub, admin, contract, rpc };
}
beforeEach(() => vi.clearAllMocks());
describe("saga de upgrade", () => {
  it("só substitui o item pago, sem pró-rata e preservando datas", async () => {
    const f = fixture(); await finishUpgrade(f.admin, f.row);
    expect(provider.fetch).toHaveBeenCalledWith("/v1/subscriptions/sub_1/items/item_base", expect.objectContaining({
      method: "PUT", retryUnauthorized: false, body: JSON.stringify({ priceId: "price_pro", quantity: 1, prorata: { enabled: false }, dryRun: false }),
    }));
    expect(f.rpc).toHaveBeenCalledTimes(1);
    expect(f.sub.current_period_end).toBe(date);
    expect(f.sub.current_period_start).toBe("2026-11-11T23:22:00.000Z");
  });
  it("Pix pendente nunca libera plano", async () => {
    const f = fixture(); provider.charge.mockResolvedValue({ status: "PENDING", amount: 39.9 });
    await finishUpgrade(f.admin, f.row); expect(f.rpc).not.toHaveBeenCalled(); expect(provider.fetch).not.toHaveBeenCalled();
  });
  it("repetição de confirmação não cobra a diferença novamente", async () => {
    const f = fixture(); await confirmUpgrade(f.admin, "u", f.row.id, 39.9); await confirmUpgrade(f.admin, "u", f.row.id, 39.9);
    expect(provider.fetch.mock.calls.filter(([,init]) => init?.method === "POST")).toHaveLength(0);
    expect(provider.fetch.mock.calls.filter(([,init]) => init?.method === "PUT")).toHaveLength(1);
  });
  it("substituição incerta nunca é reenviada", async () => {
    const f = fixture("replacing"); await finishUpgrade(f.admin, f.row);
    expect(provider.fetch.mock.calls.filter(([,init]) => init?.method === "PUT")).toHaveLength(0); expect(f.rpc).not.toHaveBeenCalled();
  });
  it("renovação remarcada exige revisão sem substituir", async () => {
    const f = fixture(); f.contract.nextCycleChargeDate = "2026-12-14T23:22:00Z";
    await expect(finishUpgrade(f.admin, f.row)).rejects.toThrow(); expect(f.row.state).toBe("review"); expect(f.rpc).not.toHaveBeenCalled();
  });
});