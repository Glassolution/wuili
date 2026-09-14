import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarRange,
  GitCompare,
  Download,
  Globe,
  Search,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import {
  AdminBadge,
  AdminCard,
  AdminChartCard,
  AdminKPIStat,
  AdminPill,
  AdminProgressBar,
  AdminSelectPill,
  AdminTableHeader,
} from "@/components/admin/AdminPrimitives";
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

type Period =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last3m"
  | "year";

/** Agrupamento dos pontos do gráfico. */
type Grouping = "hour" | "day" | "week" | "month";

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
type ActivityStatusFilter = "all" | "approved" | "pending" | "issue";

const matchesActivityStatusFilter = (status: string, filter: ActivityStatusFilter) => {
  if (filter === "all") return true;
  const normalizedStatus = status.toLowerCase();
  if (filter === "approved") {
    return ["active", "paid", "approved", "trialing", "completed"].includes(normalizedStatus);
  }
  if (filter === "pending") {
    return ["pending", "in_process", "authorized", "suspended_payment_pending"].includes(normalizedStatus);
  }
  return ["refunded", "cancelled", "canceled", "rejected", "failed", "past_due"].includes(normalizedStatus);
};

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
  // o provedor manda "credit_card" e "creditcard" — compara sem separadores
  const compact = normalized.replace(/[^a-z]/g, "");
  if (compact === "pix") return "Pix";
  if (["creditcard", "card", "credito", "cartaodecredito"].includes(compact)) return "Cartão de crédito";
  if (["debitcard", "debito", "cartaodedebito"].includes(compact)) return "Cartão de débito";
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

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "this_week", label: "Esta semana" },
  { value: "last_week", label: "Semana passada" },
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "last3m", label: "Últimos 3 meses" },
  { value: "year", label: "Este ano" },
];

const COMPARE_OPTIONS: Array<{ value: "previous" | "none"; label: string }> = [
  { value: "previous", label: "Comparar período anterior" },
  { value: "none", label: "Sem comparação" },
];

const GROUPING_OPTIONS: Array<{ value: Grouping | "auto"; label: string }> = [
  { value: "auto", label: "Agrupamento automático" },
  { value: "hour", label: "Por hora" },
  { value: "day", label: "Por dia" },
  { value: "week", label: "Por semana" },
  { value: "month", label: "Por mês" },
];

const getPeriodLabel = (period: Period) =>
  PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Período";

const getPeriodContext = (period: Period) => {
  const now = new Date();
  const monthName = (date: Date) => new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  switch (period) {
    case "today":
      return "hoje";
    case "yesterday":
      return "ontem";
    case "last7":
      return "nos últimos 7 dias";
    case "last30":
      return "nos últimos 30 dias";
    case "this_week":
      return "nesta semana";
    case "last_week":
      return "na semana passada";
    case "this_month":
      return `em ${monthName(now)}`;
    case "last_month":
      return `em ${monthName(new Date(now.getFullYear(), now.getMonth() - 1, 1))}`;
    case "last3m":
      return "nos últimos 3 meses";
    default:
      return `em ${now.getFullYear()}`;
  }
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

const getStoredPeriod = (): Period => {
  if (typeof window === "undefined") return "last30";
  const stored = window.localStorage.getItem(PERIOD_STORAGE_KEY);
  return PERIOD_OPTIONS.some((option) => option.value === stored) ? (stored as Period) : "last30";
};

/** Datas são ancoradas ao meio-dia UTC para o deslocamento de dias não escorregar. */
const keyToDate = (key: string) => new Date(`${key}T12:00:00Z`);
const dateToKey = (date: Date) => date.toISOString().slice(0, 10);
const shiftDays = (date: Date, days: number) => {
  const shifted = new Date(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted;
};
const daysBetween = (startKey: string, endKey: string) =>
  Math.round((keyToDate(endKey).getTime() - keyToDate(startKey).getTime()) / 86_400_000) + 1;

type PeriodRange = { startKey: string; endKey: string };

/** Intervalo fechado do período, em chaves YYYY-MM-DD no fuso de Belém. */
const getPeriodRange = (period: Period): PeriodRange => {
  const todayKey = getBelemDateKey(new Date());
  const today = keyToDate(todayKey);
  // 0 = domingo no getUTCDay; a semana da Velo começa na segunda
  const weekdayFromMonday = (today.getUTCDay() + 6) % 7;
  const startOfWeek = shiftDays(today, -weekdayFromMonday);
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12));
  const firstOfLastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1, 12));
  const lastOfLastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 12));

  switch (period) {
    case "today":
      return { startKey: todayKey, endKey: todayKey };
    case "yesterday": {
      const key = dateToKey(shiftDays(today, -1));
      return { startKey: key, endKey: key };
    }
    case "last7":
      return { startKey: dateToKey(shiftDays(today, -6)), endKey: todayKey };
    case "last30":
      return { startKey: dateToKey(shiftDays(today, -29)), endKey: todayKey };
    case "this_week":
      return { startKey: dateToKey(startOfWeek), endKey: todayKey };
    case "last_week":
      return { startKey: dateToKey(shiftDays(startOfWeek, -7)), endKey: dateToKey(shiftDays(startOfWeek, -1)) };
    case "this_month":
      return { startKey: dateToKey(firstOfMonth), endKey: todayKey };
    case "last_month":
      return { startKey: dateToKey(firstOfLastMonth), endKey: dateToKey(lastOfLastMonth) };
    case "last3m":
      return { startKey: dateToKey(shiftDays(today, -89)), endKey: todayKey };
    default:
      return { startKey: `${todayKey.slice(0, 4)}-01-01`, endKey: todayKey };
  }
};

