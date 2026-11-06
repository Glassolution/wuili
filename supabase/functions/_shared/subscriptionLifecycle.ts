import { paymentIsBlocked, preservesPaidAccess, isPostCancellationPayment, type LifecycleSubscription } from "./subscriptionLifecyclePolicy.ts";

export type LifecycleAdmin = {
  // deno-lint-ignore no-explicit-any -- structural SDK interface supports both server SDK imports.
  from(table: string): any;
};

export async function hasTerminatingRefund(admin: LifecycleAdmin, subscriptionId: string): Promise<boolean> {
  const { data, error } = await admin.from("refund_requests").select("id")
    .eq("subscription_id", subscriptionId).in("status", ["processed", "approved", "refunded_by_mp"])
    .eq("keep_access", false).limit(1);
  if (error) throw new Error(`lifecycle_refund_read:${error.message}`);
  return Boolean(data?.length);
}

/** Recompute entitlement rather than blindly removing another paid contract's access. */
export async function syncPaidProfile(admin: LifecycleAdmin, userId: string): Promise<void> {
  const { data, error } = await admin.from("subscriptions")
    .select("id,user_id,status,plan,purchase_kind,cancel_at_period_end,cancelled_at,current_period_end")
    .eq("user_id", userId).in("status", ["active", "paid", "approved", "cancel_scheduled"]);
  if (error) throw new Error(`lifecycle_entitlement_read:${error.message}`);
  const ranks: Record<string, number> = { base: 1, pro: 2, business: 3 };
  const valid: LifecycleSubscription[] = [];
  for (const sub of (data ?? []) as LifecycleSubscription[]) {
    if (preservesPaidAccess(sub, await hasTerminatingRefund(admin, sub.id), Date.now())) valid.push(sub);
  }
  valid.sort((a, b) => (ranks[b.plan ?? ""] ?? 0) - (ranks[a.plan ?? ""] ?? 0));
  const { error: saveError } = await admin.from("profiles").update({ plano: valid[0]?.plan ?? "gratis" }).eq("user_id", userId);
  if (saveError) throw new Error(`lifecycle_profile_save:${saveError.message}`);
}

export async function guardPaidSubscription(admin: LifecycleAdmin, sub: LifecycleSubscription,
  evidence: { chargeId: string | null; amount: number | null; paidAt: string | null; eventId?: string | null },
): Promise<boolean> {
  const refunded = await hasTerminatingRefund(admin, sub.id);
  if (!paymentIsBlocked(sub, refunded)) return false;
  // No entitlement, commission or refund action may follow a blocked payment.
  const key = evidence.chargeId;
  const { data: priorRefunds, error: refundError } = key ? await admin.from("refund_requests")
    .select("id,status,charge_id,provider_response").eq("subscription_id", sub.id)
    .in("status", ["pending", "processed", "approved", "processing"]) : { data: [], error: null };
  if (refundError) throw new Error(`lifecycle_charge_refund_read:${refundError.message}`);
  const alreadyRefunded = (priorRefunds ?? []).some((r: { charge_id?: string; provider_response?: Record<string, unknown> }) =>
    r.charge_id === key || r.provider_response?.chargeId === key);
  const incident = {
    kind: "post_cancel_renewal", severity: "critical", user_id: sub.user_id, subscription_id: sub.id,
    charge_id: key, amount: evidence.amount,
    message: "Pagamento em contrato cancelado/reembolsado: acesso não reativado. Revisão e confirmação pontual necessárias para estorno.",
    resolved: alreadyRefunded,
    details: { paid_at: evidence.paidAt, cancelled_at: sub.cancelled_at ?? null,
      after_cancellation: isPostCancellationPayment(evidence.paidAt, sub.cancelled_at ?? null),
      refund_already_recorded: alreadyRefunded, webhook_event_id: evidence.eventId ?? null,
      review_required: !alreadyRefunded, money_moved: false },
  };
  // Preserve existing resolution when replaying a charge; unique index prevents concurrent duplicates.
  const { data: existing, error: existingError } = await admin.from("payment_incidents").select("id")
    .eq("kind", "post_cancel_renewal")
    .eq(key ? "charge_id" : "subscription_id", key ?? sub.id).limit(1);
  if (existingError) throw new Error(`lifecycle_incident_read:${existingError.message}`);
  if (!existing?.length) {
    const { error } = await admin.from("payment_incidents").insert(incident);
    if (error && error.code !== "23505") throw new Error(`lifecycle_incident_save:${error.message}`);
  }
  if (refunded && !["refunded", "cancelled", "refunded_duplicate"].includes(sub.status)) {
    const { error } = await admin.from("subscriptions").update({ status: "refunded", updated_at: new Date().toISOString() }).eq("id", sub.id);
    if (error) throw new Error(`lifecycle_terminal_save:${error.message}`);
  }
  await syncPaidProfile(admin, sub.user_id);
  return true;
}