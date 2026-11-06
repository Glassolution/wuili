import { validaPayFetch } from "./validapay.ts";
import { confirmProviderCancellation } from "./subscriptionLifecyclePolicy.ts";
import type { LifecycleAdmin } from "./subscriptionLifecycle.ts";

type Admin = LifecycleAdmin & {
  // deno-lint-ignore no-explicit-any -- server SDK RPC builder structural interface.
  rpc(name: string, args: Record<string, unknown>): any;
};
type CancellationSub = { id: string; user_id: string; provider?: string | null; purchase_kind?: string | null;
  validapay_subscription_id?: string | null; provider_cancelled_at?: string | null };

export async function requestProviderCancellation(admin: Admin, sub: CancellationSub, reason: string): Promise<boolean> {
  if (sub.purchase_kind === "lifetime" || sub.provider === "sandbox") return true;
  if (!sub.validapay_subscription_id) return false;
  if (sub.provider_cancelled_at) return true;
  // Enqueue only explicit new cancellation/refund requests; never backfill historical contracts into execution.
  const { error } = await admin.from("provider_cancellation_requests").upsert({ subscription_id: sub.id,
    user_id: sub.user_id, provider_subscription_id: sub.validapay_subscription_id, reason },
    { onConflict: "subscription_id", ignoreDuplicates: true });
  if (error) throw new Error(`provider_cancellation_enqueue:${error.message}`);
  return await processProviderCancellation(admin, sub.id);
}

export async function processProviderCancellation(admin: Admin, subscriptionId: string): Promise<boolean> {
  const { data, error } = await admin.rpc("claim_provider_cancellation", { p_subscription_id: subscriptionId });
  if (error) throw new Error(`provider_cancellation_claim:${error.message}`);
  const job = data?.[0];
  if (!job) {
    const { data: saved, error: savedError } = await admin.from("provider_cancellation_requests")
      .select("state").eq("subscription_id", subscriptionId).maybeSingle();
    if (savedError) throw new Error(`provider_cancellation_read:${savedError.message}`);
    return saved?.state === "confirmed";
  }
  const path = `/v1/subscriptions/${encodeURIComponent(job.provider_subscription_id)}`;
  const scope = "checkouts/write checkouts/read subscriptions/write subscriptions/read accounts/read";
  try {
    await confirmProviderCancellation(
      () => validaPayFetch(path, { method: "GET", scope }),
      () => validaPayFetch(path, { method: "DELETE", scope }),
      async () => {
        const now = new Date().toISOString();
        const { error: saveError } = await admin.from("subscriptions").update({ provider_cancelled_at: now })
          .eq("id", subscriptionId).eq("validapay_subscription_id", job.provider_subscription_id);
        if (saveError) throw new Error(`provider_cancellation_confirmation_save:${saveError.message}`);
        const { error: jobError } = await admin.from("provider_cancellation_requests").update({ state: "confirmed",
          confirmed_at: now, next_retry_at: null, lease_until: null, last_error: null, updated_at: now }).eq("subscription_id", subscriptionId);
        if (jobError) throw new Error(`provider_cancellation_job_save:${jobError.message}`);
      },
    );
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const exhausted = job.attempts >= 6;
    const delay = [1, 5, 15, 60, 180, 360][Math.min(job.attempts - 1, 5)];
    const { error: retryError } = await admin.from("provider_cancellation_requests").update({
      state: exhausted ? "failed" : "pending", lease_until: null, last_error: message,
      next_retry_at: exhausted ? null : new Date(Date.now() + delay * 60_000).toISOString(), updated_at: new Date().toISOString(),
    }).eq("subscription_id", subscriptionId);
    if (retryError) throw new Error(`provider_cancellation_retry_save:${retryError.message}`);
    console.error("provider_cancellation_pending", subscriptionId, message);
    return false;
  }
}