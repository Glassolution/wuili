export const SUBSCRIPTION_GRACE_MS = 3 * 24 * 60 * 60 * 1000;
export const RECENT_PAYMENT_PROTECTION_MS = 35 * 24 * 60 * 60 * 1000;

export type AccessSubscription = {
  plan?: string | null;
  status?: string | null;
  provider?: string | null;
  purchase_kind?: string | null;
  current_period_end?: string | null;
};

export const ACCESS_STATUSES = ["active", "paid", "approved", "trialing", "trial", "authorized", "cancel_scheduled"];

/** Lifetime bypasses dates, never payment status. Missing monthly dates do not prove entitlement. */
export function subscriptionHasAccess(sub: AccessSubscription, now = Date.now()): boolean {
  if (sub.provider === "sandbox" || !ACCESS_STATUSES.includes(String(sub.status).toLowerCase())) return false;
  if (sub.purchase_kind === "lifetime") return true;
  const end = Date.parse(sub.current_period_end ?? "");
  return Number.isFinite(end) && now <= end + SUBSCRIPTION_GRACE_MS;
}

const RANK: Record<string, number> = { gratis: 0, free: 0, base: 1, go: 1, pro: 2, plus: 2, business: 3 };
export function bestAccessSubscription<T extends AccessSubscription>(subs: T[], now = Date.now()): T | undefined {
  return subs.filter(sub => subscriptionHasAccess(sub, now))
    .sort((a, b) => (RANK[b.plan ?? ""] ?? 0) - (RANK[a.plan ?? ""] ?? 0))[0];
}

export type AuditCharge = {
  chargeId?: string;
  status?: string;
  paidAt?: string | null;
  subscription?: { subscriptionId?: string; id?: string } | null;
  customer?: { email?: string; customerId?: string; id?: string } | null;
  payer?: { email?: string } | null;
};

/** Check all contracts and payment emails; an undated PAID charge remains protected. */
export function recentPaidCharges(charges: AuditCharge[], contracts: string[], emails: string[], now: number): AuditCharge[] {
  const identities = new Set(emails.filter(Boolean).map(email => email.trim().toLowerCase()));
  return charges.filter(charge => {
    if (charge.status?.toUpperCase() !== "PAID") return false;
    const paid = Date.parse(charge.paidAt ?? "");
    if (Number.isFinite(paid) && paid < now - RECENT_PAYMENT_PROTECTION_MS) return false;
    const contract = charge.subscription?.subscriptionId ?? charge.subscription?.id;
    return Boolean(contract && contracts.includes(contract)) ||
      [charge.customer?.email, charge.payer?.email].some(email => Boolean(email && identities.has(email.trim().toLowerCase())));
  });
}

export function expiredProviderTarget(sub: AccessSubscription, providerStatus: string | undefined,
  hasRecentPayment: boolean, hasLifetime: boolean, now: number): "expired" | "past_due" | null {
  if (sub.provider !== "validapay" || sub.status !== "active" || sub.purchase_kind === "lifetime" ||
    hasRecentPayment || hasLifetime) return null;
  const end = Date.parse(sub.current_period_end ?? "");
  if (!Number.isFinite(end) || now <= end + SUBSCRIPTION_GRACE_MS) return null;
  if (["EXPIRED", "CANCELED", "CANCELLED"].includes(providerStatus ?? "")) return "expired";
  if (providerStatus === "DEFAULT") return "past_due";
  return null;
}