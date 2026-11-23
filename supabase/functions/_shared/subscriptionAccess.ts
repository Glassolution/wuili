import { hasAccessStatus, resolveAccessPlan, type AccessSubscription } from "./subscriptionAccessPolicy.ts";

export type SubscriptionReadClient = {
  // SDK query builders differ across the existing function imports.
  // deno-lint-ignore no-explicit-any
  from(table: string): any;
};

/** Temporary profile fallback is restricted to accounts without any subscription in an access status. */
export async function readAccessPlan(client: SubscriptionReadClient, userId: string, now = Date.now()): Promise<string> {
  const { data, error } = await client.from("subscriptions")
    .select("plan,status,provider,purchase_kind,current_period_end").eq("user_id", userId);
  if (error) throw new Error(`subscription_access_read:${error.message}`);
  const subscriptions = (data ?? []) as AccessSubscription[];
  if (hasAccessStatus(subscriptions)) return resolveAccessPlan(subscriptions, null, now);
  const { data: profile, error: profileError } = await client.from("profiles")
    .select("plano").eq("user_id", userId).maybeSingle();
  if (profileError) throw new Error(`subscription_profile_read:${profileError.message}`);
  return resolveAccessPlan(subscriptions, profile?.plano, now);
}