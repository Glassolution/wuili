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

export const REFUND_FEEDBACK_MAX_LENGTH = 2000;

export function formatRefundFeedback(details: unknown, hadError: unknown, canContact: unknown): string | null {
  if (typeof details !== "string" || !details.trim() || details.trim().length > REFUND_FEEDBACK_MAX_LENGTH) return null;
  if (typeof hadError !== "boolean" || typeof canContact !== "boolean") return null;

  return [
    `Ocorreu algum erro? ${hadError ? "Sim" : "Não"}`,
    `Autoriza contato para ajudar? ${canContact ? "Sim" : "Não"}`,
    "",
    details.trim(),
  ].join("\n");
}

/**
 * Único caminho do pedido de reembolso: o artigo da Central de Ajuda, que
 * traz, no passo a passo, um link discreto para o atendimento de reembolso (REFUND_CHAT_PATH).
 * A central não tem botão nem link em lugar nenhum do app: só se chega pelo
 * endereço, que o chat de suporte envia quando a pessoa pede reembolso
 * (resposta fixa do support-assistant, nunca texto livre da IA).
 */
export const REFUND_ARTICLE_TITLE = "Pedir reembolso de uma cobrança";
export const REFUND_PAGE_PATH = "/ajuda/pagamentos-e-planos/pedir-reembolso";
export const REFUND_PAGE_LABEL = `Central de Ajuda, artigo "${REFUND_ARTICLE_TITLE}"`;
/** Como chegar ao pedido, em texto: o link só é enviado pelo chat de suporte. */
export const REFUND_PAGE_HOW =
  `O pedido é feito no atendimento de reembolso, aberto pelo link no passo a passo do artigo da Central de Ajuda, com você logado na conta que foi cobrada. Para receber o link do artigo, peça o reembolso no chat de suporte.`;
/**
 * Cancelar a renovação (sem reembolso), a qualquer momento: página "Gerenciar
 * assinatura", que também não tem botão nem link no app. O link vai pela
 * resposta fixa do support-assistant quando a pessoa pede para cancelar.
 */
export const CANCEL_PAGE_PATH = "/dashboard/configuracoes/central-da-assinatura";
export const CANCEL_PAGE_LABEL = "página Gerenciar assinatura";
/** Como chegar ao cancelamento, em texto. */
export const CANCEL_PAGE_HOW =
  `O cancelamento da renovação é feito por você mesmo, na página Gerenciar assinatura. Para receber o link, peça o cancelamento no chat de suporte.`;

/**
 * Atendimento de reembolso: chat próprio, com a IA, aberto pelo link discreto
 * no passo a passo do artigo de reembolso. A IA confere a situação e monta o pedido, mas
 * quem envia é o cliente, no cartão de confirmação (função request-refund).
 */
export const REFUND_CHAT_PATH = "/ajuda/reembolso";

/** Motivos aceitos no pedido (o formulário antigo e a IA usam a mesma lista). */
export const REFUND_REASONS = [
  "Não consegui vender",
  "Não entendi como usar a plataforma",
  "Tive problemas técnicos",
  "Achei caro",
  "Estou sem tempo",
  "Não era o que eu esperava",
  "Outro motivo",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

/**
 * Texto que a equipe lê no pedido feito pelo atendimento: o resumo da IA e as
 * palavras do próprio cliente, sempre dentro do limite do campo.
 */
export function composeRefundChatDetails(resumo: string, mensagensDoCliente: string[]): string {
  const cabecalho = `Resumo do atendimento (IA): ${resumo.trim()}`;
  const palavras = mensagensDoCliente.map((m) => m.trim()).filter(Boolean);
  // Espaço das linhas "Ocorreu algum erro?" / "Autoriza contato?" do formatRefundFeedback.
  const limite = REFUND_FEEDBACK_MAX_LENGTH - 120;
  let texto = cabecalho.slice(0, limite);
  if (palavras.length) {
    const resto = limite - texto.length - "\n\nPalavras do cliente:\n".length;
    if (resto > 40) {
      const corpo = palavras.map((m) => `- ${m}`).join("\n");
      texto += `\n\nPalavras do cliente:\n${corpo.length > resto ? `${corpo.slice(0, resto - 1)}…` : corpo}`;
    }
  }
  return texto;
}

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
