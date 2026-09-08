/**
 * Regra única de elegibilidade de reembolso.
 *
 * O cliente tem direito a UM reembolso. O que consome esse direito é um
 * reembolso que ELE pediu — não um estorno que a Velo fez por conta própria.
 *
 * O estorno automático de cobrança duplicada (`refund_kind = 'duplicate'`,
 * gerado por `paymentGuard.detectAndRefundDuplicates`) é devolução de dinheiro
 * que nunca deveria ter sido cobrado: o cliente não solicitou nada e continua
 * com o acesso (`keep_access = true`). Contá-lo como reembolso queimava para
 * sempre o direito de quem nunca pediu.
 *
 * A regra vivia copiada em `request-refund` e em `admin-refund-action`, com o
 * mesmo defeito nas duas. Mora aqui para não divergir de novo.
 */

export type RefundRequestRow = {
  id: string;
  status: string | null;
  refund_kind?: string | null;
  keep_access?: boolean | null;
  requested_at?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
};

/** Colunas mínimas que a regra precisa ler. Use no `.select()` de quem consulta. */
export const REFUND_ELIGIBILITY_COLUMNS = "id, status, refund_kind, keep_access";

/** Pedido recusado ou cancelado não gasta o direito: o cliente pode pedir de novo. */
const STATUS_QUE_NAO_CONSOMEM = ["rejected", "denied", "cancelled", "canceled"];

/** Tipos de estorno que a Velo faz sozinha, sem o cliente ter solicitado. */
const TIPOS_NAO_SOLICITADOS = ["duplicate"];

/**
 * Estorno que a Velo iniciou por conta própria e que preserva o acesso.
 *
 * Atenção: `automated` NÃO serve para isto. O reembolso direto do suporte
 * (`refund_kind = 'admin_direct'`) também grava `automated: true` e é um
 * reembolso de verdade — esse consome o direito normalmente.
 */
export const ehEstornoNaoSolicitado = (linha: RefundRequestRow): boolean =>
  TIPOS_NAO_SOLICITADOS.includes(String(linha.refund_kind ?? "").toLowerCase()) ||
  linha.keep_access === true;

/** Este pedido gasta o direito a reembolso do cliente? */
export const consomeDireitoDeReembolso = (linha: RefundRequestRow): boolean => {
  if (ehEstornoNaoSolicitado(linha)) return false;
  return !STATUS_QUE_NAO_CONSOMEM.includes(String(linha.status ?? "").toLowerCase());
};

/**
 * Filtra a lista para os pedidos que realmente partiram do cliente (ou do
 * suporte em nome dele). É sobre esse recorte que "em análise" e "já
 * reembolsado" devem ser avaliados.
 */
export const pedidosQueContam = (linhas: readonly RefundRequestRow[]): RefundRequestRow[] =>
  linhas.filter((linha) => !ehEstornoNaoSolicitado(linha));

/** Pedidos que bloqueiam uma nova solicitação (em aberto ou já reembolsado). */
export const reembolsosBloqueantes = (linhas: readonly RefundRequestRow[]): RefundRequestRow[] =>
  linhas.filter(consomeDireitoDeReembolso);

export const estaPendente = (linha: RefundRequestRow): boolean =>
  String(linha.status ?? "").toLowerCase() === "pending";
