// Regra pura (testável) da auditoria de cancelamento no provedor.
export type ProviderSub = { subscriptionId: string; status: string; cancelAtPeriodEnd?: boolean; nextCycleChargeDate?: string; customer?: { email?: string } };

export const CANCELLED_LOCAL_STATUSES = ["refunded", "refunded_duplicate", "cancelled", "cancel_scheduled"];

export function needsProviderCancellation(provider: ProviderSub, local: { status: string; purchase_kind?: string | null; provider?: string | null } | undefined) {
  if (provider.status !== "ACTIVE" || provider.cancelAtPeriodEnd) return false;
  if (!local || local.purchase_kind === "lifetime" || local.provider === "sandbox") return false;
  return CANCELLED_LOCAL_STATUSES.includes(local.status);
}

