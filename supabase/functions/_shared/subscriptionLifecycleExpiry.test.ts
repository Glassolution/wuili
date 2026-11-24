import { describe, expect, it, vi } from "vitest";

const now = Date.parse("2026-11-23T21:25:00Z");
const sub = { id: "internal-sub", user_id: "internal-user", plan: "base", status: "active", provider: "validapay", purchase_kind: "recurring", current_period_end: "2026-10-01T00:00:00Z", updated_at: "2026-09-01T00:00:00Z", validapay_subscription_id: "sub_test" };

function client(rows = [sub], concurrent = false) {
  rows = rows.map(row => ({ ...row }));
  const operations: Array<{ table: string; operation: string; values: Record<string, unknown> }> = [];
  return { operations, from(table: string) {
    let operation = "read";
    let values: Record<string, unknown> = {};
    let account = false;
    let statuses: string[] | undefined;
    const response = () => {
      if (operation === "update" && table === "subscriptions" && !concurrent) Object.assign(rows[0], values);
      return {
        data: operation === "read" ? (table === "profiles" ? [{ user_id: sub.user_id, email: "test@example.com" }]
          : table === "refund_requests" ? [] : rows.filter(row => !statuses || statuses.includes(row.status)))
          : (concurrent ? null : { id: sub.id }),
        error: null,
      };
    };
    const builder = {
      select: () => builder,
      eq: () => builder, neq: () => builder, lt: () => builder, order: () => builder, is: () => builder,
      in: (column: string, list: string[]) => { account = true; if (column === "status") statuses = list; return builder; },
      limit: () => builder,
      range: async (start: number) => ({ data: start ? [] : (account ? rows : rows.filter(r => r.status === "active" && r.purchase_kind !== "lifetime")), error: null }),
      upsert: (v: Record<string, unknown>) => { operation = "backup"; values = v; operations.push({ table, operation, values }); return builder; },
      update: (v: Record<string, unknown>) => { operation = "update"; values = v; operations.push({ table, operation, values }); return builder; },
      maybeSingle: async () => response(),
      then: (resolve: (value: ReturnType<typeof response>) => unknown) => Promise.resolve(response()).then(resolve),
    };
    return builder;
  } };
}

async function audit() {
  vi.stubGlobal("Deno", { env: { get: () => undefined } });
  return (await import("./subscriptionExpiryAudit")).auditExpiredProviderSubscriptions;
}

describe("execução horária limitada e reversível", () => {
  it.each([["EXPIRED", "expired"], ["DEFAULT", "past_due"]])("%s guarda backup antes de alterar para %s", async (provider, target) => {
    const db = client();
    const result = await (await audit())(db, now, { charges: async () => [], provider: async () => ({ status: provider }) });
    expect(db.operations.map(o => o.table)).toEqual(["subscription_status_correction_backup", "subscriptions", "profiles", "subscription_status_correction_backup"]);
    expect(db.operations[0].values).toMatchObject({ status: "active", current_period_end: sub.current_period_end, atualizado_em: sub.updated_at });
    expect(db.operations[1].values).toEqual({ status: target, updated_at: new Date(now).toISOString() });
    expect(db.operations[2].values).toEqual({ plano: "gratis" });
    expect(target === "expired" ? result.expired : result.past_due).toBe(1);
  });
  it("pagamento recente em outro contrato não grava nada", async () => {
    const db = client();
    const result = await (await audit())(db, now, { charges: async () => [{ status: "PAID", paidAt: "2026-11-22T00:00:00Z", customer: { email: "test@example.com" } }], provider: async () => ({ status: "DEFAULT" }) });
    expect(result.protected).toBe(1);
    expect(db.operations).toHaveLength(0);
  });
  it("outro vitalício da conta não grava nada", async () => {
    const db = client([sub, { ...sub, id: "lifetime-sub", purchase_kind: "lifetime" }]);
    const result = await (await audit())(db, now, { charges: async () => [], provider: async () => ({ status: "EXPIRED" }) });
    expect(result.protected).toBe(1);
    expect(db.operations).toHaveLength(0);
  });
  it("listagem de cobranças incompleta interrompe antes de qualquer gravação", async () => {
    const db = client();
    await expect((await audit())(db, now, { charges: async () => { throw new Error("incomplete"); }, provider: async () => ({ status: "EXPIRED" }) })).rejects.toThrow("incomplete");
    expect(db.operations).toHaveLength(0);
  });
  it("erro de consulta do contrato não revoga nem para os outros", async () => {
    const db = client();
    const result = await (await audit())(db, now, { charges: async () => [], provider: async () => { throw new Error("provider_timeout"); } });
    expect(result.unconfirmed).toBe(1);
    expect(db.operations).toHaveLength(0);
  });
  it("mudança concorrente não é registrada como correção aplicada", async () => {
    const db = client([sub], true);
    const result = await (await audit())(db, now, { charges: async () => [], provider: async () => ({ status: "EXPIRED" }) });
    expect(result.conflicts).toBe(1);
    expect(result.expired).toBe(0);
    expect(db.operations).toHaveLength(2);
    expect(db.operations.some(o => o.table === "profiles")).toBe(false);
  });
});