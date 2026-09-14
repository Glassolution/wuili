export type LocalSandboxSubscription = {
  id: string;
  plan: string;
  status: string;
  amount: number;
  provider: "sandbox";
  mp_payment_id: string | null;
  payment_method: "sandbox";
  created_at: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type LocalSandboxRefund = {
  id: string;
  subscription_id: string;
  status: string;
  reason: string;
  reason_details: string;
  requested_at: string;
};

const subscriptionsKey = (accountKey?: string | null) => `velo:sandbox-subscriptions:${accountKey ?? "anonymous"}`;
const refundsKey = (accountKey?: string | null) => `velo:sandbox-refunds:${accountKey ?? "anonymous"}`;
const CHANGE_EVENT = "velo:sandbox-data-change";

const readJson = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(CHANGE_EVENT));
};

export const listenLocalSandboxData = (handler: () => void) => {
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
};

export const getLocalSandboxSubscriptions = (accountKey?: string | null) =>
  readJson<LocalSandboxSubscription[]>(subscriptionsKey(accountKey), []);

export const getLocalSandboxRefunds = (accountKey?: string | null) =>
  readJson<LocalSandboxRefund[]>(refundsKey(accountKey), []);

export const createLocalSandboxSubscription = (
  accountKey: string | null | undefined,
  plan: string,
  cycle: "monthly" | "annual" = "monthly",
) => {
  const now = new Date();
  const periodEnd = new Date(now);
  if (cycle === "annual") periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  else periodEnd.setMonth(periodEnd.getMonth() + 1);

  const next: LocalSandboxSubscription = {
    id: `local-sandbox-${crypto.randomUUID()}`,
    plan,
    status: "active",
    amount: 0,
    provider: "sandbox",
    mp_payment_id: null,
    payment_method: "sandbox",
    created_at: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    cancel_at_period_end: false,
  };

  const previous = getLocalSandboxSubscriptions(accountKey).map((sub) =>
    sub.status === "active"
      ? { ...sub, status: "cancelled", cancel_at_period_end: true }
      : sub,
  );
  writeJson(subscriptionsKey(accountKey), [next, ...previous]);
  return next;
};

export const createLocalSandboxRefund = (
  accountKey: string | null | undefined,
  subscriptionId: string,
  reason: string,
  reasonDetails: string,
) => {
  const now = new Date().toISOString();
  const refund: LocalSandboxRefund = {
    id: `local-refund-${crypto.randomUUID()}`,
    subscription_id: subscriptionId,
    status: "pending",
    reason,
    reason_details: reasonDetails,
    requested_at: now,
  };
  writeJson(refundsKey(accountKey), [refund, ...getLocalSandboxRefunds(accountKey)]);
  writeJson(
    subscriptionsKey(accountKey),
    getLocalSandboxSubscriptions(accountKey).map((sub) =>
      sub.id === subscriptionId
        ? { ...sub, cancel_at_period_end: true }
        : sub,
    ),
  );
  return refund;
};
