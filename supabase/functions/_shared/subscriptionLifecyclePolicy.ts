export type LifecycleSubscription = {
  id: string; user_id: string; status: string; plan?: string | null;
  purchase_kind?: string | null; cancel_at_period_end?: boolean | null;
  cancelled_at?: string | null; current_period_end?: string | null;
};

export function paymentIsBlocked(sub: LifecycleSubscription, hasRefund: boolean): boolean {
  return hasRefund || ["cancelled", "refunded", "refunded_duplicate", "cancel_scheduled"].includes(sub.status) ||
    Boolean(sub.cancelled_at || sub.cancel_at_period_end);
}

export function preservesPaidAccess(sub: LifecycleSubscription, hasRefund: boolean, now: number): boolean {
  if (hasRefund || ["cancelled", "refunded", "refunded_duplicate"].includes(sub.status)) return false;
  return ["active", "paid", "approved", "cancel_scheduled"].includes(sub.status) &&
    (sub.purchase_kind === "lifetime" || Date.parse(sub.current_period_end ?? "") > now);
}

export function isPostCancellationPayment(paidAt: string | null, cancelledAt: string | null): boolean {
  const paid = Date.parse(paidAt ?? "");
  const cancelled = Date.parse(cancelledAt ?? "");
  return Number.isFinite(paid) && Number.isFinite(cancelled) && paid > cancelled;
}

/** Fail closed: an HTTP success by itself does not confirm provider cancellation. */
export function providerCancellationConfirmed(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["CANCELED", "CANCELLED", "CANCEL_SCHEDULED"].includes(String(row.status ?? "").toUpperCase()) ||
    (typeof row.canceledAt === "string" && Number.isFinite(Date.parse(row.canceledAt)));
}

export async function confirmProviderCancellation(
  read: () => Promise<unknown>, cancel: () => Promise<unknown>, saveConfirmation: () => Promise<void>,
): Promise<void> {
  let before: unknown;
  try { before = await read(); } catch { /* DELETE still must be attempted on a failed pre-read. */ }
  if (!providerCancellationConfirmed(before)) {
    const response = await cancel();
    const confirmed = providerCancellationConfirmed(response) || providerCancellationConfirmed(await read());
    if (!confirmed) throw new Error("provider_cancellation_unconfirmed");
  }
  await saveConfirmation();
}