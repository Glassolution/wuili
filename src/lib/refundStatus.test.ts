import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, from } = vi.hoisted(() => ({ invoke: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke }, from } }));
import { fetchRefundStatus } from "./refundStatus";

describe("server-confirmed admin refund shortcut", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    from.mockImplementation((table: string) => {
      const query = {
        select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: table === "subscriptions" ? [{
          id: "paid", created_at: "2026-01-01T00:00:00Z", provider: "validapay",
        }] : [], error: null }),
      };
      return query;
    });
  });
  it("shows the exception only on explicit authenticated server approval", async () => {
    invoke.mockResolvedValue({ data: { facts: { windowException: true } }, error: null });
    const result = await fetchRefundStatus("admin-id", false, true);
    expect(result.windowException).toBe(true);
    expect(result.mode).toBe("reembolso");
    expect(invoke).toHaveBeenCalledWith("refund-assistant", { body: { action: "start", sandbox: false } });
  });
  it("hides the shortcut for another admin", async () => {
    invoke.mockResolvedValue({ data: { facts: { windowException: false } }, error: null });
    expect((await fetchRefundStatus("other-admin", false, true)).windowException).toBe(false);
  });
  it("does not accept approval accompanying a server error", async () => {
    invoke.mockResolvedValue({ data: { facts: { windowException: true } }, error: new Error("failed") });
    expect((await fetchRefundStatus("admin-id", false, true)).windowException).toBe(false);
  });
  it("does not query the exception for ordinary accounts", async () => {
    expect((await fetchRefundStatus("regular-user")).windowException).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });
});