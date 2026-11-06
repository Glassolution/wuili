// A regra mora em supabase/functions/_shared/refundPolicy.ts, a mesma que o
// servidor (request-refund) e a IA de suporte usam.
export {
  formatRefundFeedback,
  REFUND_FEEDBACK_MAX_LENGTH,
  getRefundMode,
  refundDaysUsed,
  REFUND_WINDOW_DAYS,
  REFUNDABLE_SUBSCRIPTION_STATUSES,
  REFUND_PAGE_PATH,
  REFUND_PAGE_LABEL,
  CANCEL_PAGE_PATH,
  CANCEL_PAGE_LABEL,
  PRAZO_REEMBOLSO,
  PRAZO_DEVOLUCAO,
  type RefundMode,
  type RefundSubscription,
  type RefundRequestStatus,
} from "../../supabase/functions/_shared/refundPolicy";
