/** Subscription cancellation is self-service; refunds inside the window need review. */
export function isSelfServiceCancellation(reason: string, createdAt: string | null, now = Date.now()): boolean {
  if (!createdAt || !["reembolso", "cancelamento", "cancelar", "cancelamento_renovacao"].includes(reason)) return false;
  const paidAt = new Date(createdAt).getTime();
  return Number.isFinite(paidAt) && now - paidAt > 7 * 86_400_000;
}

export function isCancellationConfirmation(text: string): boolean {
  return /^(Cancelamento do plano confirmado\.|Cancelamento da renovação confirmado\.)/.test(text.trim());
}