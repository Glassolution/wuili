// Rodar: deno test supabase/functions/_shared/refundEligibility.test.ts
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  consomeDireitoDeReembolso,
  ehEstornoNaoSolicitado,
  estaPendente,
  pedidosQueContam,
  reembolsosBloqueantes,
  type RefundRequestRow,
} from "./refundEligibility.ts";

/** Estorno automático de cobrança duplicada, como o paymentGuard grava. */
const duplicado = (over: Partial<RefundRequestRow> = {}): RefundRequestRow => ({
  id: "dup-1",
  status: "processed",
  refund_kind: "duplicate",
  keep_access: true,
  ...over,
});

/** Pedido feito pelo cliente na tela de cancelamento. */
const doCliente = (over: Partial<RefundRequestRow> = {}): RefundRequestRow => ({
  id: "req-1",
  status: "processed",
  refund_kind: "standard",
  keep_access: false,
  ...over,
});

/** Reembolso direto lançado pelo suporte — é reembolso de verdade. */
const doSuporte = (over: Partial<RefundRequestRow> = {}): RefundRequestRow => ({
  id: "adm-1",
  status: "processed",
  refund_kind: "admin_direct",
  keep_access: false,
  ...over,
});

Deno.test("estorno de duplicidade NÃO consome o direito a reembolso", () => {
  assertEquals(ehEstornoNaoSolicitado(duplicado()), true);
  assertEquals(consomeDireitoDeReembolso(duplicado()), false);
  assertEquals(reembolsosBloqueantes([duplicado()]).length, 0);
});

Deno.test("duplicidade ainda pendente também não bloqueia", () => {
  // O estorno automático falhou e ficou pending: continua não sendo um pedido
  // do cliente, então não pode virar "você já tem uma solicitação em análise".
  assertEquals(reembolsosBloqueantes([duplicado({ status: "pending" })]).length, 0);
});

Deno.test("reembolso pedido pelo cliente consome o direito", () => {
  assertEquals(consomeDireitoDeReembolso(doCliente()), true);
  assertEquals(reembolsosBloqueantes([doCliente()]).length, 1);
});

Deno.test("reembolso direto do suporte consome o direito", () => {
  // Grava automated: true igual à duplicidade — por isso `automated` não serve
  // como discriminador. Aqui o dinheiro voltou de verdade e o acesso caiu.
  assertEquals(ehEstornoNaoSolicitado(doSuporte()), false);
  assertEquals(consomeDireitoDeReembolso(doSuporte()), true);
});

Deno.test("pedido recusado libera nova solicitação", () => {
  for (const status of ["rejected", "denied", "cancelled", "canceled", "REJECTED"]) {
    assertEquals(consomeDireitoDeReembolso(doCliente({ status })), false, status);
  }
});

Deno.test("pedido em análise bloqueia", () => {
  const bloqueantes = reembolsosBloqueantes([doCliente({ status: "pending" })]);
  assertEquals(bloqueantes.length, 1);
  assertEquals(bloqueantes.some(estaPendente), true);
});

Deno.test("o caso do relato: duplicidade estornada não impede reembolso depois", () => {
  // Cliente foi cobrado em dobro, a Velo devolveu sozinha, ele nunca pediu nada.
  // Semanas depois quer o reembolso de verdade a que tem direito.
  const historico = [duplicado()];
  assertEquals(reembolsosBloqueantes(historico).length, 0);
  assertEquals(pedidosQueContam(historico).length, 0);
});

Deno.test("duplicidade + pedido real: o pedido real é que bloqueia", () => {
  const historico = [duplicado(), doCliente({ id: "req-2", status: "pending" })];
  const bloqueantes = reembolsosBloqueantes(historico);
  assertEquals(bloqueantes.length, 1);
  assertEquals(bloqueantes[0].id, "req-2");
});

Deno.test("keep_access sozinho já isenta, mesmo sem refund_kind", () => {
  assertEquals(consomeDireitoDeReembolso({ id: "x", status: "processed", keep_access: true }), false);
});

Deno.test("linha sem os campos novos é tratada como pedido do cliente", () => {
  // Registros antigos, anteriores à migration que criou refund_kind/keep_access.
  assertEquals(consomeDireitoDeReembolso({ id: "legado", status: "processed" }), true);
});
