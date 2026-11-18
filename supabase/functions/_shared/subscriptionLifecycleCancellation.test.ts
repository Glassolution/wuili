import { describe, it, expect, vi } from "vitest";
const request = vi.hoisted(() => vi.fn());
vi.mock("./providerCancellation.ts", () => ({ requestProviderCancellation: request }));
import { cancelBeforeAccountDeletion } from "./subscriptionLifecycleAccountDeletion";

function adminFor(rows: Array<Record<string, unknown>>) {
  const writes: unknown[] = [];
  const builder = {
    select: () => builder, eq: () => builder,
    not: async () => ({ data: rows, error: null }),
    update: (value: unknown) => { writes.push(value); return builder; },
    then: (resolve: (value: unknown) => unknown) => resolve({ error: null }),
  };
  return { admin: { from: () => builder, rpc: vi.fn() }, writes };
}
describe("account deletion cancellation", () => {
  it("enqueues each recurring contract and prevents deletion while one is unconfirmed", async () => {
    request.mockReset().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const rows = [{ id: "one", user_id: "customer", validapay_subscription_id: "sub_one" },
      { id: "two", user_id: "customer", validapay_subscription_id: "sub_two" }];
    const { admin, writes } = adminFor(rows);
    expect(await cancelBeforeAccountDeletion(admin, "customer")).toBe(false);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls.map(call => call[1].id)).toEqual(["one", "two"]);
    expect(writes).toHaveLength(2);
  });
  it("allows deletion only after provider confirmation", async () => {
    request.mockReset().mockResolvedValue(true);
    const { admin } = adminFor([{ id: "one", user_id: "customer", validapay_subscription_id: "sub_one" }]);
    expect(await cancelBeforeAccountDeletion(admin, "customer")).toBe(true);
    expect(request).toHaveBeenCalledOnce();
  });
  it("does not request cancellation for lifetime or sandbox purchases", async () => {
    request.mockReset();
    const { admin, writes } = adminFor([{ id: "lifetime", purchase_kind: "lifetime" }, { id: "test", provider: "sandbox" }]);
    expect(await cancelBeforeAccountDeletion(admin, "customer")).toBe(true);
    expect(request).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});