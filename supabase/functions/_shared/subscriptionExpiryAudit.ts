import { validaPayFetch } from "./validapay.ts";
import { bestAccessSubscription, expiredProviderTarget, recentPaidCharges, SUBSCRIPTION_GRACE_MS,
  type AccessSubscription, type AuditCharge } from "./subscriptionAccessPolicy.ts";
import type { SubscriptionReadClient } from "./subscriptionAccess.ts";

type LocalSubscription = AccessSubscription & { id: string; user_id: string; updated_at: string | null; validapay_subscription_id: string | null };
type ProviderSubscription = { status?: string; email?: string; customer?: { email?: string } };
type Page = { items?: AuditCharge[]; pagination?: { lastKey?: string; hasMore?: boolean } };

/** Never mutate from an incomplete charge listing. No payment/cancellation/refund APIs are used. */
async function completeCharges(): Promise<AuditCharge[]> {
  const charges: AuditCharge[] = [];
  let key: string | undefined;
  const seen = new Set<string>();
  for (let page = 0; page < 250; page++) {
    const qs = new URLSearchParams({ limit: "100" });
    if (key) qs.set("lastKey", key);
    const data = await validaPayFetch<Page>(`/v1/charges?${qs}`, {
      method: "GET", scope: "checkouts/read pix.cob/read accounts/read wallet/read",
    });
    if (!Array.isArray(data.items) || !data.pagination) throw new Error("expiry_charge_listing_invalid");
    charges.push(...data.items);
    if (data.pagination.hasMore === false) return charges;
    key = data.pagination.lastKey;
    if (!key) {
      if (data.pagination.hasMore === true) throw new Error("expiry_charge_cursor_missing");
      return charges;
    }
    if (seen.has(key)) throw new Error("expiry_charge_cursor_repeated");
    seen.add(key);
  }
  throw new Error("expiry_charge_listing_incomplete");
}

/** Called inside the existing hourly branch, not from checkout or webhook. */
export async function auditExpiredProviderSubscriptions(admin: SubscriptionReadClient, now = Date.now(),
  reads = {
    charges: completeCharges,
    provider: async (id: string) => {
      const response = await validaPayFetch<ProviderSubscription & { data?: ProviderSubscription }>(
        `/v1/subscriptions/${encodeURIComponent(id)}`, { method: "GET", scope: "subscriptions/read" });
      return response.data ?? response;
    },
  }) {
  const result = { checked: 0, expired: 0, past_due: 0, protected: 0, unconfirmed: 0, conflicts: 0 };
  const candidates: LocalSubscription[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("subscriptions")
      .select("id,user_id,plan,status,provider,purchase_kind,current_period_end,updated_at,validapay_subscription_id")
      .eq("provider", "validapay").eq("status", "active").neq("purchase_kind", "lifetime")
      .lt("current_period_end", new Date(now - SUBSCRIPTION_GRACE_MS).toISOString())
      .order("id").range(offset, offset + 999);
    if (error) throw new Error(`expiry_candidates:${error.message}`);
    candidates.push(...(data ?? []));
    if (!data || data.length < 1000) break;
    if (offset >= 99000) throw new Error("expiry_candidates_incomplete");
  }
  if (!candidates.length) return result;
  // Rotate bounded groups, so a protected/unknown old contract cannot starve later candidates.
  const groups = Math.ceil(candidates.length / 100);
  const start = (Math.floor(now / 3600_000) % groups) * 100;
  const batch = candidates.slice(start, start + 100);
  const userIds = [...new Set(batch.map(sub => sub.user_id))];
  const locals: LocalSubscription[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.from("subscriptions")
      .select("id,user_id,plan,status,provider,purchase_kind,current_period_end,updated_at,validapay_subscription_id")
      .in("user_id", userIds).order("id").range(offset, offset + 999);
    if (error) throw new Error(`expiry_account_contracts:${error.message}`);
    locals.push(...(data ?? []));
    if (!data || data.length < 1000) break;
    if (offset >= 99000) throw new Error("expiry_account_contracts_incomplete");
  }
  const { data: profiles, error: profileError } = await admin.from("profiles")
    .select("user_id,email").in("user_id", userIds);
  if (profileError) throw new Error(`expiry_identity:${profileError.message}`);
  const charges = await reads.charges();
  for (const sub of batch) {
    result.checked++;
    try {
      const profile = (profiles ?? []).find((p: { user_id: string; email?: string }) => p.user_id === sub.user_id);
      if (!profile?.email || !sub.validapay_subscription_id?.startsWith("sub_")) { result.unconfirmed++; continue; }
      const account = locals.filter(row => row.user_id === sub.user_id);
      const provider = await reads.provider(sub.validapay_subscription_id);
      const payments = recentPaidCharges(charges, account.map(row => row.validapay_subscription_id ?? ""),
        [profile.email, provider.email ?? "", provider.customer?.email ?? ""], now);
      if (account.some(row => row.purchase_kind === "lifetime") || payments.length ||
        bestAccessSubscription(account.filter(row => row.id !== sub.id), now)) { result.protected++; continue; }
      const target = expiredProviderTarget(sub, provider.status, false, false, now);
      if (!target) { result.unconfirmed++; continue; }
      const correctionId = `hourly-expiry-${new Date(now).toISOString().slice(0, 13)}`;
      const { error: backupError } = await admin.from("subscription_status_correction_backup").upsert({
        correction_id: correctionId, id: sub.id, user_id: sub.user_id, status: sub.status,
        current_period_end: sub.current_period_end, atualizado_em: sub.updated_at,
        target_status: target, batch_number: 1, provider_status: provider.status,
        evidence: { checked_at: new Date(now).toISOString(), paid_last_35_days: false,
          lifetime_account: false, provider_subscription_id: sub.validapay_subscription_id },
      }, { onConflict: "correction_id,id", ignoreDuplicates: true });
      if (backupError) throw new Error(`expiry_backup:${backupError.message}`);
      let update = admin.from("subscriptions").update({ status: target, updated_at: new Date(now).toISOString() })
        .eq("id", sub.id).eq("status", "active").eq("provider", "validapay")
        .eq("purchase_kind", sub.purchase_kind).eq("current_period_end", sub.current_period_end)
        .eq("validapay_subscription_id", sub.validapay_subscription_id);
      update = sub.updated_at ? update.eq("updated_at", sub.updated_at) : update.is("updated_at", null);
      const { data: changed, error: updateError } = await update.select("id").maybeSingle();
      if (updateError) throw new Error(`expiry_update:${updateError.message}`);
      if (!changed) { result.conflicts++; continue; }
      result[target]++;
      const { error: markError } = await admin.from("subscription_status_correction_backup")
        .update({ applied_at: new Date(now).toISOString(), applied_status: target })
        .eq("correction_id", correctionId).eq("id", sub.id);
      if (markError) throw new Error(`expiry_backup_mark:${markError.message}`);
    } catch (error) {
      result.unconfirmed++;
      console.error("subscription-expiry-audit", sub.id, error instanceof Error ? error.message : "read_failed");
    }
  }
  return result;
}