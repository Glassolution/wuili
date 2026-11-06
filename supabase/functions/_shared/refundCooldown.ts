type Subscription = {
  id: string;
  status: string;
  created_at: string;
  amount: number | null;
  plan: string;
  is_trial?: boolean | null;
  provider?: string | null;
  payment_method?: string | null;
  validapay_charge_id?: string | null;
  mp_payment_id?: string | null;
  stripe_subscription_id?: string | null;
  origin_paid_at?: string | null;
};

export function isPaidRepurchase(sub: Subscription, refundedAt: string, verifiedSubscriptionId?: string): boolean {
  const created = Date.parse(sub.created_at);
  const refunded = Date.parse(refundedAt);
  const paymentIds = [sub.validapay_charge_id, sub.mp_payment_id, sub.stripe_subscription_id];
  return sub.status === "active" && Number(sub.amount) > 0 && !sub.is_trial &&
    ["base", "go", "plus", "pro", "business"].includes(sub.plan) &&
    sub.provider !== "sandbox" && sub.payment_method !== "sandbox" &&
    Number.isFinite(created) && Number.isFinite(refunded) && created > refunded &&
    (sub.id === verifiedSubscriptionId ||
      paymentIds.some((id) => typeof id === "string" && id.trim().length > 0 && !id.startsWith("sandbox_")));
}

// Structural interface accepts both SDK imports used by the existing functions.
type Admin = {
  // deno-lint-ignore no-explicit-any -- Supabase's fluent query builders differ across SDK imports.
  from(table: string): any;
};

/** Only server clients may call this; never accept payment evidence from a browser. */
export async function clearRefundCooldownAfterRepurchase(admin: Admin, userId: string, verifiedSubscriptionId?: string): Promise<boolean> {
  const { data: profile, error: profileError } = await admin.from("profiles")
    .select("refund_cooldown_until").eq("user_id", userId).maybeSingle();
  if (profileError) throw new Error(`cooldown_profile_read:${profileError.message}`);
  if (!profile?.refund_cooldown_until) return false;

  const { data: refund, error: refundError } = await admin.from("refund_requests")
    .select("processed_at").eq("user_id", userId)
    .in("status", ["processed", "refunded_by_mp"])
    .not("processed_at", "is", null).order("processed_at", { ascending: false })
    .limit(1).maybeSingle();
  if (refundError) throw new Error(`cooldown_refund_read:${refundError.message}`);
  if (!refund?.processed_at) return false;

  const { data: subscriptions, error: subError } = await admin.from("subscriptions")
    .select("id,status,created_at,amount,plan,is_trial,provider,payment_method,validapay_charge_id,mp_payment_id,stripe_subscription_id,origin_paid_at")
    .eq("user_id", userId).eq("status", "active").gt("created_at", refund.processed_at);
  if (subError) throw new Error(`cooldown_subscription_read:${subError.message}`);
  if (!(subscriptions ?? []).some((sub: Subscription) => isPaidRepurchase(sub, refund.processed_at, verifiedSubscriptionId))) return false;

  // Compare-and-set: a simultaneous new refund must not lose its new cooldown.
  const { data: updated, error: updateError } = await admin.from("profiles")
    .update({ refund_cooldown_until: null }).eq("user_id", userId)
    .eq("refund_cooldown_until", profile.refund_cooldown_until).select("user_id");
  if (updateError) throw new Error(`cooldown_clear:${updateError.message}`);
  return (updated?.length ?? 0) > 0;
}