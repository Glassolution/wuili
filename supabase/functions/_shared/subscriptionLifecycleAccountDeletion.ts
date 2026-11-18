import { requestProviderCancellation } from "./providerCancellation.ts";
import type { LifecycleAdmin } from "./subscriptionLifecycle.ts";

/** Block account deletion until every real recurring contract is durably cancelled. */
export async function cancelBeforeAccountDeletion(admin: LifecycleAdmin, userId: string): Promise<boolean> {
  const { data, error } = await admin.from("subscriptions").select("*")
    .eq("user_id", userId).not("validapay_subscription_id", "is", null);
  if (error) throw new Error(`account_deletion_subscription_read:${error.message}`);
  let confirmed = true;
  for (const sub of data ?? []) {
    if (sub.purchase_kind === "lifetime" || sub.provider === "sandbox") continue;
    const { error: saveError } = await admin.from("subscriptions").update({
      cancel_at_period_end: true, cancelled_at: sub.cancelled_at ?? new Date().toISOString(),
      cancellation_reason: "Exclusão de conta solicitada pelo cliente",
    }).eq("id", sub.id).eq("user_id", userId);
    if (saveError) throw new Error(`account_deletion_cancellation_save:${saveError.message}`);
    if (!await requestProviderCancellation(admin, sub, "Exclusão de conta solicitada pelo cliente")) confirmed = false;
  }
  return confirmed;
}