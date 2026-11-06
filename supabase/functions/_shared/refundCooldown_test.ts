import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { clearRefundCooldownAfterRepurchase, isPaidRepurchase } from "./refundCooldown.ts";

const refundedAt = "2026-11-05T15:00:00Z";
const repurchase = {
  id: "new-base", status: "active", created_at: "2026-11-05T18:00:00Z",
  amount: 89.90, plan: "base", provider: "validapay", validapay_charge_id: "paid-charge",
};

Deno.test("Base vitalício pago depois do reembolso libera cooldown", () => {
  assertEquals(isPaidRepurchase(repurchase, refundedAt), true);
});
Deno.test("assinatura anterior ou criada na mesma hora do reembolso não libera", () => {
  assertEquals(isPaidRepurchase({ ...repurchase, created_at: "2026-11-05T14:00:00Z" }, refundedAt), false);
  assertEquals(isPaidRepurchase({ ...repurchase, created_at: refundedAt }, refundedAt), false);
});
Deno.test("pagamento pendente ou reembolsado não libera", () => {
  for (const status of ["pending", "trialing", "cancelled", "refunded"]) {
    assertEquals(isPaidRepurchase({ ...repurchase, status }, refundedAt), false);
  }
});
Deno.test("gratuito, teste ou sem comprovante não libera", () => {
  assertEquals(isPaidRepurchase({ ...repurchase, amount: 0 }, refundedAt), false);
  assertEquals(isPaidRepurchase({ ...repurchase, is_trial: true }, refundedAt), false);
  assertEquals(isPaidRepurchase({ ...repurchase, validapay_charge_id: null }, refundedAt), false);
  assertEquals(isPaidRepurchase({ ...repurchase, provider: "sandbox" }, refundedAt), false);
});

function fakeAdmin(options: { cooldown?: string | null; refund?: string | null; fail?: string; concurrentRefund?: boolean } = {}) {
  let cooldown = options.cooldown === undefined ? "2026-12-05T15:00:00Z" : options.cooldown;
  const updates: Record<string, unknown>[] = [];
  return {
    updates,
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> | null = null;
      // deno-lint-ignore no-explicit-any -- minimal fluent SDK fake for regression tests.
      const query: any = {};
      for (const method of ["select", "in", "not", "order", "limit", "gt"]) query[method] = () => query;
      query.eq = (key: string, value: unknown) => { filters[key] = value; return query; };
      query.update = (value: Record<string, unknown>) => { patch = value; return query; };
      const result = () => {
        if (options.fail === table) return { data: null, error: { message: "read failed" } };
        if (patch) {
          if (options.concurrentRefund) return { data: [], error: null };
          assertEquals(filters.refund_cooldown_until, cooldown);
          updates.push(patch);
          cooldown = null;
          return { data: [{ user_id: "buyer" }], error: null };
        }
        return { data: table === "profiles" ? { refund_cooldown_until: cooldown }
          : table === "refund_requests" ? (options.refund === null ? null : { processed_at: options.refund ?? refundedAt })
          : [repurchase], error: null };
      };
      query.maybeSingle = () => Promise.resolve(result());
      query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      return query;
    },
  };
}
Deno.test("webhook/publicação limpam apenas cooldown e repetição não altera nada", async () => {
  const admin = fakeAdmin();
  assertEquals(await clearRefundCooldownAfterRepurchase(admin, "buyer"), true);
  assertEquals(admin.updates, [{ refund_cooldown_until: null }]);
  assertEquals(await clearRefundCooldownAfterRepurchase(admin, "buyer"), false);
});
Deno.test("sem reembolso concluído não libera", async () => {
  const admin = fakeAdmin({ refund: null });
  assertEquals(await clearRefundCooldownAfterRepurchase(admin, "buyer"), false);
  assertEquals(admin.updates, []);
});
Deno.test("falha de leitura mantém bloqueio", async () => {
  const admin = fakeAdmin({ fail: "subscriptions" });
  await assertRejects(() => clearRefundCooldownAfterRepurchase(admin, "buyer"));
  assertEquals(admin.updates, []);
});
Deno.test("novo reembolso simultâneo não perde o cooldown", async () => {
  const admin = fakeAdmin({ concurrentRefund: true });
  assertEquals(await clearRefundCooldownAfterRepurchase(admin, "buyer"), false);
  assertEquals(admin.updates, []);
});