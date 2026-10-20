export type RefundMode = "reembolso" | "cancelamento" | "em_analise" | "aprovado" | "cancelado" | "sem_assinatura";
export type RefundSubscription = {
  id: string;
  created_at: string;
  amount: number | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};
export type RefundRequestStatus = { subscription_id: string | null; status: string | null };

export function getRefundMode(subscription: RefundSubscription | null, requests: RefundRequestStatus[], now = Date.now()): RefundMode {
  if (requests.some((request) => request.status === "pending")) return "em_analise";
  if (!subscription) return "sem_assinatura";
  if (requests.some((request) => ["processed", "approved"].includes(request.status ?? "") && request.subscription_id === subscription.id)) return "aprovado";
  const age = now - new Date(subscription.created_at).getTime();
  const eligible = Number.isFinite(age) && age >= 0 && age <= 7 * 86_400_000 && !requests.some((request) => request.status === "processed");
  // Stopping renewal does not waive a refund still within the seven-day window.
  if (eligible) return "reembolso";
  return subscription.cancel_at_period_end ? "cancelado" : "cancelamento";
}