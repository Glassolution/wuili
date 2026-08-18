import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  MoreHorizontal,
  ShoppingBag,
  UserMinus,
  type LucideIcon,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  | "id"
  | "user_id"
  | "plan"
  | "amount"
  | "status"
  | "payment_method"
  | "mp_payment_id"
  | "provider"
  | "validapay_charge_id"
  | "validapay_subscription_id"
  | "charge_attempts"
  | "last_charge_attempt_at"
  | "current_period_start"
  | "current_period_end"
  | "next_charge_at"
  | "created_at"
  | "updated_at"
>;

type RefundRow = {
  payment_id: string | null;
  refund_amount: number | string | null;
  processed_at: string | null;
  status: string | null;
};

type ValidaPayEventRow = Pick<
  Database["public"]["Tables"]["validapay_webhook_events"]["Row"],
  "id" | "event" | "charge_id" | "subscription_id" | "payment_id" | "status" | "amount" | "payload" | "created_at"
>;

type FinanceActivity = {
  id: string;
  user_id: string | null;
  payer_name: string | null;
  payer_email: string | null;
  amount: number;
  status: string;
  payment_method: string | null;
  plan: string | null;
  interval: "Mensal" | "Anual";
  created_at: string;
  source: "validapay" | "database";
};

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "user_id" | "display_name" | "email"
>;

type AdminUserIdentity = {
  user_id: string;
  name: string | null;
  email: string | null;
};

type WalletData = {
  subscriptions: SubscriptionRow[];
  profiles: ProfileRow[];
  users: AdminUserIdentity[];
  refunds: RefundRow[];
  validapayEvents: ValidaPayEventRow[];
  validapayAvailable: boolean;
};

type ValidaPayBalance = {
  available: number;
  blocked: number | null;
  receivable: number | null;
};

type FinanceData = {
  provider: "validapay";
  source: "providers" | "database";
  activity_source?: "validapay_webhooks" | "database";
  balance?: ValidaPayBalance | null;
  metrics: {
    approved_sales: number;
    gross_revenue: number;
    refunds: number;
    fees: number;
    costs: number;
    withdrawals: number;
    net_revenue: number;
  };
  series: {
    revenue: Array<{ key: string; value: number }>;
    costs: Array<{ key: string; value: number }>;
  };
  activities?: FinanceActivity[];
};

const EMPTY_DATA: WalletData = {
  subscriptions: [],
  profiles: [],
  users: [],
  refunds: [],
  validapayEvents: [],
  validapayAvailable: false,
};

type Period = "year" | "month" | "day";

const PERIOD_STORAGE_KEY = "velo:admin-wallet-period";
const ACTIVITY_PAGE_SIZE = 10;
const PAID_STATUSES = new Set(["active", "paid", "approved", "trialing"]);
const CHURN_STATUSES = new Set([
  "cancelled",
  "canceled",
  "rejected",
  "failed",
  "past_due",
]);
const BILLING_ACTIVITY_STATUSES = new Set([
  "active",
  "paid",
  "approved",
  "trialing",
  "pending",
  "in_process",
  "authorized",
  "cancelled",
  "canceled",
  "rejected",
  "failed",
  "past_due",
  "suspended_payment_pending",
  "refunded",
]);
const REFUND_STATUSES = new Set(["approved", "processed", "completed", "refunded"]);

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatPercent = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);

const formatDate = (value: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Belem",
  })
    .format(new Date(value))
    .replace(" de ", " ")
    .replace(" de ", " ");
};

const formatTime = (value: string | null) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "America/Belem",
  }).format(new Date(value));
};

const formatChargeDay = (value: string | null) => {
  if (!value) return "—";
  const day = new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    timeZone: "America/Belem",
  }).format(new Date(value));
  return `Dia ${day}`;
};

const getPlanLabel = (plan: string) => {
  const normalized = plan.trim().toLowerCase();
  if (!normalized) return "Não informado";
  if (normalized === "base") return "Velo Base";
  if (normalized === "pro" || normalized === "plus") return "Velo Pro";
  if (normalized === "business") return "Velo Business";
  return `Velo ${plan}`;
};

const getPaymentMethodLabel = (method: string | null) => {
  const normalized = String(method ?? "").trim().toLowerCase();
  if (normalized === "pix") return "Pix";
  if (["credit_card", "card", "credito"].includes(normalized)) return "Cartão de crédito";
  if (["debit_card", "debito"].includes(normalized)) return "Cartão de débito";
  if (normalized.includes("manual")) return "Pagamento manual";
  if (normalized === "trial") return "Período de teste";
  return method?.trim() || "Não informado";
};

const getBillingInterval = (subscription: SubscriptionRow) => {
  const method = String(subscription.payment_method ?? "").toLowerCase();
  if (method.includes("annual") || method.includes("anual")) return "Anual";

  if (subscription.current_period_start && subscription.current_period_end) {
    const start = new Date(subscription.current_period_start).getTime();
    const end = new Date(subscription.current_period_end).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end - start >= 300 * 24 * 60 * 60 * 1000) {
      return "Anual";
    }
  }

  // Os planos anuais existentes têm valor muito superior às mensalidades (R$ 39,90/R$ 79,80).
  if (Number(subscription.amount ?? 0) >= 300) return "Anual";
  return "Mensal";
};

// Na contingência do banco cada linha representa a tentativa criada no checkout.
// `updated_at` muda depois em cancelamentos e reembolsos e não pode ser usado
// como a data original da transação.
const subscriptionEventAt = (subscription: SubscriptionRow) =>
  subscription.created_at ||
  subscription.current_period_start ||
  subscription.last_charge_attempt_at ||
  subscription.updated_at;

const hasPaymentReference = (subscription: SubscriptionRow) =>
  [
    subscription.validapay_charge_id,
    subscription.validapay_subscription_id,
    subscription.mp_payment_id,
  ].some((value) => String(value ?? "").trim().length > 0);

const isValidaPaySubscription = (subscription: SubscriptionRow) => {
  const provider = String(subscription.provider ?? "").trim().toLowerCase();
  const legacyPaymentId = String(subscription.mp_payment_id ?? "").trim();
  return provider === "validapay" ||
    !!subscription.validapay_charge_id ||
    !!subscription.validapay_subscription_id ||
    (!!legacyPaymentId && !/^\d+$/.test(legacyPaymentId));
};

