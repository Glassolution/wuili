import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { matchLifetimeChargeByTime, recoverLifetimePurchases } from "./lifetimeCharge.ts";

const NOW = Date.now();
const at = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();
const checkout = (id: string, user_id: string, minAgo: number, extra = {}) => ({
  id, user_id, plan: "base", amount: 89.9, status: "expired", created_at: at(minAgo), validapay_charge_id: null, ...extra,
});
const charge = (chargeId: string, minAgo: number, email = "outro@x.com") => ({
  chargeId, createdAt: at(minAgo), status: "PAID", saleType: "ONE_TIME", amount: 89.9, paymentType: "PIX", customer: { email },
});

type Opts = { rows: ReturnType<typeof checkout>[]; accountEmails?: string[]; failRead?: "subs" | "all" | "used"; rpcError?: boolean; updateError?: string };

// Cliente admin mínimo: só o que a recuperação usa, gravando os updates feitos.
function fakeAdmin({ rows, accountEmails = [], failRead, rpcError, updateError }: Opts) {
  const updates: { id: string; values: Record<string, unknown> }[] = [];
  const profiles: Record<string, unknown>[] = [];
  const emails: Record<string, string> = { A: "a@x.com", B: "b@x.com" };
  const fail = { message: "falha simulada" };
  return {
    updates, profiles,
    auth: { admin: { getUserById: (id: string) => Promise.resolve({ data: { user: { email: emails[id] } } }) } },
    rpc: (_name: string, args: { p_email: string }) => Promise.resolve(rpcError
      ? { data: null, error: fail }
      : { data: accountEmails.includes(args.p_email), error: null }),
    from(table: string) {
      // deno-lint-ignore no-explicit-any -- builder encadeável falso do supabase
      const s: any = { columns: "", filters: {} as Record<string, unknown>, pending: null };
      for (const m of ["gte", "order", "not"]) s[m] = () => s;
      s.select = (c?: string) => { if (c) s.columns = c; return s; };
      s.eq = (k: string, v: unknown) => { s.filters[k] = v; return s; };
      s.in = (k: string, v: unknown) => { s.filters[`in:${k}`] = v; return s; };
      s.maybeSingle = () => Promise.resolve({ data: { email: emails[s.filters.user_id as string] } });
      s.update = (values: Record<string, unknown>) => { s.pending = values; return s; };
      s.then = (resolve: (r: unknown) => void) => {
        if (table === "profiles") { profiles.push(s.pending); return resolve({ data: null, error: null }); }
        if (s.pending) {
          if (updateError && s.pending.status === "active") return resolve({ data: null, error: { code: updateError, message: "viola índice" } });
          updates.push({ id: s.filters.id as string, values: s.pending });
          return resolve({ data: [{ id: s.filters.id }], error: null });
        }
        if (s.columns === "validapay_charge_id") {
          if (failRead === "used") return resolve({ data: null, error: fail });
          const ids = s.filters["in:validapay_charge_id"] as string[];
          return resolve({ data: rows.filter((r) => r.validapay_charge_id && ids.includes(r.validapay_charge_id)), error: null });
        }
        if (s.filters["in:status"]) {
          if (failRead === "subs") return resolve({ data: null, error: fail });
          return resolve({ data: rows.filter((r) => !r.validapay_charge_id), error: null });
        }
        if (failRead === "all") return resolve({ data: null, error: fail });
        resolve({ data: rows, error: null });
      };
      return s;
    },
  };
}

const activatedIds = (admin: ReturnType<typeof fakeAdmin>) =>
  admin.updates.filter((u) => u.values.status === "active").map((u) => u.id);

Deno.test("comprador com outro email e sem conta recebe o plano", async () => {
  const admin = fakeAdmin({ rows: [checkout("a1", "A", 10)] });
  const res = await recoverLifetimePurchases(admin, undefined, () => Promise.resolve([charge("C1", 5)]));
  assertEquals(res.map((r) => r.id), ["a1"]);
  assertEquals(admin.updates.find((u) => u.values.lifetime_match_source)?.values.lifetime_match_source, "time");
});

Deno.test("match por email registra a origem email", async () => {
  const admin = fakeAdmin({ rows: [checkout("a1", "A", 10)] });
  await recoverLifetimePurchases(admin, undefined, () => Promise.resolve([charge("C1", 5, "a@x.com")]));
  assertEquals(admin.updates.find((u) => u.values.lifetime_match_source)?.values.lifetime_match_source, "email");
});

Deno.test("checkout abandonado não leva a cobrança de quem pagou com o email da conta", async () => {
  const admin = fakeAdmin({
    rows: [checkout("b1", "B", 5), checkout("a1", "A", 40)],
    accountEmails: ["a@x.com"],
  });
  await recoverLifetimePurchases(admin, undefined, () => Promise.resolve([charge("C1", 1, "a@x.com")]));
  assertEquals(activatedIds(admin), ["a1"]);
});

Deno.test("checkout antigo de outra conta bloqueia o fallback por horário", () => {
  const b = checkout("b1", "B", 5);
  const a = checkout("a1", "A", 24 * 60);
  assertEquals(matchLifetimeChargeByTime(b, [a, b], [charge("C1", 1)], new Set()), null);
});

Deno.test("checkout de outra conta já pago não bloqueia o fallback", () => {
  const b = checkout("b1", "B", 5);
  const a = checkout("a1", "A", 24 * 60, { validapay_charge_id: "C0" });
  assertEquals(matchLifetimeChargeByTime(b, [a, b], [charge("C1", 1)], new Set())?.chargeId, "C1");
});

Deno.test("clique duplo da mesma conta não bloqueia o fallback", async () => {
  const admin = fakeAdmin({ rows: [checkout("a2", "A", 8), checkout("a1", "A", 10)] });
  const res = await recoverLifetimePurchases(admin, undefined, () => Promise.resolve([charge("C1", 5)]));
  assertEquals(res.length, 1);
});

Deno.test("cobrança sem email não passa no fallback", () => {
  const a = checkout("a1", "A", 10);
  assertEquals(matchLifetimeChargeByTime(a, [a], [charge("C1", 5, "")], new Set()), null);
});

Deno.test("email da cobrança com conta na Velo é recusado", async () => {
  const admin = fakeAdmin({ rows: [checkout("a1", "A", 10)], accountEmails: ["outro@x.com"] });
  assertEquals(await recoverLifetimePurchases(admin, undefined, () => Promise.resolve([charge("C1", 5)])), []);
});

Deno.test("falha ao checar o email não ativa nada", async () => {
  const admin = fakeAdmin({ rows: [checkout("a1", "A", 10)], rpcError: true });
  assertEquals(await recoverLifetimePurchases(admin, undefined, () => Promise.resolve([charge("C1", 5)])), []);
});

for (const failRead of ["subs", "all", "used"] as const) {
  Deno.test(`falha na leitura "${failRead}" para a recuperação sem ativar nada`, async () => {
    const admin = fakeAdmin({ rows: [checkout("a1", "A", 10)], failRead });
    await assertRejects(() => recoverLifetimePurchases(admin, undefined, () => Promise.resolve([charge("C1", 5)])));
    assertEquals(admin.updates, []);
  });
}

Deno.test("índice único: cobrança já vinculada não ativa nem muda o perfil", async () => {
  const admin = fakeAdmin({ rows: [checkout("a1", "A", 10)], updateError: "23505" });
  assertEquals(await recoverLifetimePurchases(admin, undefined, () => Promise.resolve([charge("C1", 5, "a@x.com")])), []);
  assertEquals(admin.profiles, []);
});
