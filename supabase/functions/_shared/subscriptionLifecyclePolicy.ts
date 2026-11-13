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

/** A completed terminating refund is a cutoff even for legacy contracts without cancelled_at. */
export function renewalAfterTermination(paidAt: string | null, cancelledAt: string | null,
  refunds: Array<{ status: string; keep_access: boolean | null; processed_at: string | null }>): boolean {
  if (isPostCancellationPayment(paidAt, cancelledAt)) return true;
  return refunds.some(r => r.keep_access === false && ["processed", "refunded_by_mp"].includes(r.status) &&
    isPostCancellationPayment(paidAt, r.processed_at));
}

/** Fail closed: an HTTP success by itself does not confirm provider cancellation. */
export function providerCancellationConfirmed(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["CANCELED", "CANCELLED", "CANCEL_SCHEDULED"].includes(String(row.status ?? "").toUpperCase()) ||
    (typeof row.canceledAt === "string" && Number.isFinite(Date.parse(row.canceledAt)));
}

export function refundExecutionRequested(body: { dry_run?: boolean; confirmation?: { user_id?: string; amount?: number; reason?: string } }): boolean {
  return body.dry_run === false && typeof body.confirmation?.user_id === "string" &&
    Number(body.confirmation.amount) > 0 && Boolean(body.confirmation.reason?.trim());
}

export async function confirmProviderCancellation(
  read: () => Promise<unknown>, cancel: () => Promise<unknown>, saveConfirmation: () => Promise<void>,
): Promise<void> {
  let before: unknown;
  try { before = await read(); } catch { /* DELETE still must be attempted on a failed pre-read. */ }
  if (!providerCancellationConfirmed(before)) {
    let response: unknown;
    try { response = await cancel(); } catch (error) {
      // Some providers reject a second DELETE after scheduling cancellation. Only a fresh read may confirm it.
      if (!providerCancellationConfirmed(await read())) throw error;
      await saveConfirmation();
      return;
    }
    const confirmed = providerCancellationConfirmed(response) || providerCancellationConfirmed(await read());
    if (!confirmed) throw new Error("provider_cancellation_unconfirmed");
  }
  await saveConfirmation();
}