const getPeriodContext = (period: Period) => {
  const now = new Date();
  if (period === "day") return "hoje";
  if (period === "month") {
    const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(now);
    return `em ${month}`;
  }
  return `em ${now.getFullYear()}`;
};

const getStoredPeriod = (): Period => {
  if (typeof window === "undefined") return "year";
  const stored = window.localStorage.getItem(PERIOD_STORAGE_KEY);
  return stored === "day" || stored === "month" || stored === "year" ? stored : "year";
};

const getBelemDateKey = (value: string | Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Belem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const isInPeriod = (value: string | null, period: Period) => {
  if (!value) return false;
  const valueKey = getBelemDateKey(value);
  const todayKey = getBelemDateKey(new Date());
  if (period === "day") return valueKey === todayKey;
  if (period === "month") return valueKey.slice(0, 7) === todayKey.slice(0, 7);
  return valueKey.slice(0, 4) === todayKey.slice(0, 4);
};

const fetchAllSubscriptions = async () => {
  const rows: SubscriptionRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id,user_id,plan,amount,status,payment_method,mp_payment_id,provider,validapay_charge_id,validapay_subscription_id,charge_attempts,last_charge_attempt_at,current_period_start,current_period_end,next_charge_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as SubscriptionRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
};

const fetchAllProfiles = async () => {
  const rows: ProfileRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id,display_name,email")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as ProfileRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return rows;
};

const fetchAllValidaPayEvents = async () => {
  const rows: ValidaPayEventRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("validapay_webhook_events")
      .select("id,event,charge_id,subscription_id,payment_id,status,amount,payload,created_at")
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { rows: [], available: false };
    const page = (data ?? []) as ValidaPayEventRow[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return { rows, available: true };
};

const withTimeout = async <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const fetchWalletData = async (): Promise<WalletData> => {
  const [subscriptions, profiles, refunds, adminUsers, validapay] = await Promise.all([
    withTimeout(fetchAllSubscriptions(), 20_000, [] as SubscriptionRow[]),
    withTimeout(fetchAllProfiles(), 20_000, [] as ProfileRow[]),
    withTimeout(
      supabase
        .from("refund_requests")
        .select("payment_id,refund_amount,processed_at,status")
        .limit(1000)
        .then((result) => result),
      20_000,
      { data: [] as RefundRow[], error: null } as { data: RefundRow[] | null; error: unknown },
    ),
    // admin-users é pesado (lista todos os usuários do auth); nunca deve travar a carteira
    withTimeout(
      supabase.functions.invoke("admin-users") as Promise<{
        data: AdminUserIdentity[] | null;
        error: unknown;
      }>,
      8_000,
      { data: null, error: null },
    ),
    withTimeout(fetchAllValidaPayEvents(), 20_000, { rows: [] as ValidaPayEventRow[], available: false }),
  ]);

  return {
    subscriptions,
    profiles,
    users: Array.isArray(adminUsers.data) ? adminUsers.data : [],
    refunds: (refunds.data as RefundRow[] | null) ?? [],
    validapayEvents: validapay.rows,
    validapayAvailable: validapay.available,
  };
};


const fetchFinanceData = async (period: Period): Promise<FinanceData> => {
  const { data, error } = await supabase.functions.invoke("admin-wallet-finance", {
    body: { period },
  });
  if (error) throw error;
  if (!data?.metrics || !data?.series) throw new Error("Resposta financeira incompleta");
  if (data.provider !== "validapay") {
    throw new Error("A consolidação financeira ainda não está isolada na ValidaPay");
  }
  return data as FinanceData;
};

const deduplicateSubscriptions = (subscriptions: SubscriptionRow[]) => {
  const byPayment = new Map<string, SubscriptionRow>();
  const statusPriority = (status: string) => {
    const normalized = status.toLowerCase();
    if (PAID_STATUSES.has(normalized)) return 3;
    if (["pending", "in_process", "authorized"].includes(normalized)) return 2;
    return 1;
  };

  subscriptions.forEach((subscription) => {
    const paymentId = String(
      subscription.validapay_charge_id ??
      subscription.validapay_subscription_id ??
      subscription.mp_payment_id ??
      "",
    ).trim();
    const key = paymentId || `subscription:${subscription.id}`;
    const current = byPayment.get(key);
    if (!current) {
      byPayment.set(key, subscription);
      return;
    }
    const currentPriority = statusPriority(current.status);
    const nextPriority = statusPriority(subscription.status);
    const currentTime = new Date(subscriptionEventAt(current)).getTime();
    const nextTime = new Date(subscriptionEventAt(subscription)).getTime();
    if (nextPriority > currentPriority || (nextPriority === currentPriority && nextTime > currentTime)) {
      byPayment.set(key, subscription);
    }
  });

  return [...byPayment.values()];
};

const getSubscriptionStatus = (status: string) => {
  const normalized = status.toLowerCase();
  if (["paid", "approved", "completed"].includes(normalized)) {
    return { label: "Paga", tone: "success" as const };
  }
  if (["active", "trialing"].includes(normalized)) {
    return { label: "Ativa", tone: "success" as const };
  }
  if (["rejected", "failed", "past_due"].includes(normalized)) {
    return { label: "Falhou", tone: "danger" as const };
  }
  if (["pending", "in_process", "authorized", "suspended_payment_pending"].includes(normalized)) {
    return { label: "Pendente", tone: "warning" as const };
  }
  if (["cancelled", "canceled"].includes(normalized)) return { label: "Cancelada", tone: "neutral" as const };
  if (normalized === "refunded") return { label: "Reembolsada", tone: "neutral" as const };
  return { label: "Não reconhecido", tone: "neutral" as const };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const parseValidaPayAmount = (value: unknown): number | null => {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const normalized = typeof value === "string"
    ? value.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".")
    : value;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

const firstValidaPayAmount = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const amount = parseValidaPayAmount(record[key]);
    if (amount !== null) return amount;
  }
  return null;
};

// Alguns webhooks da ValidaPay incluem o saldo do livro-caixa após a transação.
// Ele é uma fonte real e pode sustentar a tela enquanto o endpoint de saldo não
// responde. Não inferimos saldo a partir de faturamento, reembolsos ou projeções.
const getBalanceFromValidaPayEvents = (events: ValidaPayEventRow[]): ValidaPayBalance | null => {
  const ordered = [...events].sort(
    (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
  );

  for (const event of ordered) {
    const payload = asRecord(event.payload);
    const data = asRecord(payload.data);
    const transaction = asRecord(payload.transaction);
    const dataTransaction = asRecord(data.transaction);
    const wallet = asRecord(payload.wallet);
    const dataWallet = asRecord(data.wallet);
    const balance = asRecord(payload.balance);
    const dataBalance = asRecord(data.balance);
    const candidates = [dataTransaction, transaction, dataWallet, wallet, dataBalance, balance, data, payload];

    for (const candidate of candidates) {
      const available = firstValidaPayAmount(candidate, [
        "availableBalance",
        "available_balance",
        "balanceAvailable",
        "saldoDisponivel",
        "balanceAfter",
        "balance_after",
      ]);
      if (available === null) continue;

      return {
        available,
        blocked: firstValidaPayAmount(candidate, [
          "blockedBalance",
          "blocked_balance",
          "balanceBlocked",
          "saldoBloqueado",
        ]),
        receivable: firstValidaPayAmount(candidate, [
          "receivableBalance",
          "receivable_balance",
          "pendingBalance",
          "balanceReceivable",
          "amountToReceive",
          "saldoAReceber",
        ]),
      };
    }
  }

  return null;
};

const normalizeValidaPayStatus = (status: string | null, event: string) => {
  const value = `${status ?? ""} ${event}`.toLowerCase();
  if (["refund", "refunded", "reembols"].some((word) => value.includes(word))) return "refunded";
  if (["cancel", "canceled", "cancelled", "expired"].some((word) => value.includes(word))) return "cancelled";
  if (["reject", "rejected", "fail", "failed", "denied"].some((word) => value.includes(word))) return "failed";
  if (["paid", "approved", "confirmed", "succeeded", "success"].some((word) => value.includes(word))) return "approved";
  return "pending";
};

const getValidaPayEventKey = (row: ValidaPayEventRow) =>
  row.charge_id || row.payment_id || row.subscription_id || row.id;

const AdminPainelPage = () => {
  const [period, setPeriod] = useState<Period>(getStoredPeriod);
  const [activityPage, setActivityPage] = useState(1);
  const activitySectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { data = EMPTY_DATA, isLoading, isError, isFetching } = useQuery({
    queryKey: ["admin-wallet-v8-validapay-only"],
    queryFn: fetchWalletData,
    refetchInterval: 30_000,
  });
  const {
    data: providerFinance,
    isError: isFinanceError,
    isLoading: isFinanceLoading,
    isFetching: isFinanceFetching,
  } = useQuery({
    queryKey: ["admin-wallet-finance-v2-validapay-only", period],
    queryFn: () => fetchFinanceData(period),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    window.localStorage.setItem(PERIOD_STORAGE_KEY, period);
  }, [period]);

  const identitiesByUser = useMemo(() => {
    const identities = new Map<string, AdminUserIdentity>();
    data.profiles.forEach((profile) => {
      identities.set(profile.user_id, {
        user_id: profile.user_id,
        name: profile.display_name,
        email: profile.email,
      });
    });
    data.users.forEach((user) => identities.set(user.user_id, user));
    return identities;
  }, [data.profiles, data.users]);

  const uniqueSubscriptions = useMemo(
    () => deduplicateSubscriptions(data.subscriptions),
    [data.subscriptions],
  );

  const visibleSubscriptions = useMemo(
    () => {
      const subscriptions = uniqueSubscriptions.filter(
        (subscription) =>
          !data.validapayAvailable &&
          hasPaymentReference(subscription) &&
          isValidaPaySubscription(subscription) &&
          BILLING_ACTIVITY_STATUSES.has(String(subscription.status ?? "").toLowerCase()) &&
          isInPeriod(subscriptionEventAt(subscription), period),
      );
      return [...subscriptions].sort(
        (left, right) =>
          new Date(subscriptionEventAt(right)).getTime() - new Date(subscriptionEventAt(left)).getTime(),
      );
    },
    [data.validapayAvailable, uniqueSubscriptions, period],
  );

  const validapayActivities = useMemo<FinanceActivity[]>(() => {
    const latestByCharge = new Map<string, ValidaPayEventRow>();
    const subscriptionByCharge = new Map<string, SubscriptionRow>();
    const subscriptionByProviderId = new Map<string, SubscriptionRow>();
    uniqueSubscriptions.forEach((subscription) => {
      if (subscription.validapay_charge_id) subscriptionByCharge.set(subscription.validapay_charge_id, subscription);
      if (subscription.validapay_subscription_id) {
        subscriptionByProviderId.set(subscription.validapay_subscription_id, subscription);
      }
    });
    data.validapayEvents.forEach((row) => {
      const payload = asRecord(row.payload);
      const metadata = asRecord(payload.metadata);
      if (String(metadata.kind ?? "") === "store_order" || metadata.store_order_id) return;
      const key = getValidaPayEventKey(row);
      const current = latestByCharge.get(key);
      if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) {
        latestByCharge.set(key, row);
      }
    });

    const candidates = [...latestByCharge.values()].flatMap((row) => {
      const payload = asRecord(row.payload);
      const metadata = asRecord(payload.metadata);
      const customer = asRecord(payload.customer);
      const payer = asRecord(payload.payer);
      const eventAt = String(payload.paidAt ?? payload.createdAt ?? row.created_at);
      if (!isInPeriod(eventAt, period)) return [];
      const matchedSubscription =
        (row.charge_id ? subscriptionByCharge.get(row.charge_id) : undefined) ??
        (row.subscription_id ? subscriptionByProviderId.get(row.subscription_id) : undefined);
      const eventAmount = Number(row.amount ?? payload.amount ?? 0);
      const amount = eventAmount > 0 ? eventAmount : Number(matchedSubscription?.amount ?? 0);
      const plan = String(matchedSubscription?.plan ?? metadata.plan ?? payload.plan ?? "").trim() || null;
      const status = normalizeValidaPayStatus(row.status, row.event);
      return [{
        activity: {
          id: getValidaPayEventKey(row),
          user_id: matchedSubscription?.user_id ?? (String(metadata.user_id ?? metadata.userId ?? "").trim() || null),
          payer_name: String(customer.name ?? payer.name ?? "").trim() || null,
          payer_email: String(customer.email ?? "").trim() || null,
          amount: Number.isFinite(amount) ? amount : 0,
          status,
          payment_method: String(payload.paymentMethod ?? matchedSubscription?.payment_method ?? "").trim() || null,
          plan,
          interval: Number.isFinite(amount) && amount >= 300 ? "Anual" : "Mensal",
          created_at: eventAt,
          source: "validapay",
        } satisfies FinanceActivity,
        subscriptionId: row.subscription_id,
      }];
    });

    const resolvedSubscriptions = new Set(
      candidates
        .filter((candidate) => candidate.subscriptionId && candidate.activity.status !== "pending")
        .map((candidate) => candidate.subscriptionId as string),
    );

    return candidates
      .filter((candidate) => !(candidate.activity.status === "pending" && candidate.subscriptionId && resolvedSubscriptions.has(candidate.subscriptionId)))
      .map((candidate) => candidate.activity)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  }, [data.validapayEvents, period, uniqueSubscriptions]);

  const paidSubscriptionsInPeriod = useMemo(
    () =>
      uniqueSubscriptions.filter(
        (subscription) =>
          !data.validapayAvailable &&
          hasPaymentReference(subscription) &&
          isValidaPaySubscription(subscription) &&
          PAID_STATUSES.has(subscription.status.toLowerCase()) &&
          isInPeriod(subscriptionEventAt(subscription), period),
      ),
    [data.validapayAvailable, uniqueSubscriptions, period],
  );
  const approvedValidaPayActivities = useMemo(
    () => validapayActivities.filter((activity) => activity.status === "approved"),
    [validapayActivities],
  );
  const localGrossRevenue = useMemo(
    () =>
      paidSubscriptionsInPeriod.reduce((sum, subscription) => sum + Number(subscription.amount ?? 0), 0) +
      approvedValidaPayActivities.reduce((sum, activity) => sum + activity.amount, 0),
    [approvedValidaPayActivities, paidSubscriptionsInPeriod],
  );
  const localRefunds = useMemo(
    () => {
      const validapayReferences = new Set<string>();
      uniqueSubscriptions.forEach((subscription) => {
        if (!isValidaPaySubscription(subscription)) return;
        [subscription.validapay_charge_id, subscription.validapay_subscription_id, subscription.mp_payment_id]
          .filter((value): value is string => !!value)
          .forEach((value) => validapayReferences.add(value));
      });
      const databaseRefunds = data.refunds
        .filter(
          (item) =>
            !data.validapayAvailable &&
            REFUND_STATUSES.has(String(item.status ?? "").toLowerCase()) &&
            !!item.payment_id &&
            validapayReferences.has(item.payment_id) &&
            isInPeriod(item.processed_at, period),
        )
        .reduce((sum, item) => sum + Number(item.refund_amount ?? 0), 0);
      const validapayRefunds = validapayActivities
        .filter((activity) => activity.status === "refunded")
        .reduce((sum, activity) => sum + activity.amount, 0);
      return databaseRefunds + validapayRefunds;
    },
    [data.refunds, data.validapayAvailable, period, uniqueSubscriptions, validapayActivities],
  );

  const localFinance = useMemo<FinanceData>(() => ({
    provider: "validapay",
    source: data.validapayAvailable ? "providers" : "database",
    activity_source: data.validapayAvailable ? "validapay_webhooks" : "database",
    metrics: {
      approved_sales: paidSubscriptionsInPeriod.length + approvedValidaPayActivities.length,
      gross_revenue: localGrossRevenue,
      refunds: localRefunds,
      fees: 0,
      costs: localRefunds,
      withdrawals: 0,
      net_revenue: localGrossRevenue - localRefunds,
    },
    series: { revenue: [], costs: [] },
  }), [approvedValidaPayActivities.length, data.validapayAvailable, localGrossRevenue, localRefunds, paidSubscriptionsInPeriod.length]);
  const finance = providerFinance ?? localFinance;
  const eventWalletBalance = useMemo(
    () => getBalanceFromValidaPayEvents(data.validapayEvents),
    [data.validapayEvents],
  );
  const walletBalance = providerFinance?.balance ?? eventWalletBalance;
  const hasLocalFinanceRecords = data.validapayEvents.length > 0 || data.subscriptions.length > 0;
  const financialDataLoading = isLoading || (isFinanceLoading && !hasLocalFinanceRecords);
  const financialDataUnavailable = isError && isFinanceError && !hasLocalFinanceRecords;
  const hideFinancialValues = financialDataLoading || financialDataUnavailable;
  const panelRefreshing = (isFetching || isFinanceFetching) && !financialDataLoading;
  const walletBalanceDetails = walletBalance
    ? [
        walletBalance.blocked === null ? null : `Bloqueado ${formatBRL(walletBalance.blocked)}`,
        walletBalance.receivable === null ? null : `A receber ${formatBRL(walletBalance.receivable)}`,
      ].filter((value): value is string => value !== null).join(" · ")
    : "";
  const databaseActivities = useMemo<FinanceActivity[]>(
    () => visibleSubscriptions.map((subscription) => {
      const eventAt = subscriptionEventAt(subscription);
      return {
        id: String(subscription.mp_payment_id || subscription.id),
        user_id: subscription.user_id,
        payer_name: null,
        payer_email: null,
        amount: Number(subscription.amount ?? 0),
        status: subscription.status,
        payment_method: subscription.payment_method,
        plan: subscription.plan,
        interval: getBillingInterval(subscription),
        created_at: eventAt,
        source: "database",
      };
    }),
    [visibleSubscriptions],
  );
  const paymentActivities = useMemo(
    () => [...validapayActivities, ...databaseActivities].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    ),
    [databaseActivities, validapayActivities],
  );
  const usePaymentActivities = data.validapayAvailable;
  const activityCount = usePaymentActivities ? paymentActivities.length : visibleSubscriptions.length;
  const activityTotalPages = Math.max(1, Math.ceil(activityCount / ACTIVITY_PAGE_SIZE));
  const activityPageStart = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
  const paginatedPaymentActivities = paymentActivities.slice(
    activityPageStart,
    activityPageStart + ACTIVITY_PAGE_SIZE,
  );
  const paginatedSubscriptions = visibleSubscriptions.slice(
    activityPageStart,
    activityPageStart + ACTIVITY_PAGE_SIZE,
  );

  useEffect(() => {
    setActivityPage(1);
  }, [period]);

  useEffect(() => {
    setActivityPage((current) => Math.min(current, activityTotalPages));
  }, [activityTotalPages]);

  const changeActivityPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), activityTotalPages);
    setActivityPage(safePage);
    window.requestAnimationFrame(() => {
      activitySectionRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    });
  };

  const churnedSubscriptionsInPeriod = useMemo(
    () =>
      uniqueSubscriptions.filter(
        (subscription) =>
          isValidaPaySubscription(subscription) &&
          hasPaymentReference(subscription) &&
          CHURN_STATUSES.has(String(subscription.status ?? "").toLowerCase()) &&
          isInPeriod(subscriptionEventAt(subscription), period),
      ),
    [uniqueSubscriptions, period],
  );
  const churnBase = paidSubscriptionsInPeriod.length + churnedSubscriptionsInPeriod.length;
  const transactionalChurnCount = paymentActivities.filter(
    (activity) => ["refunded", "cancelled", "canceled"].includes(activity.status.toLowerCase()),
  ).length;
  const transactionalPaidCount = paymentActivities.filter(
    (activity) => ["active", "paid", "approved", "completed", "refunded"].includes(activity.status.toLowerCase()),
  ).length;
  const transactionalChurnBase = transactionalPaidCount + paymentActivities.filter(
    (activity) => ["cancelled", "canceled"].includes(activity.status.toLowerCase()),
  ).length;
  const churnRate = usePaymentActivities
    ? (transactionalChurnBase > 0 ? transactionalChurnCount / transactionalChurnBase : 0)
    : (churnBase > 0 ? churnedSubscriptionsInPeriod.length / churnBase : 0);
  const periodContext = getPeriodContext(period);

  const localRevenueSeries = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (13 - index));
      const dayKey = getBelemDateKey(date);
      return approvedValidaPayActivities.reduce((sum, item) => {
        return getBelemDateKey(item.created_at) === dayKey ? sum + item.amount : sum;
      }, 0);
    });
  }, [approvedValidaPayActivities]);

  const localCostSeries = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (13 - index));
      const dayKey = getBelemDateKey(date);
      return validapayActivities.reduce((sum, item) => {
        if (item.status !== "refunded") return sum;
        return getBelemDateKey(item.created_at) === dayKey ? sum + item.amount : sum;
      }, 0);
    });
  }, [validapayActivities]);
  const revenueSparklineValues = providerFinance?.series.revenue.map((item) => item.value) ?? localRevenueSeries;
  const costSparklineValues = providerFinance?.series.costs.map((item) => item.value) ?? localCostSeries;

  const downloadReport = () => {
    const activityRows = usePaymentActivities
      ? paymentActivities.map((activity) => {
          const identity = activity.user_id ? identitiesByUser.get(activity.user_id) : undefined;
          return [
            activity.id,
            activity.id,
            identity?.name || activity.payer_name || activity.payer_email || "Assinante não identificado",
            identity?.email || activity.payer_email || "—",
            formatChargeDay(activity.created_at),
            formatDate(activity.created_at),
            formatTime(activity.created_at),
            activity.interval,
            activity.amount > 0 ? formatBRL(activity.amount) : "—",
            getPlanLabel(activity.plan ?? ""),
            getPaymentMethodLabel(activity.payment_method),
            getSubscriptionStatus(activity.status).label,
          ];
        })
      : visibleSubscriptions.map((subscription) => {
          const identity = identitiesByUser.get(subscription.user_id);
          const eventAt = subscriptionEventAt(subscription);
          const chargeAt = subscription.next_charge_at || subscription.current_period_start || eventAt;
          return [
            subscription.id,
            subscription.mp_payment_id || "—",
            identity?.name || "Assinante não identificado",
            identity?.email || "—",
            formatChargeDay(chargeAt),
            formatDate(eventAt),
            formatTime(eventAt),
            getBillingInterval(subscription),
            formatBRL(Number(subscription.amount ?? 0)),
            getPlanLabel(subscription.plan),
            getPaymentMethodLabel(subscription.payment_method),
            getSubscriptionStatus(subscription.status).label,
          ];
        });
    const rows = [
      ["Assinatura", "Pagamento ValidaPay", "Assinante", "E-mail", "Dia de cobrança", "Data", "Horário", "Intervalo", "Valor", "Produto", "Método de pagamento", "Status"],
      ...activityRows,
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).split('"').join('""')}"`).join(";"))
      .join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `assinaturas-velo-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell active="dashboard" userId="admin" fullBleed>
      <motion.div
        className="relative min-h-full overflow-hidden bg-white px-5 pb-10 pt-5 text-[#171717] sm:px-[22px] lg:pt-6"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
        transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence>
          {panelRefreshing ? <PanelRefreshIndicator /> : null}
        </AnimatePresence>
        <motion.header
          className="flex items-center justify-between gap-4"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.38, delay: reduceMotion ? 0 : 0.04 }}
        >
          <div className="flex items-center gap-4">
            <h1 className="text-[19px] font-semibold tracking-[-0.035em]">Carteira</h1>
            <PeriodFilter value={period} onChange={setPeriod} />
            <span className="hidden text-[10px] font-medium text-[#999994] md:inline">
              {providerFinance?.source === "providers"
                ? "Extrato financeiro da ValidaPay"
                : data.validapayAvailable
                ? "Eventos confirmados da ValidaPay"
                : providerFinance?.source === "database"
                ? "Registros confirmados da ValidaPay"
                : isFinanceError
                ? "Extrato da ValidaPay indisponível · exibindo apenas registros ValidaPay confirmados"
                : "Conectando ao extrato da ValidaPay..."}
            </span>
          </div>
          <button
            type="button"
            onClick={downloadReport}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#171717] px-4 text-[12px] font-semibold text-white shadow-[0_1px_0_rgba(0,0,0,0.18)] transition hover:bg-black focus:outline-none focus:ring-2 focus:ring-black/20"
          >
            <Download size={14} strokeWidth={1.8} />
            Baixar relatório
          </button>
        </motion.header>

        <motion.section
          className="mt-7 grid border-b border-[#eeeeec] lg:grid-cols-2"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.46, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <WalletMetric
            title={walletBalance ? "Saldo disponível na ValidaPay" : `Resultado líquido ${periodContext}`}
            value={hideFinancialValues ? null : walletBalance?.available ?? finance.metrics.net_revenue}
            description={walletBalance
              ? "Valor disponível agora para movimentação ou saque"
              : "Entradas menos saídas registradas no período; não representa o saldo disponível"}
            action={walletBalance
              ? walletBalanceDetails || "Saldo obtido do último evento confirmado da ValidaPay"
              : financialDataUnavailable
              ? "Não foi possível consultar dados financeiros da ValidaPay"
              : "Saldo oficial da ValidaPay ainda sem conexão"}
            values={revenueSparklineValues}
            loading={financialDataLoading}
          />
          <WalletMetric
            title={`Total de saídas ${periodContext}`}
            value={hideFinancialValues ? null : finance.metrics.costs}
            description="Débitos efetivamente registrados no extrato da ValidaPay"
            action={`Reembolsos ${formatBRL(finance.metrics.refunds)} · Taxas ${formatBRL(finance.metrics.fees)} · Saques ${formatBRL(finance.metrics.withdrawals)}`}
            values={costSparklineValues}
            loading={financialDataLoading}
            divided
          />
        </motion.section>

        <motion.section
          className="mt-5"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.46, delay: reduceMotion ? 0 : 0.17, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em]">Resumo de atividades</h2>
            <PeriodFilter value={period} onChange={setPeriod} />
          </div>

          <div className="mt-5 grid min-h-[80px] overflow-hidden rounded-[3px] border border-[#f0f0ee] bg-white shadow-[0_8px_24px_rgba(28,28,24,0.018)] sm:grid-cols-3">
            <SummaryItem
              icon={ShoppingBag}
              label="Vendas aprovadas"
              value={hideFinancialValues ? null : finance.metrics.approved_sales}
              format="integer"
              loading={financialDataLoading}
            />
            <SummaryItem
              icon={CircleDollarSign}
              label="Total de entradas"
              value={hideFinancialValues ? null : finance.metrics.gross_revenue}
              format="currency"
              loading={financialDataLoading}
            />
            <SummaryItem
              icon={UserMinus}
              label="Taxa de churn"
              value={hideFinancialValues ? null : churnRate}
              format="percent"
              loading={financialDataLoading}
            />
          </div>
        </motion.section>

        <motion.section
          ref={activitySectionRef}
          className="mt-7"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[18px] font-semibold tracking-[-0.03em]">Atividade recente</h2>
            <div className="flex items-center gap-3">
              <PeriodFilter value={period} onChange={setPeriod} />
              <button type="button" aria-label="Mais opções" className="grid h-8 w-8 place-items-center rounded-full text-[#73736f] hover:bg-[#f4f4f2]">
                <MoreHorizontal size={17} />
              </button>
            </div>
          </div>

          <div className="mt-2 overflow-hidden rounded-[2px] border border-[#f0f0ee]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f6f6f5] text-[11px] font-semibold text-[#5f5f5b]">
                    <th className="px-4 py-3">Assinante</th>
                    <th className="px-4 py-3">Dia de cobrança</th>
                    <th className="px-4 py-3">Intervalo</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Método de pagamento</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? <ActivityTableSkeleton /> : usePaymentActivities ? paginatedPaymentActivities.map((activity, index) => {
                    const status = getSubscriptionStatus(activity.status);
                    const identity = activity.user_id ? identitiesByUser.get(activity.user_id) : undefined;
                    const name = identity?.name || activity.payer_name || activity.payer_email || "Assinante não identificado";
                    const email = identity?.email || activity.payer_email;
                    return (
                      <motion.tr
                        key={`payment:${activity.id}`}
                        className="border-t border-[#f2f2f0] text-[12px] text-[#222220] transition-colors hover:bg-[#fafaf9]"
                        initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.32, delay: reduceMotion ? 0 : Math.min(index, 10) * 0.035 }}
                      >
                        <td className="max-w-[220px] px-4 py-3.5">
                          <p className="truncate font-semibold">{name}</p>
                          {email && email !== name ? <p className="mt-1 truncate text-[10px] text-[#92928d]">{email}</p> : null}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-[#555550]">{formatChargeDay(activity.created_at)}</p>
                          <p className="mt-1 text-[10px] text-[#888883]">{formatDate(activity.created_at)} · {formatTime(activity.created_at)}</p>
                        </td>
                        <td className="px-4 py-3.5"><span className="rounded-full border border-[#d9dce6] bg-[#f4f5f9] px-2.5 py-1 font-medium text-[#394867]">{activity.interval}</span></td>
                        <td className="px-4 py-3.5 font-semibold">{activity.amount > 0 ? formatBRL(activity.amount) : "—"}</td>
                        <td className="px-4 py-3.5 font-medium">{getPlanLabel(activity.plan ?? "")}</td>
                        <td className="px-4 py-3.5"><p className="font-medium">{getPaymentMethodLabel(activity.payment_method)}</p></td>
                        <td className="px-4 py-3.5" title={`Status registrado: ${activity.status}`}><StatusBadge label={status.label} tone={status.tone} /></td>
                      </motion.tr>
                    );
                  }) : paginatedSubscriptions.map((subscription, index) => {
                    const status = getSubscriptionStatus(subscription.status);
                    const identity = identitiesByUser.get(subscription.user_id);
                    const eventAt = subscriptionEventAt(subscription);
                    const chargeAt = subscription.next_charge_at || subscription.current_period_start || eventAt;
                    return (
                      <motion.tr
                        key={subscription.id}
                        className="border-t border-[#f2f2f0] text-[12px] text-[#222220] transition-colors hover:bg-[#fafaf9]"
                        initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.32, delay: reduceMotion ? 0 : Math.min(index, 10) * 0.035 }}
                      >
                        <td className="max-w-[220px] px-4 py-3.5">
                          <p className="truncate font-semibold">{identity?.name || identity?.email || "Assinante não identificado"}</p>
                          {identity?.name && identity.email ? <p className="mt-1 truncate text-[10px] text-[#92928d]">{identity.email}</p> : null}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-[#555550]">{formatChargeDay(chargeAt)}</p>
                          <p className="mt-1 text-[10px] text-[#888883]">{formatDate(eventAt)} · {formatTime(eventAt)}</p>
                        </td>
                        <td className="px-4 py-3.5"><span className="rounded-full border border-[#d9dce6] bg-[#f4f5f9] px-2.5 py-1 font-medium text-[#394867]">{getBillingInterval(subscription)}</span></td>
                        <td className="px-4 py-3.5 font-semibold">{formatBRL(Number(subscription.amount ?? 0))}</td>
                        <td className="px-4 py-3.5 font-medium">{getPlanLabel(subscription.plan)}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium">{getPaymentMethodLabel(subscription.payment_method)}</p>
                          {subscription.charge_attempts > 0 ? <p className="mt-1 text-[10px] text-[#92928d]">{subscription.charge_attempts} tentativa{subscription.charge_attempts === 1 ? "" : "s"}</p> : null}
                        </td>
                        <td className="px-4 py-3.5" title={`Status registrado: ${subscription.status}`}>
                          <StatusBadge label={status.label} tone={status.tone} />
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!isLoading && isError ? (
              <div className="grid min-h-40 place-items-center px-6 text-center text-[12px] text-[#9b3d3d]">
                Não foi possível carregar os dados do painel.
              </div>
            ) : null}
            {!isLoading && !isError && activityCount === 0 ? (
              <div className="grid min-h-40 place-items-center px-6 text-center text-[12px] text-[#777772]">
                Nenhuma assinatura encontrada neste período.
              </div>
            ) : null}
            {!isLoading && !isError && activityCount > 0 ? (
              <ActivityPagination
                page={activityPage}
                totalPages={activityTotalPages}
                totalItems={activityCount}
                pageSize={ACTIVITY_PAGE_SIZE}
                onPageChange={changeActivityPage}
              />
            ) : null}
          </div>
        </motion.section>
      </motion.div>
    </AdminShell>
  );
};

const WalletMetric = ({
  title,
  value,
  description,
  action,
  values,
  loading,
  divided = false,
}: {
  title: string;
  value: number | null;
  description: string;
  action: string;
  values: number[];
  loading: boolean;
  divided?: boolean;
}) => {
  return (
  <article className={`relative min-h-[154px] pb-4 ${divided ? "lg:border-l lg:border-[#f0f0ee] lg:pl-8" : "lg:pr-8"}`}>
    <p className="text-[13px] font-semibold tracking-[-0.01em]">{title}</p>
    <div className="mt-5 flex items-start justify-between gap-4 pl-4">
      <div className="min-w-0">
        {loading ? (
          <LoadingShimmer className="h-8 w-40 sm:w-52" />
        ) : (
          <AnimatedMetricNumber
            value={value}
            format="currency"
            className="block whitespace-nowrap text-[29px] font-medium leading-none tracking-[-0.045em] sm:text-[33px]"
          />
        )}
        {loading ? <LoadingShimmer className="mt-3 h-2.5 w-56 max-w-full" delay={0.08} /> : (
          <motion.p
            key={description}
            className="mt-3 text-[11px] text-[#999994]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {description}
          </motion.p>
        )}
      </div>
      <MiniLedger values={values} loading={loading} />
    </div>
    {loading ? <LoadingShimmer className="ml-4 mt-5 h-2.5 w-44" delay={0.15} /> : (
      <motion.button
        key={action}
        type="button"
        className="mt-5 pl-4 text-[11px] font-semibold text-[#555550] hover:text-black"
        initial={{ opacity: 0, y: 3 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28 }}
      >
        {action}
      </motion.button>
    )}
  </article>
  );
};

const MiniLedger = ({ values, loading }: { values: number[]; loading: boolean }) => {
  const reduceMotion = useReducedMotion();
  if (loading) {
    return (
      <div className="mt-[-4px] flex h-[54px] w-[88px] shrink-0 items-end justify-between px-1 pb-1" aria-hidden="true">
        {Array.from({ length: 11 }, (_, index) => (
          <motion.span
            key={index}
            className="w-px origin-bottom bg-[#d5d5d1]"
            initial={{ height: 8, opacity: 0.45 }}
            animate={reduceMotion ? undefined : { height: [8, 14 + (index % 4) * 4, 8], opacity: [0.45, 0.9, 0.45] }}
            transition={{ duration: 1.15, delay: index * 0.045, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    );
  }

  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => `${index * (72 / Math.max(values.length - 1, 1))},${34 - (value / max) * 22}`)
    .join(" ");

  return (
    <svg viewBox="0 0 76 42" className="mt-[-4px] h-[54px] w-[88px] shrink-0 overflow-visible" aria-hidden="true">
      {values.map((value, index) => {
        const x = index * (72 / Math.max(values.length - 1, 1));
        const y = 34 - (value / max) * 22;
        return (
          <motion.line
            key={`${x}-${value}`}
            x1={x}
            y1={y}
            x2={x}
            y2="39"
            stroke="#a7a7a2"
            strokeWidth="1"
            initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : index * 0.025 }}
          />
        );
      })}
      <motion.polyline
        key={points}
        points={points}
        fill="none"
        stroke="#5d5d59"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.72, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
};

type MetricFormat = "currency" | "integer" | "percent";

const formatMetricValue = (value: number, format: MetricFormat) => {
  if (format === "currency") return formatBRL(value);
  if (format === "percent") return formatPercent(value);
  return Math.round(value).toLocaleString("pt-BR");
};

const AnimatedMetricNumber = ({
  value,
  format,
  className,
}: {
  value: number | null;
  format: MetricFormat;
  className?: string;
}) => {
  const reduceMotion = useReducedMotion();
  const previousValue = useRef(0);
  const [displayValue, setDisplayValue] = useState(value ?? 0);

  useEffect(() => {
    if (value === null) return;
    if (reduceMotion) {
      previousValue.current = value;
      setDisplayValue(value);
      return;
    }

    const controls = animate(previousValue.current, value, {
      duration: 0.82,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: setDisplayValue,
    });
    previousValue.current = value;
    return () => controls.stop();
  }, [reduceMotion, value]);

  if (value === null) return <span className={className}>—</span>;

  return (
    <motion.span
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 5, filter: "blur(3px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: reduceMotion ? 0 : 0.34 }}
      aria-label={formatMetricValue(value, format)}
    >
      {formatMetricValue(displayValue, format)}
    </motion.span>
  );
};

const SummaryItem = ({
  icon: Icon,
  label,
  value,
  format,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  format: MetricFormat;
  loading: boolean;
}) => (
  <motion.article
    className="flex min-h-[80px] items-center gap-3 border-b border-[#efefed] px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 lg:px-7"
    whileHover={{ backgroundColor: "#fafaf8" }}
    transition={{ duration: 0.2 }}
  >
    <span className="grid h-7 w-7 shrink-0 place-items-center text-[#666661]"><Icon size={17} strokeWidth={1.65} /></span>
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#62625d]">
        {label}<ChevronDown size={12} strokeWidth={1.8} />
      </p>
    </div>
    {loading ? <LoadingShimmer className="h-5 w-20" /> : (
      <AnimatedMetricNumber
        value={value}
        format={format}
        className="block truncate text-[18px] font-semibold tracking-[-0.035em] text-[#1d1d1b]"
      />
    )}
  </motion.article>
);

const LoadingShimmer = ({ className, delay = 0 }: { className: string; delay?: number }) => {
  const reduceMotion = useReducedMotion();
  return (
    <span className={`relative block overflow-hidden rounded-sm bg-[#eeeeeb] ${className}`} aria-hidden="true">
      <motion.span
        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/90 to-transparent"
        initial={{ x: "-120%" }}
        animate={reduceMotion ? { opacity: [0.35, 0.8, 0.35] } : { x: ["-120%", "240%"] }}
        transition={{
          duration: reduceMotion ? 1.4 : 1.25,
          delay,
          repeat: Infinity,
          repeatDelay: 0.12,
          ease: "easeInOut",
        }}
      />
    </span>
  );
};

