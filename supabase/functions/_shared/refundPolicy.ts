// Regra e textos do reembolso da assinatura Velo — fonte única.
// Usado pelo site (src/lib/refundEligibility.ts reexporta), pela IA de suporte
// e pelas funções request-refund / admin-refund-action.
// Sem imports: precisa rodar tanto no Deno quanto no Vite.

export type RefundMode =
  | "reembolso" // dentro dos 7 dias: pode pedir reembolso (vai para análise)
  | "cancelamento" // fora dos 7 dias: só cancelar a renovação, sem equipe
  | "em_analise" // já existe pedido pendente
  | "aprovado" // reembolso desta assinatura já aprovado
  | "cancelado" // renovação já cancelada
  | "vitalicio" // plano vitalício fora do prazo: não há renovação para cancelar
  | "sem_assinatura";

export type RefundSubscription = {
  id: string;
  created_at: string;
  cancel_at_period_end?: boolean | null;
  purchase_kind?: string | null;
};

export type RefundRequestStatus = { subscription_id: string | null; status: string | null };

export const REFUND_WINDOW_DAYS = 7;

/** Status de assinatura que contam como "paga e em vigor" para reembolso e cancelamento. */
export const REFUNDABLE_SUBSCRIPTION_STATUSES = ["active", "paid", "approved", "authorized"];

/** Pedido que já virou devolução de dinheiro. */
const REEMBOLSO_CONCLUIDO = ["processed", "approved"];

/** Link da única tela onde o cliente faz o pedido. */
export const REFUND_PAGE_PATH = "/dashboard/configuracoes?tab=Perfil#velo-reembolso";
export const REFUND_PAGE_LABEL = "Configurações → Perfil";
/** Depois dos 7 dias a seção some do Perfil; cancelar a renovação fica na aba Plano. */
export const CANCEL_PAGE_PATH = "/dashboard/configuracoes?tab=Plano#velo-cancelar-renovacao";
export const CANCEL_PAGE_LABEL = "Configurações → Plano";

/** Prazo oficial exibido em todos os textos antes da aprovação. */
export const PRAZO_REEMBOLSO =
  "O pedido é analisado em até 5 a 7 dias úteis, e o valor volta pelo mesmo meio de pagamento. No cartão, pode aparecer só na próxima fatura.";

/** Depois de aprovado, só falta o dinheiro voltar. */
export const PRAZO_DEVOLUCAO =
  "O valor volta pelo mesmo meio de pagamento. No cartão, pode aparecer só na próxima fatura.";

export function refundDaysUsed(createdAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 86_400_000));
}

export function getRefundMode(
  subscription: RefundSubscription | null,
  requests: RefundRequestStatus[],
  now = Date.now(),
): RefundMode {
  const status = (r: RefundRequestStatus) => String(r.status ?? "").toLowerCase();
  if (requests.some((r) => status(r) === "pending")) return "em_analise";
  if (!subscription) return "sem_assinatura";
  if (requests.some((r) => REEMBOLSO_CONCLUIDO.includes(status(r)) && r.subscription_id === subscription.id)) return "aprovado";
  const age = now - new Date(subscription.created_at).getTime();
  // Quem já recebeu um reembolso não pode pedir outro, em nenhuma assinatura.
  const jaReembolsado = requests.some((r) => REEMBOLSO_CONCLUIDO.includes(status(r)));
  const dentroDoPrazo = Number.isFinite(age) && age >= 0 && age <= REFUND_WINDOW_DAYS * 86_400_000;
  // Cancelar a renovação não tira o direito ao reembolso dentro dos 7 dias.
  if (dentroDoPrazo && !jaReembolsado) return "reembolso";
  if (subscription.purchase_kind === "lifetime") return "vitalicio";
  return subscription.cancel_at_period_end ? "cancelado" : "cancelamento";
}
