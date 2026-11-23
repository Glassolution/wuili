import { bestAccessSubscription, type AccessSubscription } from "./subscriptionAccessPolicy.ts";

export type SubscriptionReadClient = {
  // SDK query builders differ across the existing function imports.
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
};

/** profiles.plano is a display cache, not evidence of current paid access. */
export async function readAccessPlan(client: SubscriptionReadClient, userId: string, now = Date.now()): Promise<string> {
  const { data, error } = await client.from("subscriptions")
    .select("plan,status,provider,purchase_kind,current_period_end").eq("user_id", userId);
  if (error) throw new Error(`subscription_access_read:${error.message}`);
  return bestAccessSubscription((data ?? []) as AccessSubscription[], now)?.plan ?? "gratis";
}