const PanelRefreshIndicator = () => (
  <motion.div
    className="pointer-events-none absolute inset-x-0 top-0 z-30 h-px overflow-hidden bg-[#ededeb]"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.span
      className="block h-full w-[28%] bg-gradient-to-r from-transparent via-[#292927] to-transparent"
      initial={{ x: "-120%" }}
      animate={{ x: "460%" }}
      transition={{ duration: 1.05, repeat: Infinity, ease: [0.4, 0, 0.2, 1] }}
    />
  </motion.div>
);

const ActivityTableSkeleton = () => (
  <>
    {Array.from({ length: 6 }, (_, rowIndex) => (
      <motion.tr
        key={rowIndex}
        className="border-t border-[#f2f2f0]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28, delay: rowIndex * 0.045 }}
      >
        <td className="px-4 py-3.5">
          <LoadingShimmer className="h-3 w-36" delay={rowIndex * 0.04} />
          <LoadingShimmer className="mt-2 h-2 w-44" delay={0.08 + rowIndex * 0.04} />
        </td>
        <td className="px-4 py-3.5">
          <LoadingShimmer className="h-3 w-14" delay={0.04 + rowIndex * 0.04} />
          <LoadingShimmer className="mt-2 h-2 w-28" delay={0.1 + rowIndex * 0.04} />
        </td>
        <td className="px-4 py-3.5"><LoadingShimmer className="h-6 w-16 rounded-full" delay={0.08 + rowIndex * 0.04} /></td>
        <td className="px-4 py-3.5"><LoadingShimmer className="h-3 w-16" delay={0.12 + rowIndex * 0.04} /></td>
        <td className="px-4 py-3.5"><LoadingShimmer className="h-3 w-20" delay={0.16 + rowIndex * 0.04} /></td>
        <td className="px-4 py-3.5"><LoadingShimmer className="h-3 w-24" delay={0.2 + rowIndex * 0.04} /></td>
        <td className="px-4 py-3.5"><LoadingShimmer className="h-6 w-16 rounded-full" delay={0.24 + rowIndex * 0.04} /></td>
      </motion.tr>
    ))}
  </>
);

