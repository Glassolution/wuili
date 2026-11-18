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
  if (row.data && providerCancellationConfirmed(row.data)) return true;
  return ["CANCELED", "CANCELLED", "CANCEL_SCHEDULED"].includes(String(row.status ?? "").toUpperCase()) ||
    row.cancelAtPeriodEnd === true ||
    (typeof row.canceledAt === "string" && Number.isFinite(Date.parse(row.canceledAt)));
}

/** Only this explicit provider acknowledgement is idempotent success, not an arbitrary 400. */
export function providerCancellationAlreadyScheduled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { status?: number; details?: unknown; responseBody?: string };
  if (value.status !== 400) return false;
  const text = `${JSON.stringify(value.details) ?? ""} ${value.responseBody ?? ""}`
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return text.includes("cancelamento ao fim do periodo ja esta agendado");
}

export function refundExecutionRequested(body: { dry_run?: boolean; confirmation?: { user_id?: string; amount?: number; reason?: string } }): boolean {
  return body.dry_run === false && typeof body.confirmation?.user_id === "string" &&
    Number(body.confirmation.amount) > 0 && Boolean(body.confirmation.reason?.trim());
}

export async function confirmProviderCancellation(
  read: () => Promise<unknown>, cancel: () => Promise<unknown>, saveConfirmation: (status?: "cancel_scheduled") => Promise<void>,
): Promise<void> {
  let before: unknown;
  try { before = await read(); } catch { /* DELETE still must be attempted on a failed pre-read. */ }
  if (!providerCancellationConfirmed(before)) {
    let response: unknown;
    try { response = await cancel(); } catch (error) {
      if (providerCancellationAlreadyScheduled(error)) {
        await saveConfirmation("cancel_scheduled");
        return;
      }
      // Preserve the original DELETE response even when the diagnostic GET also fails.
      let after: unknown;
      try { after = await read(); } catch { throw error; }
      if (!providerCancellationConfirmed(after)) throw error;
      await saveConfirmation();
      return;
    }
    const confirmed = providerCancellationConfirmed(response) || providerCancellationConfirmed(await read());
    if (!confirmed) throw new Error("provider_cancellation_unconfirmed");
  }
  await saveConfirmation();
}