/** Mesmo tamanho de janela, imediatamente antes do período escolhido. */
const getPreviousRange = (range: PeriodRange): PeriodRange => {
  const length = daysBetween(range.startKey, range.endKey);
  const end = shiftDays(keyToDate(range.startKey), -1);
  return { startKey: dateToKey(shiftDays(end, -(length - 1))), endKey: dateToKey(end) };
};

/** "YYYY-MM-DDTHH" no fuso de Belém, usado quando o recorte é de um dia só. */
const getBelemHourKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const hour = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Belem",
    hour: "2-digit",
    hour12: false,
  }).format(date);
  return `${getBelemDateKey(date)}T${hour.padStart(2, "0")}`;
};

const isInRange = (value: string | null, range: PeriodRange) => {
  if (!value) return false;
  const key = getBelemDateKey(value);
  return key >= range.startKey && key <= range.endKey;
};

const isInPeriod = (value: string | null, period: Period) => isInRange(value, getPeriodRange(period));

/** Agrupamento padrão: dia até um mês, semana até quatro meses, mês acima disso. */
const getAutoGrouping = (range: PeriodRange): Grouping => {
  const days = daysBetween(range.startKey, range.endKey);
  if (days <= 1) return "hour";
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
};

/** Chave do balde a que o instante pertence, normalizada para o início do balde. */
const getBucketKey = (value: string, grouping: Grouping) => {
  if (grouping === "hour") return getBelemHourKey(value);
  const dateKey = getBelemDateKey(value);
  if (grouping === "day") return dateKey;
  if (grouping === "month") return `${dateKey.slice(0, 7)}-01`;
  const date = keyToDate(dateKey);
  return dateToKey(shiftDays(date, -((date.getUTCDay() + 6) % 7)));
};

/** Lista ordenada de baldes que cobre o intervalo inteiro, inclusive os vazios. */
const buildBuckets = (range: PeriodRange, grouping: Grouping) => {
  if (grouping === "hour") {
    // um dia inteiro em horas; no dia corrente para na hora atual
    const todayKey = getBelemDateKey(new Date());
    const lastHour = range.endKey === todayKey ? Number(getBelemHourKey(new Date()).slice(-2)) : 23;
    const days = daysBetween(range.startKey, range.endKey);
    const dayKeys = Array.from({ length: Math.min(days, 3) }, (_, index) =>
      dateToKey(shiftDays(keyToDate(range.startKey), index)),
    );
    return dayKeys.flatMap((dayKey, dayIndex) => {
      const limit = dayIndex === dayKeys.length - 1 ? lastHour : 23;
      return Array.from({ length: limit + 1 }, (_, hour) => `${dayKey}T${String(hour).padStart(2, "0")}`);
    });
  }

  const buckets: string[] = [];
  let cursor = getBucketKey(range.startKey, grouping);
  const guard = 400;
  while (cursor <= range.endKey && buckets.length < guard) {
    buckets.push(cursor);
    const date = keyToDate(cursor);
    if (grouping === "day") cursor = dateToKey(shiftDays(date, 1));
    else if (grouping === "week") cursor = dateToKey(shiftDays(date, 7));
    else cursor = dateToKey(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 12)));
  }
  return buckets;
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
    refunds: Array.isArray(refunds.data) ? refunds.data : [],
    validapayEvents: validapay.rows,
    validapayAvailable: validapay.available,
  };
};


/** A Edge Function só entende day/month/year — os recortes novos caem no mais próximo. */
const toApiPeriod = (period: Period): "day" | "month" | "year" => {
  if (period === "today" || period === "yesterday") return "day";
  if (period === "year" || period === "last3m") return "year";
  return "month";
};

/** Só confiamos nas métricas do provedor quando o recorte é exatamente o que ele calcula. */
const providerMatchesPeriod = (period: Period) =>
  period === "today" || period === "this_month" || period === "year";

