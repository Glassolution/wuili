import { requestProviderCancellation } from "./providerCancellation.ts";
import { syncPaidProfile, type LifecycleAdmin } from "./subscriptionLifecycle.ts";
import { scheduleUtmifyTask, sendUtmifyConfirmedRefund } from "./utmify.ts";

type Admin = LifecycleAdmin & {
  // deno-lint-ignore no-explicit-any -- structural server SDK RPC interface.
  rpc(name: string, args: Record<string, unknown>): any;
};

/** Called only for a newly confirmed refund, not a sweep of historical accounts. */
export async function finalizeConfirmedRefund(admin: Admin, refund: {
  subscription_id: string | null; user_id: string; keep_access?: boolean | null; charge_id?: string | null;
}): Promise<boolean> {
  if (!refund.subscription_id) return false;
  const { data: sub, error } = await admin.from("subscriptions").select("*")
    .eq("id", refund.subscription_id).eq("user_id", refund.user_id).maybeSingle();
  if (error) throw new Error(`confirmed_refund_subscription:${error.message}`);
  if (!sub) throw new Error("confirmed_refund_subscription_missing");
  // Refunds of an extra renewal must not terminate a different legitimate subscription.
  if (refund.keep_access === true && !["cancelled", "refunded", "refunded_duplicate"].includes(sub.status) &&
    !sub.cancelled_at && !sub.cancel_at_period_end) return false;
  if (refund.keep_access !== true) {
    const now = new Date().toISOString();
    const { error: saveError } = await admin.from("subscriptions").update({
      status: "refunded", cancel_at_period_end: true, cancelled_at: sub.cancelled_at ?? now, updated_at: now,
    }).eq("id", sub.id).eq("user_id", refund.user_id);
    if (saveError) throw new Error(`confirmed_refund_terminal:${saveError.message}`);
    await syncPaidProfile(admin, refund.user_id);
  }
  const confirmed = await requestProviderCancellation(admin, sub, "Estorno confirmado: encerrar recorrência deste contrato");
  if (confirmed && refund.charge_id) {
    const { error: incidentError } = await admin.from("payment_incidents").update({
      resolved: true, updated_at: new Date().toISOString(),
    }).eq("kind", "post_cancel_renewal").eq("charge_id", refund.charge_id)
      .eq("subscription_id", sub.id).eq("user_id", refund.user_id);
    if (incidentError) throw new Error(`confirmed_refund_incident:${incidentError.message}`);
  }
  if (refund.keep_access !== true) {
    scheduleUtmifyTask(() => sendUtmifyConfirmedRefund(admin, sub, refund, new Date().toISOString()));
  }
  return confirmed;
}