const ActivityPagination = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) => {
  const visiblePageCount = Math.min(5, totalPages);
  const firstVisiblePage = Math.max(1, Math.min(page - 2, totalPages - visiblePageCount + 1));
  const pages = Array.from({ length: visiblePageCount }, (_, index) => firstVisiblePage + index);
  const rangeStart = (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalItems);

  return (
    <motion.footer
      className="flex flex-col gap-3 border-t border-[#eeeeec] bg-[#fcfcfb] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <p className="text-[10px] font-medium text-[#878781]">
        Exibindo <span className="font-semibold text-[#50504b]">{rangeStart}–{rangeEnd}</span> de {totalItems} atividades
      </p>
      <div className="flex items-center gap-1" aria-label="Paginação das atividades">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
          className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-[#6f6f69] transition hover:border-[#e4e4df] hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={13} strokeWidth={1.8} />
        </button>
        {firstVisiblePage > 1 ? <span className="px-1 text-[10px] text-[#9b9b95]">…</span> : null}
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? "page" : undefined}
            aria-label={`Página ${pageNumber}`}
            className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[10px] font-semibold transition ${
              pageNumber === page
                ? "bg-[#20201e] text-white shadow-[0_1px_2px_rgba(0,0,0,0.16)]"
                : "text-[#73736d] hover:bg-white hover:text-[#20201e]"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        {firstVisiblePage + visiblePageCount - 1 < totalPages ? (
          <span className="px-1 text-[10px] text-[#9b9b95]">…</span>
        ) : null}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Próxima página"
          className="grid h-7 w-7 place-items-center rounded-md border border-transparent text-[#6f6f69] transition hover:border-[#e4e4df] hover:bg-white disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight size={13} strokeWidth={1.8} />
        </button>
      </div>
    </motion.footer>
  );
};

const PeriodFilter = ({
  value,
  onChange,
}: {
  value: Period;
  onChange: (value: Period) => void;
}) => (
  <motion.label
    className="relative inline-flex h-8 items-center rounded-md text-[#666661] transition hover:bg-[#f5f5f3]"
    whileTap={{ scale: 0.97 }}
  >
    <span className="sr-only">Selecionar período</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Period)}
      className="h-8 cursor-pointer appearance-none rounded-md bg-transparent py-0 pl-2 pr-7 text-[12px] font-semibold outline-none"
    >
      <option value="year">Ano atual</option>
      <option value="month">Mês atual</option>
      <option value="day">Hoje</option>
    </select>
    <ChevronDown size={12} className="pointer-events-none absolute right-2" />
  </motion.label>
);

const StatusBadge = ({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "danger" | "warning" | "neutral";
}) => {
  const toneClass = {
    success: "bg-[#f0faeb] text-[#65a64b]",
    danger: "bg-[#fff0f1] text-[#d9757c]",
    warning: "bg-[#fff7df] text-[#b47a18]",
    neutral: "bg-[#f2f2f0] text-[#777772]",
  }[tone];

  return (
    <motion.span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold ${toneClass}`}
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {label}
    </motion.span>
  );
};

export default AdminPainelPage;