const fetchFinanceData = async (period: Period): Promise<FinanceData> => {
  const { data, error } = await supabase.functions.invoke("admin-wallet-finance", {
    body: { period: toApiPeriod(period) },
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
  const [groupingChoice, setGroupingChoice] = useState<Grouping | "auto">("auto");
  const [compareEnabled, setCompareEnabled] = useState(true);
  const periodRange = useMemo(() => getPeriodRange(period), [period]);
  const grouping: Grouping = groupingChoice === "auto" ? getAutoGrouping(periodRange) : groupingChoice;
  const [activityPage, setActivityPage] = useState(1);
  const [activitySearch, setActivitySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityStatusFilter>("all");
  const [compactPanel, setCompactPanel] = useState(false);
  const activitySectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { data = EMPTY_DATA, isLoading, isError, isFetching } = useQuery({
    queryKey: ["admin-wallet-v8-validapay-only"],
    queryFn: fetchWalletData,
    refetchInterval: 30_000,
    retry: 1,
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
    retry: 1,
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

  const allValidapayActivities = useMemo<FinanceActivity[]>(() => {
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
      const currentCycle = asRecord(payload.currentCycle);
      const firstItem = asRecord(Array.isArray(payload.items) ? payload.items[0] : undefined);
      const itemPrice = asRecord(firstItem.price);
      const eventAt = String(
        payload.paidAt ?? currentCycle.paidAt ?? payload.createdAt ?? currentCycle.chargeDate ?? row.created_at,
      );
      const matchedSubscription =
        (row.charge_id ? subscriptionByCharge.get(row.charge_id) : undefined) ??
        (row.subscription_id ? subscriptionByProviderId.get(row.subscription_id) : undefined);
      // O webhook da ValidaPay traz o valor em lugares diferentes conforme o
      // evento (currentCycle em assinaturas, items em cobranças avulsas).
      const amount =
        [
          row.amount,
          payload.amount,
          currentCycle.amount,
          firstItem.amount,
          itemPrice.amount,
          matchedSubscription?.amount,
        ]
          .map((value) => Number(value ?? 0))
          .find((value) => Number.isFinite(value) && value > 0) ?? 0;
      const plan =
        String(matchedSubscription?.plan ?? metadata.plan ?? payload.plan ?? firstItem.name ?? "").trim() || null;
      const status = normalizeValidaPayStatus(row.status, row.event);
      const recurrence = String(
        payload.interval ?? itemPrice.recurrenceType ?? metadata.cycle ?? "",
      ).toUpperCase();
      return [{
        activity: {
          id: getValidaPayEventKey(row),
          user_id: matchedSubscription?.user_id ?? (String(metadata.user_id ?? metadata.userId ?? "").trim() || null),
          payer_name: String(customer.name ?? payer.name ?? "").trim() || null,
          payer_email: String(customer.email ?? payload.email ?? "").trim() || null,
          amount,
          status,
          payment_method:
            String(
              payload.paymentMethod ??
                currentCycle.paymentMethod ??
                matchedSubscription?.payment_method ??
                "",
            ).trim() || null,
          plan,
          interval:
            recurrence.includes("YEAR") || recurrence.includes("ANNUAL") || amount >= 300 ? "Anual" : "Mensal",
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
  }, [data.validapayEvents, uniqueSubscriptions]);

  /** Recorte do período usado pelas métricas e pela tabela. */
  const validapayActivities = useMemo(
    () => allValidapayActivities.filter((activity) => isInRange(activity.created_at, periodRange)),
    [allValidapayActivities, periodRange],
  );

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
  // A ValidaPay às vezes responde sem métricas (sem conexão / período ainda não
  // consolidado). Nesse caso os cards ficavam zerados mesmo com transações na
  // lista — por isso caímos para o cálculo local quando o provedor vem vazio.
  const providerHasMetrics =
    !!providerFinance &&
    (Number(providerFinance.metrics?.gross_revenue ?? 0) > 0 ||
      Number(providerFinance.metrics?.approved_sales ?? 0) > 0 ||
      Number(providerFinance.metrics?.refunds ?? 0) > 0 ||
      Number(providerFinance.metrics?.withdrawals ?? 0) > 0);
  const localHasMetrics =
    localFinance.metrics.gross_revenue > 0 ||
    localFinance.metrics.approved_sales > 0 ||
    localFinance.metrics.refunds > 0;
  const finance =
    providerMatchesPeriod(period) && (providerHasMetrics || !localHasMetrics)
      ? (providerFinance ?? localFinance)
      : localFinance;
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
  const normalizedActivitySearch = activitySearch.trim().toLocaleLowerCase("pt-BR");
  const filteredPaymentActivities = useMemo(
    () => paymentActivities.filter((activity) => {
      if (!matchesActivityStatusFilter(activity.status, statusFilter)) return false;
      if (!normalizedActivitySearch) return true;
      const identity = activity.user_id ? identitiesByUser.get(activity.user_id) : undefined;
      return [identity?.name, identity?.email, activity.payer_name, activity.payer_email, activity.plan, activity.payment_method]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedActivitySearch);
    }),
    [identitiesByUser, normalizedActivitySearch, paymentActivities, statusFilter],
  );
  const filteredSubscriptions = useMemo(
    () => visibleSubscriptions.filter((subscription) => {
      if (!matchesActivityStatusFilter(subscription.status, statusFilter)) return false;
      if (!normalizedActivitySearch) return true;
      const identity = identitiesByUser.get(subscription.user_id);
      return [identity?.name, identity?.email, subscription.plan, subscription.payment_method]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(normalizedActivitySearch);
    }),
    [identitiesByUser, normalizedActivitySearch, statusFilter, visibleSubscriptions],
  );
  const usePaymentActivities = data.validapayAvailable;
  const activityCount = usePaymentActivities ? filteredPaymentActivities.length : filteredSubscriptions.length;
  const activityTotalPages = Math.max(1, Math.ceil(activityCount / ACTIVITY_PAGE_SIZE));
  const activityPageStart = (activityPage - 1) * ACTIVITY_PAGE_SIZE;
  const paginatedPaymentActivities = filteredPaymentActivities.slice(
    activityPageStart,
    activityPageStart + ACTIVITY_PAGE_SIZE,
  );
  const paginatedSubscriptions = filteredSubscriptions.slice(
    activityPageStart,
    activityPageStart + ACTIVITY_PAGE_SIZE,
  );

  useEffect(() => {
    setActivityPage(1);
  }, [activitySearch, period, statusFilter]);

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

  // ---- séries do gráfico: baldes reais dentro do intervalo escolhido ----
  const previousRange = useMemo(() => getPreviousRange(periodRange), [periodRange]);
  const buckets = useMemo(() => buildBuckets(periodRange, grouping), [periodRange, grouping]);

  const allApprovedActivities = useMemo(
    () => allValidapayActivities.filter((activity) => activity.status === "approved"),
    [allValidapayActivities],
  );
  const allRefundedActivities = useMemo(
    () => allValidapayActivities.filter((activity) => activity.status === "refunded"),
    [allValidapayActivities],
  );
  /** Mesma definição do churn do card: reembolso ou cancelamento. */
  const allChurnActivities = useMemo(
    () =>
      allValidapayActivities.filter((activity) =>
        ["refunded", "cancelled", "canceled"].includes(activity.status.toLowerCase()),
      ),
    [allValidapayActivities],
  );
  const allPaidSubscriptions = useMemo(
    () =>
      data.validapayAvailable
        ? []
        : uniqueSubscriptions.filter(
            (subscription) =>
              hasPaymentReference(subscription) &&
              isValidaPaySubscription(subscription) &&
              PAID_STATUSES.has(subscription.status.toLowerCase()),
          ),
    [data.validapayAvailable, uniqueSubscriptions],
  );

  type SeriesEvent = { at: string | null; amount: number };
  const revenueEvents = useMemo<SeriesEvent[]>(
    () => [
      ...allApprovedActivities.map((activity) => ({ at: activity.created_at, amount: activity.amount })),
      ...allPaidSubscriptions.map((subscription) => ({
        at: subscriptionEventAt(subscription),
        amount: Number(subscription.amount ?? 0),
      })),
    ],
    [allApprovedActivities, allPaidSubscriptions],
  );
  const refundEvents = useMemo<SeriesEvent[]>(
    () => allRefundedActivities.map((activity) => ({ at: activity.created_at, amount: activity.amount })),
    [allRefundedActivities],
  );
  const churnEvents = useMemo<SeriesEvent[]>(
    () => allChurnActivities.map((activity) => ({ at: activity.created_at, amount: activity.amount })),
    [allChurnActivities],
  );

  /** Soma (ou conta) os eventos de cada balde do intervalo. */
  const seriesFor = useCallback(
    (events: SeriesEvent[], range: PeriodRange, keys: string[], mode: "sum" | "count" = "sum") => {
      const totals = new Map<string, number>();
      events.forEach((event) => {
        if (!isInRange(event.at, range)) return;
        const bucket = getBucketKey(event.at as string, grouping);
        totals.set(bucket, (totals.get(bucket) ?? 0) + (mode === "count" ? 1 : event.amount));
      });
      return keys.map((key) => totals.get(key) ?? 0);
    },
    [grouping],
  );

  const revenueSparklineValues = useMemo(
    () => seriesFor(revenueEvents, periodRange, buckets),
    [revenueEvents, periodRange, buckets, seriesFor],
  );
  const revenueSparklineLabels = buckets;
  const costSparklineValues = useMemo(
    () => seriesFor(refundEvents, periodRange, buckets),
    [refundEvents, periodRange, buckets, seriesFor],
  );
  const approvedCountSeries = useMemo(
    () => seriesFor(revenueEvents, periodRange, buckets, "count"),
    [revenueEvents, periodRange, buckets, seriesFor],
  );
  /** Barras do card de churn: quantidade de cancelamentos em cada balde. */
  const churnCountSeries = useMemo(
    () => seriesFor(churnEvents, periodRange, buckets, "count"),
    [churnEvents, periodRange, buckets, seriesFor],
  );
  const netSparklineValues = useMemo(
    () => revenueSparklineValues.map((value, index) => Math.max(value - (costSparklineValues[index] ?? 0), 0)),
    [revenueSparklineValues, costSparklineValues],
  );

  /**
   * Série tracejada do período anterior, alinhada balde a balde com a atual.
   *
   * Compara resultado líquido com resultado líquido: o gráfico mostra entradas
   * menos saídas, então a linha de referência precisa descontar os reembolsos
   * daquela janela também.
   */
  const previousNetSeries = useMemo(() => {
    if (!compareEnabled) return [];
    const previousBuckets = buildBuckets(previousRange, grouping);
    const receita = seriesFor(revenueEvents, previousRange, previousBuckets);
    const saidas = seriesFor(refundEvents, previousRange, previousBuckets);
    const liquido = receita.map((value, index) => Math.max(value - (saidas[index] ?? 0), 0));
    if (liquido.length === buckets.length) return liquido;
    return buckets.map((_, index) => liquido[liquido.length - buckets.length + index] ?? 0);
  }, [compareEnabled, previousRange, grouping, revenueEvents, refundEvents, buckets, seriesFor]);

  const seriesVariation = (values: number[]) => {
    if (values.length < 2) return null;
    const previous = values[values.length - 2] ?? 0;
    const current = values[values.length - 1] ?? 0;
    if (previous <= 0) return current > 0 ? 1 : null;
    return (current - previous) / previous;
  };
  const revenueVariation = seriesVariation(revenueSparklineValues);

  const costVariation = seriesVariation(costSparklineValues);

  /** Agrupamentos reais do período, usados nos cards ranqueados. */
  const rankedActivities = useMemo(
    () => paymentActivities.filter((activity) => PAID_STATUSES.has(activity.status.toLowerCase())),
    [paymentActivities],
  );

  const buildRanking = (getKey: (activity: (typeof rankedActivities)[number]) => string) => {
    const groups = new Map<string, { label: string; total: number; count: number }>();
    rankedActivities.forEach((activity) => {
      const label = getKey(activity);
      const current = groups.get(label) ?? { label, total: 0, count: 0 };
      current.total += activity.amount;
      current.count += 1;
      groups.set(label, current);
    });
    return [...groups.values()].sort((left, right) => right.total - left.total).slice(0, 4);
  };

  const rankingByPlan = buildRanking((activity) => getPlanLabel(activity.plan ?? ""));
  const rankingByPayment = buildRanking((activity) => getPaymentMethodLabel(activity.payment_method));

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
        className="relative min-h-full px-5 pb-8 pt-1 lg:px-7"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
        transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence>
          {panelRefreshing ? <PanelRefreshIndicator /> : null}
        </AnimatePresence>

        <motion.header
          className="flex flex-col gap-3"
          initial={reduceMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.38, delay: reduceMotion ? 0 : 0.04 }}
        >
          <div className="admin-page-title">
            <BarChart3 aria-hidden="true" />
            <h1>Visão geral da carteira</h1>
          </div>

          <div className="admin-header-actions flex flex-wrap items-center">
            <AdminSelectPill
              icon={CalendarDays}
              label="Período"
              value={period}
              options={PERIOD_OPTIONS}
              onChange={(value) => setPeriod(value as Period)}
            />
            <AdminSelectPill
              icon={GitCompare}
              label="Comparação"
              value={compareEnabled ? "previous" : "none"}
              options={COMPARE_OPTIONS}
              onChange={(value) => setCompareEnabled(value === "previous")}
            />
            <AdminSelectPill
              icon={CalendarRange}
              label="Agrupar por"
              value={groupingChoice}
              options={GROUPING_OPTIONS}
              onChange={(value) => setGroupingChoice(value as Grouping | "auto")}
            />
            <AdminPill onClick={downloadReport}>
              <Download aria-hidden="true" />
              Exportar
            </AdminPill>
            <AdminPill
              aria-pressed={compactPanel}
              onClick={() => setCompactPanel((value) => !value)}
            >
              <SlidersHorizontal aria-hidden="true" />
              {compactPanel ? "Expandir painel" : "Personalizar painel"}
            </AdminPill>
          </div>
        </motion.header>

        <motion.section
          className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.46, delay: reduceMotion ? 0 : 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <>
            <DashboardMetricCard
              title="Vendas aprovadas"
              value={hideFinancialValues ? null : finance.metrics.approved_sales}
              format="integer"
              description="Pagamentos confirmados"
              loading={financialDataLoading}
              compact={compactPanel}
              trend={null}
              series={approvedCountSeries}
            />
            <DashboardMetricCard
              title="Total de entradas"
              value={hideFinancialValues ? null : finance.metrics.gross_revenue}
              format="currency"
              description={"Receita bruta " + periodContext}
              loading={financialDataLoading}
              compact={compactPanel}
              trend={revenueVariation}
              series={revenueSparklineValues}
            />
            <DashboardMetricCard
              title="Churn"
              value={hideFinancialValues ? null : churnRate}
              format="percent"
              description="Cancelamentos e reembolsos sobre a base paga do período; as barras contam os cancelamentos."
              loading={financialDataLoading}
              compact={compactPanel}
              trend={null}
              series={churnCountSeries}
            />
            <DashboardMetricCard
              title="Total de saídas"
              value={hideFinancialValues ? null : finance.metrics.costs}
              format="currency"
              description={"Reembolsos: " + formatBRL(finance.metrics.refunds)}
              loading={financialDataLoading}
              compact={compactPanel}
              trend={costVariation}
              series={costSparklineValues}
              invertTrend
            />
          </>
        </motion.section>

        <motion.section
          className="mt-3"
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.46, delay: reduceMotion ? 0 : 0.14, ease: [0.22, 1, 0.36, 1] }}
        >
          <FinanceHistoryCard
            total={hideFinancialValues ? null : finance.metrics.net_revenue}
            values={netSparklineValues}
            labels={revenueSparklineLabels}
            comparisonValues={previousNetSeries}
            comparisonLabel="Período anterior"
            grouping={grouping}
            loading={financialDataLoading}
            compact={compactPanel}
            periodLabel={periodContext}
          />
        </motion.section>

        <motion.section
          className="mt-3 grid gap-3 lg:grid-cols-2"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.48, delay: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
        >
          <RankedCard title="Produtos mais vendidos" rows={rankingByPlan} loading={isLoading} />
          <RankedCard title="Formas de pagamento" rows={rankingByPayment} loading={isLoading} />
        </motion.section>

        <motion.section
          ref={activitySectionRef}
          className="admin-card mt-3 overflow-hidden"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="admin-page-title">Atividade financeira</h2>
            </div>
            <div className="flex flex-1 flex-wrap items-center gap-2 lg:max-w-[560px] lg:justify-end">
              <label className="admin-control flex h-8 min-w-[190px] flex-1 items-center gap-2 px-2.5 text-[#827a75] lg:max-w-[250px]">
                <Search size={13} strokeWidth={1.6} className="shrink-0 text-[#171717]" />
                <span className="sr-only">Buscar atividade</span>
                <input
                  value={activitySearch}
                  onChange={(event) => setActivitySearch(event.target.value)}
                  placeholder="Buscar assinante..."
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[#303030] outline-none placeholder:text-[#8c8f93]"
                />
              </label>
              <label className="admin-control relative inline-flex h-8 items-center text-[#595959]">
                <SlidersHorizontal size={13} className="pointer-events-none absolute left-2.5" />
                <span className="sr-only">Filtrar por status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                  className="h-full cursor-pointer appearance-none bg-transparent py-0 pl-8 pr-7 text-[13px] font-normal outline-none"
                >
                  <option value="all">Todos</option>
                  <option value="approved">Aprovados</option>
                  <option value="pending">Pendentes</option>
                  <option value="issue">Com problema</option>
                </select>
                <ChevronDown size={11} className="pointer-events-none absolute right-2.5" />
              </label>
              <AdminPill
                variant="primary"
                onClick={downloadReport}
              >
                <Download aria-hidden="true" />
                Baixar relatório
              </AdminPill>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <AdminTableHeader>
                <tr className="border-y text-[10px] font-medium text-[#827a75]">
                  <th className="px-4 py-2.5">Assinante</th>
                  <th className="px-3 py-2.5">Cobrança</th>
                  <th className="px-3 py-2.5">Intervalo</th>
                  <th className="px-3 py-2.5">Valor</th>
                  <th className="px-3 py-2.5">Produto</th>
                  <th className="px-3 py-2.5">Pagamento</th>
                  <th className="px-4 py-2.5">Status</th>
                </tr>
              </AdminTableHeader>
              <tbody>
                {isLoading ? <ActivityTableSkeleton /> : usePaymentActivities ? paginatedPaymentActivities.map((activity, index) => {
                  const status = getSubscriptionStatus(activity.status);
                  const identity = activity.user_id ? identitiesByUser.get(activity.user_id) : undefined;
                  const name = identity?.name || activity.payer_name || activity.payer_email || "Assinante não identificado";
                  const email = identity?.email || activity.payer_email;
                  return (
                    <motion.tr
                      key={"payment:" + activity.id}
                      className="border-t text-[13px] text-[#303030] transition-colors hover:bg-[#fafafa]"
                      initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.32, delay: reduceMotion ? 0 : Math.min(index, 10) * 0.035 }}
                    >
                      <td className="max-w-[210px] px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="admin-avatar">
                            {name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#1a1a1a]">{name}</p>
                            {email && email !== name ? <p className="mt-0.5 truncate text-[12px] text-[#8c8f93]">{email}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[#303030]">{formatChargeDay(activity.created_at)}</p>
                        <p className="mt-0.5 text-[12px] text-[#8c8f93]">{formatDate(activity.created_at)} · {formatTime(activity.created_at)}</p>
                      </td>
                      <td className="px-3 py-2.5"><AdminBadge>{activity.interval}</AdminBadge></td>
                      <td className="admin-number px-3 py-2.5 font-semibold text-[#1c1918]">{activity.amount > 0 ? formatBRL(activity.amount) : "—"}</td>
                      <td className="px-3 py-2.5 font-medium">{getPlanLabel(activity.plan ?? "")}</td>
                      <td className="px-3 py-2.5 font-medium">{getPaymentMethodLabel(activity.payment_method)}</td>
                      <td className="px-4 py-2.5" title={"Status registrado: " + activity.status}><StatusBadge label={status.label} tone={status.tone} /></td>
                    </motion.tr>
                  );
                }) : paginatedSubscriptions.map((subscription, index) => {
                  const status = getSubscriptionStatus(subscription.status);
                  const identity = identitiesByUser.get(subscription.user_id);
                  const eventAt = subscriptionEventAt(subscription);
                  const chargeAt = subscription.next_charge_at || subscription.current_period_start || eventAt;
                  const name = identity?.name || identity?.email || "Assinante não identificado";
                  return (
                    <motion.tr
                      key={subscription.id}
                      className="border-t text-[13px] text-[#303030] transition-colors hover:bg-[#fafafa]"
                      initial={reduceMotion ? false : { opacity: 0, y: 7 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: reduceMotion ? 0 : 0.32, delay: reduceMotion ? 0 : Math.min(index, 10) * 0.035 }}
                    >
                      <td className="max-w-[210px] px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="admin-avatar">
                            {name.slice(0, 2).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#1a1a1a]">{name}</p>
                            {identity?.name && identity.email ? <p className="mt-0.5 truncate text-[12px] text-[#8c8f93]">{identity.email}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[#303030]">{formatChargeDay(chargeAt)}</p>
                        <p className="mt-0.5 text-[12px] text-[#8c8f93]">{formatDate(eventAt)} · {formatTime(eventAt)}</p>
                      </td>
                      <td className="px-3 py-2.5"><AdminBadge>{getBillingInterval(subscription)}</AdminBadge></td>
                      <td className="admin-number px-3 py-2.5 font-semibold text-[#1c1918]">{formatBRL(Number(subscription.amount ?? 0))}</td>
                      <td className="px-3 py-2.5 font-medium">{getPlanLabel(subscription.plan)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{getPaymentMethodLabel(subscription.payment_method)}</p>
                        {subscription.charge_attempts > 0 ? <p className="mt-0.5 text-[12px] text-[#8c8f93]">{subscription.charge_attempts} tentativa{subscription.charge_attempts === 1 ? "" : "s"}</p> : null}
                      </td>
                      <td className="px-4 py-2.5" title={"Status registrado: " + subscription.status}>
                        <StatusBadge label={status.label} tone={status.tone} />
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!isLoading && isError ? (
            <div className="grid min-h-44 place-items-center border-t border-[#edf0f5] px-6 text-center text-[13px] text-[#d72c0d]">
              Não foi possível carregar os dados do painel.
            </div>
          ) : null}
          {!isLoading && !isError && activityCount === 0 ? (
            <div className="grid min-h-44 place-items-center border-t border-[#edf0f5] px-6 text-center">
              <div>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#eaf0ff] text-[#2563eb]"><Search size={18} /></span>
                <p className="mt-3 text-[13px] font-medium text-[#5f6368]">Nenhuma atividade encontrada neste período.</p>
              </div>
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
        </motion.section>
      </motion.div>
    </AdminShell>
  );
};

const DashboardMetricCard = ({
  title,
  value,
  format,
  description,
  loading,
  compact,
  trend,
  series,
  invertTrend = false,
}: {
  title: string;
  value: number | null;
  format: MetricFormat;
  description: string;
  loading: boolean;
  compact: boolean;
  trend: number | null;
  series?: number[];
  /** Métricas de saída: subir é ruim, e o verde de marca fica reservado à receita. */
  invertTrend?: boolean;
}) => (
  <AdminKPIStat
    label={title}
    subtitle={description}
    compact={compact}
    series={loading ? undefined : series}
    value={loading ? (
      <LoadingShimmer className="h-6 w-32" />
    ) : (
      <AnimatedMetricNumber value={value} format={format} className="admin-kpi-value block whitespace-nowrap" />
    )}
    delta={!loading && trend !== null ? `${trend >= 0 ? "+" : ""}${formatPercent(trend)}` : null}
    deltaTone={
      invertTrend
        ? trend !== null && trend > 0
          ? "danger"
          : "neutral"
        : trend !== null && trend < 0
          ? "danger"
          : "success"
    }
  />
);

/** Lista ranqueada com barra proporcional, no padrão do card de destaques. */
const RankedCard = ({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: Array<{ label: string; total: number; count: number }>;
  loading: boolean;
}) => {
  const max = Math.max(...rows.map((row) => row.total), 1);
  return (
    <AdminCard className="p-4">
      <p className="admin-kpi-label">
        <span className="admin-metric-icon"><Globe aria-hidden="true" /></span>
        <span className="admin-kpi-label-text">{title}</span>
      </p>
      {loading ? (
        <div className="mt-5 space-y-5">
          {[0, 1, 2].map((index) => (
            <LoadingShimmer key={index} className="h-9 w-full" delay={index * 0.06} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="mt-5 text-[13px] text-[#8c8f93]">Nenhum registro no período.</p>
      ) : (
        <div className="mt-4 space-y-3.5">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center gap-3">
                <span className="admin-rank-mark" aria-hidden="true">{row.label.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1 truncate text-[14px] text-[#1a1a1a]">{row.label}</span>
                <span className="admin-number shrink-0 text-[14px] font-medium text-[#1a1a1a]">{formatBRL(row.total)}</span>
                <span className="admin-number w-9 shrink-0 text-right text-[13px] text-[#8c8f93]">{row.count}</span>
              </div>
              <div className="mt-2">
                <AdminProgressBar ratio={row.total / max} />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  );
};

const FinanceHistoryCard = ({
  total,
  values,
  labels = [],
  comparisonValues = [],
  comparisonLabel,
  grouping,
  loading,
  compact,
  periodLabel,
}: {
  total: number | null;
  values: number[];
  labels: string[];
  comparisonValues?: number[];
  comparisonLabel?: string;
  grouping: Grouping;
  loading: boolean;
  compact: boolean;
  periodLabel: string;
}) => {
  const reduceMotion = useReducedMotion();
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  // o SVG é desenhado em pixels reais: 1 unidade = 1px, senão o viewBox
  // estica texto e traço junto com a largura do card.
  const [plotWidth, setPlotWidth] = useState(720);

  useEffect(() => {
    const node = plotRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width > 0) setPlotWidth(width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const chartValues =
    values.length > 1 ? values : values.length === 1 ? [values[0], values[0]] : [0, 0, 0, 0, 0, 0, 0];
  const hasComparison = comparisonValues.length === chartValues.length && comparisonValues.some((value) => value > 0);
  const rawMax = Math.max(...chartValues, ...(hasComparison ? comparisonValues : []), 1);
  // eixo com marcações "redondas" (1, 2 ou 5 × potência de dez)
  const niceStep = (raw: number) => {
    const exponent = Math.floor(Math.log10(raw));
    const base = 10 ** exponent;
    const normalized = raw / base;
    const multiple = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
    return multiple * base;
  };
  const axisStep = niceStep(rawMax / 4);
  const max = axisStep * 4;
  const width = plotWidth;
  const height = compact ? 150 : 196;
  const plotTop = 10;
  const plotBottom = height - 10;
  const plotLeft = 46;
  const plotRight = width - 4;
  const pointAt = (value: number, index: number, length: number) => ({
    x: plotLeft + index * ((plotRight - plotLeft) / Math.max(length - 1, 1)),
    y: plotBottom - (value / max) * (plotBottom - plotTop),
    value,
  });
  const points = chartValues.map((value, index) => pointAt(value, index, chartValues.length));
  const linePath = "M " + points.map((point) => `${point.x} ${point.y}`).join(" L ");
  const comparisonPath = hasComparison
    ? "M " + comparisonValues
        .map((value, index) => {
          const point = pointAt(value, index, comparisonValues.length);
          return `${point.x} ${point.y}`;
        })
        .join(" L ")
    : "";
  // o último balde pode estar vazio (hora sem venda); mostramos o último com movimento
  const latest = [...chartValues].reverse().find((value) => value > 0) ?? 0;
  const activePoint = activePointIndex === null ? null : points[activePointIndex];
  const activePrevious = activePointIndex && activePointIndex > 0 ? chartValues[activePointIndex - 1] : 0;
  const activeVariation = activePoint && activePrevious > 0 ? (activePoint.value - activePrevious) / activePrevious : null;
  const yTicks = [1, 0.75, 0.5, 0.25, 0];
  const formatAxisValue = (value: number) => {
    if (value === 0) return "0";
    if (value >= 1_000_000) return `${Number((value / 1_000_000).toFixed(1))}M`;
    if (value >= 1_000) return `${Number((value / 1_000).toFixed(1))}k`;
    // passos pequenos precisam de decimal, senão o eixo repete o mesmo rótulo
    const decimals = axisStep >= 10 ? 0 : axisStep >= 1 ? 1 : 2;
    return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: decimals }).format(value);
  };
  /** 0 → 12 AM (meia-noite), 12 → 12 PM, cobrindo as 24 horas do dia. */
  const formatHourLabel = (hour: number) => `${hour % 12 === 0 ? 12 : hour % 12} ${hour < 12 ? "AM" : "PM"}`;

  const formatAxisLabel = (raw: string) => {
    if (grouping === "hour") {
      const hour = Number(raw.slice(-2));
      return Number.isNaN(hour) ? raw : formatHourLabel(hour);
    }
    const parsed = raw ? new Date(`${raw}T12:00:00Z`) : new Date(Number.NaN);
    if (Number.isNaN(parsed.getTime())) return raw.slice(0, 3);
    if (grouping === "month") {
      return new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" }).format(parsed).replace(".", "");
    }
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" })
      .format(parsed)
      .replace(" de ", " ")
      .replace(".", "");
  };
  /** O SVG é 1:1, então o x do mouse já é a coordenada do desenho. */
  const handlePointerMove = (event: ReactMouseEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const step = (plotRight - plotLeft) / Math.max(points.length - 1, 1);
    const index = Math.round((x - plotLeft) / step);
    setActivePointIndex(Math.min(Math.max(index, 0), points.length - 1));
  };

  const handleKeyDown = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key === "Escape") {
      setActivePointIndex(null);
      return;
    }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    setActivePointIndex((current) => {
      const base = current ?? points.length - 1;
      const next = event.key === "ArrowRight" ? base + 1 : base - 1;
      return Math.min(Math.max(next, 0), points.length - 1);
    });
  };

  const axisCount = Math.min(labels.length || chartValues.length, 6);
  const axisIndexes = Array.from({ length: axisCount }, (_, index) =>
    Math.round(index * (Math.max((labels.length || chartValues.length) - 1, 0) / Math.max(axisCount - 1, 1))),
  );

  return (
    <AdminChartCard className="relative p-4">
      <p className="admin-kpi-label">
        <span className="admin-metric-icon"><Globe aria-hidden="true" /></span>
        <span className="admin-kpi-label-text" title={`Entradas menos saídas ${periodLabel}`}>Resultado líquido</span>
      </p>
      {loading ? (
        <LoadingShimmer className="mt-2 h-7 w-36" />
      ) : (
        <AnimatedMetricNumber value={total} format="currency" className="admin-kpi-value mt-2 block" />
      )}

      <div ref={plotRef} className="relative mt-2">
        {activePoint ? (
          <motion.div
            className="admin-chart-tooltip"
            style={{
              left: Math.min(Math.max(activePoint.x, 78), Math.max(width - 78, 78)),
              top: activePoint.y < 92 ? activePoint.y + 14 : activePoint.y - 12,
              transform: `translate(-50%, ${activePoint.y < 92 ? "0" : "-100%"})`,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="admin-chart-tooltip-label">{formatAxisLabel(labels[activePointIndex ?? 0] ?? "")}</p>
            <p className="admin-number mt-1 text-[14px] font-semibold text-[#1a1a1a]">{formatBRL(activePoint.value)}</p>
            {activeVariation !== null ? (
              <p className={`mt-0.5 text-[12px] font-medium ${activeVariation >= 0 ? "text-[#22c55e]" : "text-[#d72c0d]"}`}>
                {activeVariation >= 0 ? "↗" : "↘"} {activeVariation >= 0 ? "+" : ""}{formatPercent(activeVariation)}
              </p>
            ) : null}
          </motion.div>
        ) : null}
        {loading ? (
          <LoadingShimmer className={compact ? "h-[150px] w-full" : "h-[196px] w-full"} />
        ) : (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="admin-chart-svg block w-full"
            role="img"
            tabIndex={0}
            aria-label={`Resultado líquido ao longo do período. ${
              activePoint ? `${formatAxisLabel(labels[activePointIndex ?? 0] ?? "")}: ${formatBRL(activePoint.value)}` : "Use as setas para percorrer os pontos."
            }`}
            onMouseMove={handlePointerMove}
            onMouseLeave={() => setActivePointIndex(null)}
            onBlur={() => setActivePointIndex(null)}
            onKeyDown={handleKeyDown}
          >
            {yTicks.map((ratio) => {
              const y = plotTop + (plotBottom - plotTop) * ratio;
              return (
                <g key={ratio}>
                  <line x1={plotLeft} x2={plotRight} y1={y} y2={y} stroke="#ececec" strokeWidth="1" shapeRendering="crispEdges" />
                  <text x={plotLeft - 12} y={y + 4} textAnchor="end" fill="#8c8f93" fontSize="13">
                    {formatAxisValue(max * (1 - ratio))}
                  </text>
                </g>
              );
            })}
            {activePoint ? (
              <line
                x1={activePoint.x}
                x2={activePoint.x}
                y1={plotTop}
                y2={plotBottom}
                stroke="#c9ced6"
                strokeWidth="1"
                strokeDasharray="3 3"
                shapeRendering="crispEdges"
              />
            ) : null}
            {comparisonPath ? (
              <motion.path
                d={comparisonPath}
                fill="none"
                stroke="#9db8f2"
                strokeWidth="1.5"
                strokeDasharray="2 3"
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0 : 0.6, delay: reduceMotion ? 0 : 0.2 }}
              />
            ) : null}
            <motion.path
              d={linePath}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
            {activePoint ? (
              <circle cx={activePoint.x} cy={activePoint.y} r="4.5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
            ) : null}
          </svg>
        )}
        <div
          className="mt-2 flex items-center justify-between text-[13px] text-[#8c8f93]"
          style={{ paddingLeft: plotLeft }}
        >
          {axisIndexes.map((axisIndex, index) => (
            <span key={`${axisIndex}-${index}`}>{formatAxisLabel(labels[axisIndex] ?? "")}</span>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-[13px] text-[#5f6368]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#2563eb]" aria-hidden="true" />
          Resultado líquido
        </span>
        {hasComparison && comparisonLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#9db8f2]" aria-hidden="true" />
            {comparisonLabel}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#c9c9c9]" aria-hidden="true" />
          Último registro · <span className="admin-number font-medium text-[#1a1a1a]">{formatBRL(latest)}</span>
        </span>
      </div>
    </AdminChartCard>
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
    className="pointer-events-none absolute inset-x-0 top-0 z-30 h-px overflow-hidden bg-[#f7dce7]"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <motion.span
      className="block h-full w-[28%] bg-gradient-to-r from-transparent via-[#2563eb] to-transparent"
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
      className="flex flex-col gap-3 border-t border-[#ececec] bg-[#fdfdfd] px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <p className="text-[12px] font-normal text-[#8c8f93]">
        Exibindo <span className="font-medium text-[#303030]">{rangeStart}–{rangeEnd}</span> de {totalItems} atividades
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
            className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[10px] font-medium transition ${
              pageNumber === page
                ? "bg-[#1a1a1a] text-white"
                : "text-[#5f6368] hover:bg-white hover:text-[#1a1a1a]"
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

const StatusBadge = ({
  label,
  tone,
}: {
  label: string;
  tone: "success" | "danger" | "warning" | "neutral";
}) => {
  return <AdminBadge tone={tone}>{label}</AdminBadge>;
};

export default AdminPainelPage;
