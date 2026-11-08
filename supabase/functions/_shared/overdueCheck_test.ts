import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { classifyOverdue, hasPaidRenewal, isAdminCaller, type OverdueSub, runOverdueCheck } from "./overdueCheck.ts";

const NOW = Date.parse("2026-11-01T12:00:00Z");
const day = 24 * 3600_000;
const isPaid = (s?: string | null) => s === "PAID";
const sub = (id: string, gw: string | null, daysAgo = 10): OverdueSub => ({
  id, validapay_subscription_id: gw, validapay_charge_id: "ch_primeira",
  current_period_end: new Date(NOW - daysAgo * day).toISOString(),
});
const charge = (subscriptionId: string, daysAgo: number, status = "PAID", chargeId = `ch_${subscriptionId}_${daysAgo}`) => ({
  chargeId, subscriptionId, status, createdAt: new Date(NOW - daysAgo * day).toISOString(),
});

// Cliente só com leitura: qualquer tentativa de gravar quebra o teste.
function readOnlyAdmin(rows: OverdueSub[], error: { message: string } | null = null) {
  const calls: { offset?: number; limit?: number; filters: Record<string, unknown> } = { filters: {} };
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: (k: string, v: unknown) => { calls.filters[k] = v; return builder; },
    neq: (k: string, v: unknown) => { calls.filters[`neq:${k}`] = v; return builder; },
    lt: () => builder,
    order: () => builder,
    range: (from: number, to: number) => Promise.resolve({
      data: error ? null : rows.slice(from, to + 1), count: error ? null : rows.length, error,
    }),
  };
  return { from: () => builder, calls };
}

const run = (rows: OverdueSub[], gateway: Record<string, { status: string; cancelAtPeriodEnd?: boolean } | null | Error>, charges: ReturnType<typeof charge>[] = [], complete = true, extra = {}, offset = 0, limit = 100) =>
  runOverdueCheck({
    admin: readOnlyAdmin(rows),
    isPaid,
    now: () => NOW,
    scanCharges: () => Promise.resolve({ charges, complete }),
    fetchGatewaySub: (id) => {
      const g = gateway[id];
      return g instanceof Error ? Promise.reject(g) : Promise.resolve(g ?? null);
    },
    ...extra,
  }, offset, limit);

Deno.test("cobrança paga vence até gateway cancelado", () => {
  assertEquals(classifyOverdue({ status: "CANCELLED" }, true, true), "pagou_depois_de_vencer");
});

Deno.test("status do gateway viram classes sem cobrança", () => {
  assertEquals(classifyOverdue({ status: "ACTIVE" }, false, true), "ativa_no_gateway_sem_cobranca");
  assertEquals(classifyOverdue({ status: "ACTIVE", cancelAtPeriodEnd: true }, false, true), "cancelamento_agendado_sem_cobranca");
  assertEquals(classifyOverdue({ status: "PAST_DUE" }, false, true), "em_atraso_no_gateway");
  assertEquals(classifyOverdue({ status: "CANCELED" }, false, true), "cancelada_no_gateway");
  assertEquals(classifyOverdue(null, false, true), "nao_existe_no_gateway");
  assertEquals(classifyOverdue({ status: "DEFAULT" }, false, true), "status_desconhecido");
});

Deno.test("varredura incompleta não afirma falta de pagamento", () => {
  assertEquals(classifyOverdue({ status: "CANCELLED" }, false, false), "sem_prova_varredura_incompleta");
  assertEquals(classifyOverdue(null, false, false), "sem_prova_varredura_incompleta");
});

Deno.test("renovação ignora cobrança antiga, conhecida, não paga ou de outra assinatura", () => {
  const s = sub("a", "gw_a", 10);
  assertEquals(hasPaidRenewal(s, [charge("gw_a", 8)], isPaid), true);
  assertEquals(hasPaidRenewal(s, [charge("gw_a", 13)], isPaid), true); // dentro da tolerância
  assertEquals(hasPaidRenewal(s, [charge("gw_a", 40)], isPaid), false);
  assertEquals(hasPaidRenewal(s, [charge("gw_a", 8, "PAID", "ch_primeira")], isPaid), false);
  assertEquals(hasPaidRenewal(s, [charge("gw_a", 8, "PENDING")], isPaid), false);
  assertEquals(hasPaidRenewal(s, [charge("gw_b", 8)], isPaid), false);
});

Deno.test("resultado agrega contagens sem IDs e sem gravar", async () => {
  const res = await run(
    [sub("a", "gw_a"), sub("b", "gw_b"), sub("c", "gw_c"), sub("d", null), sub("e", "gw_e")],
    { gw_a: { status: "CANCELLED" }, gw_b: { status: "DEFAULT" }, gw_c: null, gw_e: new Error("HTTP 500") },
    [charge("gw_a", 5)],
  );
  assertEquals(res.counts, { pagou_depois_de_vencer: 1, status_desconhecido: 1, nao_existe_no_gateway: 1, sem_id_no_gateway: 1, erro_na_consulta: 1 });
  assertEquals(res.desconhecidos, { DEFAULT: 1 });
  assertEquals(res.next_offset, null);
  const texto = JSON.stringify(res);
  for (const id of ["gw_a", "gw_b", "ch_primeira"]) assertEquals(texto.includes(id), false);
});

Deno.test("paginação continua de onde parou", async () => {
  const rows = [sub("a", "gw"), sub("b", "gw"), sub("c", "gw")];
  const first = await run(rows, { gw: { status: "CANCELLED" } }, [], true, {}, 0, 2);
  assertEquals([first.processados, first.next_offset], [2, 2]);
  const second = await run(rows, { gw: { status: "CANCELLED" } }, [], true, {}, 2, 2);
  assertEquals([second.processados, second.next_offset], [1, null]);
});

Deno.test("prazo estourado devolve o ponto para continuar", async () => {
  let clock = NOW;
  const res = await run([sub("a", "gw"), sub("b", "gw")], { gw: { status: "CANCELLED" } }, [], true, {
    now: () => clock,
    deadlineMs: 1000,
    fetchGatewaySub: () => { clock += 2000; return Promise.resolve({ status: "CANCELLED" }); },
  });
  assertEquals([res.processados, res.next_offset], [1, 1]);
});

Deno.test("falha ao ler assinaturas interrompe", async () => {
  await assertRejects(() => runOverdueCheck({
    admin: readOnlyAdmin([], { message: "falha" }), isPaid,
    scanCharges: () => Promise.resolve({ charges: [], complete: true }),
    fetchGatewaySub: () => Promise.resolve(null),
  }, 0, 10));
});

const authAdmin = (role: unknown, isAdmin: unknown) => ({
  from: (table: string) => {
    const b: Record<string, unknown> = {
      select: () => b, eq: () => b,
      maybeSingle: () => Promise.resolve({ data: table === "user_roles" ? role : { is_admin: isAdmin } }),
    };
    return b;
  },
});

Deno.test("só admin passa", async () => {
  assertEquals(await isAdminCaller(authAdmin({ role: "admin" }, false), "u"), true);
  assertEquals(await isAdminCaller(authAdmin(null, true), "u"), true);
  assertEquals(await isAdminCaller(authAdmin(null, false), "u"), false);
  assertEquals(await isAdminCaller(authAdmin(null, null), "u"), false);
});
