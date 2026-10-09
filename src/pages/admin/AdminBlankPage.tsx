import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { animate, motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  type LucideIcon,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAdminPolling } from "@/components/admin/adminLayoutContext";
import { AdminDateRangePicker } from "@/components/admin/AdminDateRangePicker";
import {
  OverviewMenu,
  OverviewRevenueCard,
  OverviewStatCard,
  type OverviewDelta,
} from "@/components/admin/AdminOverview";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BanknotesIcon,
  CalendarIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CreditCardIcon,
  CubeIcon,
  CurrencyDollarIcon,
  EllipsisVerticalIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
  ReceiptRefundIcon,
  ShoppingBagIcon,
  UserIcon,
  UserMinusIcon,
  UsersIcon,
} from "@heroicons/react/20/solid";
import { AdminMobileHome } from "@/components/admin/AdminMobileHome";
import {
  AdminBadge,
} from "@/components/admin/AdminPrimitives";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllPages, fetchUserIdentities, type AdminUserIdentity } from "@/lib/adminWalletFetch";
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

type WalletData = {
  subscriptions: SubscriptionRow[];
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
  | "year"
  /** Intervalo escolhido no calendário (de um dia até outro). */
  | "custom";

/** Agrupamento dos pontos do gráfico. */
type Grouping = "hour" | "day" | "week" | "month";

const PERIOD_STORAGE_KEY = "velo:admin-wallet-period";
const RANGE_STORAGE_KEY = "velo:admin-wallet-range";
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

const PERIOD_OPTIONS: Array<{ value: Exclude<Period, "custom">; label: string }> = [
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

const GROUPING_OPTIONS: Array<{ value: Grouping | "auto"; label: string }> = [
  { value: "auto", label: "Agrupamento automático" },
  { value: "hour", label: "Por hora" },
  { value: "day", label: "Por dia" },
  { value: "week", label: "Por semana" },
  { value: "month", label: "Por mês" },
];

const MOBILE_GROUPING_OPTIONS: Array<{ value: Grouping | "auto"; label: string }> = [
  { value: "auto", label: "Automático" },
  { value: "hour", label: "Por hora" },
  { value: "day", label: "Diário" },
  { value: "week", label: "Semanal" },
  { value: "month", label: "Mensal" },
];

const MONTH_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Rótulo do tooltip do gráfico ("14h · 09/10", "12 out, 2026", "Semana de 06 out", "Out, 2026"). */
const formatBucketLabel = (key: string, grouping: Grouping) => {
  if (grouping === "hour") return `${key.slice(11, 13)}h · ${key.slice(8, 10)}/${key.slice(5, 7)}`;
  const month = MONTH_SHORT[Number(key.slice(5, 7)) - 1] ?? "";
  if (grouping === "month") return `${capitalize(month)}, ${key.slice(0, 4)}`;
  if (grouping === "week") return `Semana de ${key.slice(8, 10)} ${month}`;
  return `${key.slice(8, 10)} ${month}, ${key.slice(0, 4)}`;
};

/** Rótulo curto do eixo X ("14h", "12 out", "Out"). */
const formatAxisLabel = (key: string, grouping: Grouping) => {
  if (grouping === "hour") return `${key.slice(11, 13)}h`;
  const month = MONTH_SHORT[Number(key.slice(5, 7)) - 1] ?? "";
  if (grouping === "month") return capitalize(month);
  return `${key.slice(8, 10)} ${month}`;
};

/** Com o que cada período é comparado, para a frase "… a menos que ontem". */
const getComparisonLabel = (period: Period, range: PeriodRange) => {
  if (period === "today") return "ontem";
  if (period === "yesterday") return "anteontem";
  if (period === "last_week") return "na semana anterior";
  const days = daysBetween(range.startKey, range.endKey);
  return days === 1 ? "no dia anterior" : `nos ${days} dias anteriores`;
};

const shortDayLabel = (key: string) =>
  `${key.slice(8, 10)} ${MONTH_SHORT[Number(key.slice(5, 7)) - 1] ?? ""}`;

/** Período escrito para frases ("hoje", "nos últimos 7 dias", "de 03 out a 09 out"). */
const getPeriodPhrase = (period: Period, range: PeriodRange) => {
  if (period === "custom") {
    return range.startKey === range.endKey
      ? `em ${shortDayLabel(range.startKey)}`
      : `de ${shortDayLabel(range.startKey)} a ${shortDayLabel(range.endKey)}`;
  }
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
      return "neste mês";
    case "last_month":
      return "no mês passado";
    case "last3m":
      return "nos últimos 3 meses";
    default:
      return "neste ano";
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

const readStorage = (key: string) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // armazenamento bloqueado: só não lembra a escolha
  }
};

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const getStoredRange = (): PeriodRange | null => {
  try {
    const parsed = JSON.parse(readStorage(RANGE_STORAGE_KEY) ?? "null") as Partial<PeriodRange> | null;
    if (!parsed || !DATE_KEY.test(String(parsed.startKey)) || !DATE_KEY.test(String(parsed.endKey))) return null;
    if (String(parsed.startKey) > String(parsed.endKey)) return null;
    return { startKey: String(parsed.startKey), endKey: String(parsed.endKey) };
  } catch {
    return null;
  }
};

const getStoredPeriod = (): Period => {
  if (typeof window === "undefined") return "last30";
  const stored = readStorage(PERIOD_STORAGE_KEY);
  if (stored === "custom") return getStoredRange() ? "custom" : "last30";
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

/** Balde de um dia já no formato "YYYY-MM-DD" (sem conversão de fuso). */
const bucketKeyFromDayKey = (dayKey: string, grouping: Exclude<Grouping, "hour">) => {
  if (grouping === "day") return dayKey;
  if (grouping === "month") return `${dayKey.slice(0, 7)}-01`;
  const date = keyToDate(dayKey);
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
  // range.startKey já é um dia de Belém ("YYYY-MM-DD"); passar por getBucketKey
  // o leria como meia-noite UTC e voltaria um dia no fuso de Belém.
  let cursor = bucketKeyFromDayKey(range.startKey, grouping);
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

const fetchAllSubscriptions = () =>
  fetchAllPages<SubscriptionRow>((from, to) =>
    supabase
      .from("subscriptions")
      .select("id,user_id,plan,amount,status,payment_method,mp_payment_id,provider,validapay_charge_id,validapay_subscription_id,charge_attempts,last_charge_attempt_at,current_period_start,current_period_end,next_charge_at,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .order("id")
      .range(from, to),
  );

const fetchAllValidaPayEvents = async () => {
  try {
    const rows = await fetchAllPages<ValidaPayEventRow>((from, to) =>
      supabase
        .from("validapay_webhook_events")
        .select("id,event,charge_id,subscription_id,payment_id,status,amount,payload,created_at")
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    );
    return { rows, available: true };
  } catch (error) {
    // Só "tabela inexistente" significa que a ValidaPay não está ligada; queda de
    // rede ou de sessão precisa aparecer como erro, não como carteira vazia.
    const code = String((error as { code?: unknown } | null)?.code ?? "");
    if (code === "42P01" || code === "PGRST205") return { rows: [] as ValidaPayEventRow[], available: false };
    throw error;
  }
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

/** Como withTimeout, mas sem fingir sucesso: estourou o prazo, vira erro (e a consulta tenta de novo). */
const withDeadline = async <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Tempo esgotado ao carregar ${label}`)), ms);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const fetchWalletData = async (): Promise<WalletData> => {
  // Nomes e e-mails vêm à parte (fetchUserIdentities), só para quem aparece na tela.
  // Assinaturas e eventos da ValidaPay são o painel inteiro: se falharem, é erro
  // (antes viravam lista vazia em silêncio e o painel mostrava R$ 0,00).
  const [subscriptions, refunds, validapay] = await Promise.all([
    withDeadline(fetchAllSubscriptions(), 30_000, "assinaturas"),
    withTimeout(
      supabase
        .from("refund_requests")
        .select("payment_id,refund_amount,processed_at,status")
        .limit(1000)
        .then((result) => result),
      20_000,
      { data: [] as RefundRow[], error: null } as { data: RefundRow[] | null; error: unknown },
    ),
    withDeadline(fetchAllValidaPayEvents(), 30_000, "pagamentos"),
  ]);

  return {
    subscriptions,
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
  // atualização automática pausa quando o painel está numa aba escondida
  const polling5min = useAdminPolling(5 * 60_000);
  const [period, setPeriod] = useState<Period>(getStoredPeriod);
  const [customRange, setCustomRange] = useState<PeriodRange | null>(getStoredRange);
  const [groupingChoice, setGroupingChoice] = useState<Grouping | "auto">(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "week" : "auto",
  );
  const periodRange = useMemo(
    () => (period === "custom" && customRange ? customRange : getPeriodRange(period === "custom" ? "last30" : period)),
    [period, customRange],
  );
  const todayKey = getBelemDateKey(new Date());
  const grouping: Grouping = groupingChoice === "auto" ? getAutoGrouping(periodRange) : groupingChoice;
  const [activityPage, setActivityPage] = useState(1);
  const [activitySearch, setActivitySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ActivityStatusFilter>("all");
  const activitySectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { data = EMPTY_DATA, isLoading, isError, isFetching, refetch: refetchWallet } = useQuery({
    queryKey: ["admin-wallet-v8-validapay-only"],
    queryFn: fetchWalletData,
    // Recarregar tudo a cada 30s sobrecarregava o banco; o foco na aba também atualiza.
    refetchInterval: polling5min,
    retry: 2,
    retryDelay: (attempt) => Math.min(1500 * 2 ** attempt, 6000),
  });
  const {
    data: providerFinance,
    isError: isFinanceError,
    isLoading: isFinanceLoading,
    isFetching: isFinanceFetching,
  } = useQuery({
    queryKey: ["admin-wallet-finance-v2-validapay-only", period],
    queryFn: () => fetchFinanceData(period),
    // intervalo livre é calculado só com os dados locais
    enabled: period !== "custom",
    refetchInterval: polling5min,
    retry: 1,
  });

  useEffect(() => {
    writeStorage(PERIOD_STORAGE_KEY, period);
    if (period === "custom" && customRange) writeStorage(RANGE_STORAGE_KEY, JSON.stringify(customRange));
  }, [period, customRange]);

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
          isInRange(subscriptionEventAt(subscription), periodRange),
      );
      return [...subscriptions].sort(
        (left, right) =>
          new Date(subscriptionEventAt(right)).getTime() - new Date(subscriptionEventAt(left)).getTime(),
      );
    },
    [data.validapayAvailable, uniqueSubscriptions, periodRange],
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
          isInRange(subscriptionEventAt(subscription), periodRange),
      ),
    [data.validapayAvailable, uniqueSubscriptions, periodRange],
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
            isInRange(item.processed_at, periodRange),
        )
        .reduce((sum, item) => sum + Number(item.refund_amount ?? 0), 0);
      const validapayRefunds = validapayActivities
        .filter((activity) => activity.status === "refunded")
        .reduce((sum, activity) => sum + activity.amount, 0);
      return databaseRefunds + validapayRefunds;
    },
    [data.refunds, data.validapayAvailable, periodRange, uniqueSubscriptions, validapayActivities],
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

  // Nomes só de quem aparece na tela; os números não esperam por eles para aparecer.
  const identityUserIds = useMemo(
    () =>
      [
        ...new Set(
          [...paymentActivities.map((activity) => activity.user_id), ...visibleSubscriptions.map((subscription) => subscription.user_id)]
            .filter((id): id is string => !!id),
        ),
      ].sort(),
    [paymentActivities, visibleSubscriptions],
  );
  const { data: identities } = useQuery({
    queryKey: ["admin-wallet-identities", identityUserIds],
    queryFn: () => fetchUserIdentities(identityUserIds),
    enabled: identityUserIds.length > 0,
    staleTime: 10 * 60_000,
    placeholderData: (previous) => previous,
  });
  const identitiesByUser = useMemo(
    () => new Map<string, AdminUserIdentity>((identities ?? []).map((identity) => [identity.user_id, identity])),
    [identities],
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
  }, [activitySearch, periodRange, statusFilter]);

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
          isInRange(subscriptionEventAt(subscription), periodRange),
      ),
    [uniqueSubscriptions, periodRange],
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
    const previousBuckets = buildBuckets(previousRange, grouping);
    const receita = seriesFor(revenueEvents, previousRange, previousBuckets);
    const saidas = seriesFor(refundEvents, previousRange, previousBuckets);
    const liquido = receita.map((value, index) => Math.max(value - (saidas[index] ?? 0), 0));
    if (liquido.length === buckets.length) return liquido;
    return buckets.map((_, index) => liquido[liquido.length - buckets.length + index] ?? 0);
  }, [previousRange, grouping, revenueEvents, refundEvents, buckets, seriesFor]);

  /**
   * Variação de cada card contra a janela imediatamente anterior, do mesmo
   * tamanho. As duas pontas usam a mesma soma de eventos, para comparar igual
   * com igual mesmo quando o card mostra o número vindo da ValidaPay.
   */
  const previousTotals = useMemo(() => {
    const previousBuckets = buildBuckets(previousRange, grouping);
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    return {
      revenue: sum(seriesFor(revenueEvents, previousRange, previousBuckets)),
      sales: sum(seriesFor(revenueEvents, previousRange, previousBuckets, "count")),
      refunds: sum(seriesFor(refundEvents, previousRange, previousBuckets)),
    };
  }, [previousRange, grouping, revenueEvents, refundEvents, seriesFor]);
  const sumOf = (values: number[]) => values.reduce((total, value) => total + value, 0);
  /** Diferença absoluta e relativa; sem nada nos dois períodos, não há o que comparar. */
  const deltaAgainst = (current: number, previous: number): OverviewDelta | null => {
    if (current <= 0 && previous <= 0) return null;
    return { diff: current - previous, pct: previous > 0 ? (current - previous) / previous : null, previous };
  };
  const currentRevenue = sumOf(revenueSparklineValues);
  const currentRefunds = sumOf(costSparklineValues);
  const revenueDelta = deltaAgainst(currentRevenue, previousTotals.revenue);
  const salesDelta = deltaAgainst(sumOf(approvedCountSeries), previousTotals.sales);
  const refundsDelta = deltaAgainst(currentRefunds, previousTotals.refunds);
  const netDelta = deltaAgainst(currentRevenue - currentRefunds, previousTotals.revenue - previousTotals.refunds);
  const churnCount = sumOf(churnCountSeries);
  const comparedTo = getComparisonLabel(period, periodRange);
  const periodPhrase = getPeriodPhrase(period, periodRange);
  const churnNote =
    churnCount === 0
      ? `Nenhum cancelamento ${periodPhrase}`
      : `${churnCount} cancelamento${churnCount === 1 ? "" : "s"} ${periodPhrase}`;

  const tooltipLabels = buckets.map((key) => formatBucketLabel(key, grouping));
  const axisLabels = buckets.map((key) => formatAxisLabel(key, grouping));

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
    link.download = `assinaturas-velo-${periodRange.startKey}_a_${periodRange.endKey}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell active="dashboard" userId="admin" fullBleed>
      <motion.div
        className="ov-page relative min-h-full px-5 pb-8 pt-1 max-md:p-0 md:pt-4 lg:px-7"
        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
        transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="min-h-full md:hidden">
          <AdminMobileHome
            loading={hideFinancialValues}
            approvedSales={finance.metrics.approved_sales}
            grossRevenue={finance.metrics.gross_revenue}
            costs={finance.metrics.costs}
            churnRate={churnRate}
            netRevenue={finance.metrics.net_revenue}
            series={netSparklineValues}
            comparison={previousNetSeries}
            labels={revenueSparklineLabels}
            grouping={grouping}
            groupingChoice={groupingChoice}
            groupingOptions={MOBILE_GROUPING_OPTIONS}
            onGroupingChange={(value) => setGroupingChoice(value as Grouping | "auto")}
            days={daysBetween(periodRange.startKey, periodRange.endKey)}
          />
        </div>

        <div className="max-md:hidden" data-admin-native>
          <motion.div
            className="ov-panel overflow-hidden"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-6 pb-8 pt-6 lg:px-7">
              <header className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ChartBarIcon aria-hidden="true" className="h-5 w-5 text-[color:var(--ov-text)]" />
                  <h1 className="text-[19px] font-medium tracking-[-0.02em] text-[color:var(--ov-text)]">Painel</h1>
                  {panelRefreshing ? <span className="text-[12.5px] text-[color:var(--ov-text-4)]">Atualizando…</span> : null}
                  {isError && !isFetching ? (
                    <span className="ml-1 inline-flex items-center gap-2 text-[12.5px] text-[color:var(--ov-negative)]">
                      Não foi possível carregar os dados.
                      <button
                        type="button"
                        onClick={() => void refetchWallet()}
                        className="rounded-md px-2 py-0.5 font-medium text-[color:var(--ov-text)] underline-offset-2 hover:underline"
                      >
                        Tentar de novo
                      </button>
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={downloadReport} className="ov-icon-button" aria-label="Exportar CSV" title="Exportar CSV">
                    <ArrowDownTrayIcon aria-hidden="true" />
                  </button>
                  <OverviewMenu label="Opções do painel" trigger={<EllipsisVerticalIcon aria-hidden="true" />}>
                    {(close) => (
                      <>
                        <p className="ov-menu-label">Agrupar gráfico por</p>
                        {GROUPING_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="menuitemradio"
                            aria-checked={groupingChoice === option.value}
                            className="ov-menu-item"
                            onClick={() => {
                              setGroupingChoice(option.value);
                              close();
                            }}
                          >
                            <span className="flex-1 text-left">{option.label}</span>
                            {groupingChoice === option.value ? <Check aria-hidden="true" /> : null}
                          </button>
                        ))}
                      </>
                    )}
                  </OverviewMenu>
                </div>
              </header>

              <section className="mt-6 grid gap-4 md:grid-cols-2 min-[1400px]:grid-cols-4">
                <OverviewStatCard
                  icon={BanknotesIcon}
                  label="Receita bruta"
                  value={hideFinancialValues ? null : finance.metrics.gross_revenue}
                  format="currency"
                  delta={revenueDelta}
                  comparedTo={comparedTo}
                  loading={financialDataLoading}
                />
                <OverviewStatCard
                  icon={ShoppingBagIcon}
                  label="Vendas aprovadas"
                  value={hideFinancialValues ? null : finance.metrics.approved_sales}
                  format="integer"
                  delta={salesDelta}
                  unit={{ singular: "venda", plural: "vendas" }}
                  comparedTo={comparedTo}
                  loading={financialDataLoading}
                />
                <OverviewStatCard
                  icon={UserMinusIcon}
                  label="Churn"
                  value={hideFinancialValues ? null : churnRate}
                  format="percent"
                  note={churnNote}
                  comparedTo={comparedTo}
                  loading={financialDataLoading}
                />
                <OverviewStatCard
                  icon={ReceiptRefundIcon}
                  label="Saídas"
                  value={hideFinancialValues ? null : finance.metrics.costs}
                  format="currency"
                  delta={refundsDelta}
                  invertDelta
                  comparedTo={comparedTo}
                  loading={financialDataLoading}
                />
              </section>

              <section className="mt-4">
                <OverviewRevenueCard
                  label="Receita líquida"
                  value={hideFinancialValues ? null : finance.metrics.net_revenue}
                  delta={netDelta}
                  comparedTo={comparedTo}
                  values={netSparklineValues}
                  tooltipLabels={tooltipLabels}
                  axisLabels={axisLabels}
                  seriesName="Receita líquida"
                  loading={financialDataLoading}
                  periodSelect={
                    <AdminDateRangePicker
                      presets={PERIOD_OPTIONS}
                      value={period}
                      range={periodRange}
                      todayKey={todayKey}
                      onPreset={(value) => setPeriod(value as Period)}
                      onCustom={(range) => {
                        setCustomRange(range);
                        setPeriod("custom");
                      }}
                    />
                  }
                />
              </section>

        <motion.section
          ref={activitySectionRef}
          className="ov-card mt-4 overflow-hidden"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5, delay: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="px-6 pb-4 pt-5">
            <h3 className="flex items-center gap-2 text-[15px] font-medium text-[color:var(--ov-text)]">
              <UsersIcon aria-hidden="true" className="h-5 w-5 text-[color:var(--ov-text)]" />
              Transações recentes
              <span aria-hidden="true" className="text-[color:var(--ov-text-5)]">•</span>
              <span className="tabular-nums">{activityCount.toLocaleString("pt-BR")} no período</span>
            </h3>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <label className="ov-search">
                <MagnifyingGlassIcon aria-hidden="true" />
                <span className="sr-only">Buscar assinante</span>
                <input
                  value={activitySearch}
                  onChange={(event) => setActivitySearch(event.target.value)}
                  placeholder="Buscar um nome…"
                />
              </label>
              <label className="ov-filter-chip">
                <FunnelIcon aria-hidden="true" />
                <span className="sr-only">Filtrar por status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                >
                  <option value="all">Status: todos</option>
                  <option value="approved">Aprovados</option>
                  <option value="pending">Pendentes</option>
                  <option value="issue">Com problema</option>
                </select>
              </label>
              <button type="button" onClick={downloadReport} className="ov-filter-chip">
                <ArrowDownTrayIcon aria-hidden="true" />
                Baixar relatório
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead>
                <tr className="border-y border-[color:var(--ov-divider)]">
                  <th className="px-4 py-3"><span className="ov-th"><UserIcon aria-hidden="true" />Assinante</span></th>
                  <th className="px-3 py-3"><span className="ov-th"><CalendarIcon aria-hidden="true" />Cobrança</span></th>
                  <th className="px-3 py-3"><span className="ov-th"><ArrowPathIcon aria-hidden="true" />Intervalo</span></th>
                  <th className="px-3 py-3"><span className="ov-th"><CurrencyDollarIcon aria-hidden="true" />Valor</span></th>
                  <th className="px-3 py-3"><span className="ov-th"><CubeIcon aria-hidden="true" />Produto</span></th>
                  <th className="px-3 py-3"><span className="ov-th"><CreditCardIcon aria-hidden="true" />Pagamento</span></th>
                  <th className="px-4 py-3"><span className="ov-th"><CheckCircleIcon aria-hidden="true" />Status</span></th>
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
                      key={"payment:" + activity.id}
                      className="border-t text-[13px] transition-colors"
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
                            <p className="truncate font-medium text-[color:var(--ov-text)]">{name}</p>
                            {email && email !== name ? <p className="mt-0.5 truncate text-[12px] text-[color:var(--ov-text-4)]">{email}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[color:var(--ov-text-2)]">{formatChargeDay(activity.created_at)}</p>
                        <p className="mt-0.5 text-[12px] text-[color:var(--ov-text-4)]">{formatDate(activity.created_at)} · {formatTime(activity.created_at)}</p>
                      </td>
                      <td className="px-3 py-2.5"><AdminBadge>{activity.interval}</AdminBadge></td>
                      <td className="admin-number px-3 py-2.5 font-medium text-[color:var(--ov-text)]">{activity.amount > 0 ? formatBRL(activity.amount) : "—"}</td>
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
                      className="border-t text-[13px] transition-colors"
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
                            <p className="truncate font-medium text-[color:var(--ov-text)]">{name}</p>
                            {identity?.name && identity.email ? <p className="mt-0.5 truncate text-[12px] text-[color:var(--ov-text-4)]">{identity.email}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[color:var(--ov-text-2)]">{formatChargeDay(chargeAt)}</p>
                        <p className="mt-0.5 text-[12px] text-[color:var(--ov-text-4)]">{formatDate(eventAt)} · {formatTime(eventAt)}</p>
                      </td>
                      <td className="px-3 py-2.5"><AdminBadge>{getBillingInterval(subscription)}</AdminBadge></td>
                      <td className="admin-number px-3 py-2.5 font-medium text-[color:var(--ov-text)]">{formatBRL(Number(subscription.amount ?? 0))}</td>
                      <td className="px-3 py-2.5 font-medium">{getPlanLabel(subscription.plan)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{getPaymentMethodLabel(subscription.payment_method)}</p>
                        {subscription.charge_attempts > 0 ? <p className="mt-0.5 text-[12px] text-[color:var(--ov-text-4)]">{subscription.charge_attempts} tentativa{subscription.charge_attempts === 1 ? "" : "s"}</p> : null}
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
            <div className="grid min-h-44 place-items-center border-t border-[color:var(--ov-divider)] px-6 text-center text-[13px] text-[color:var(--ov-negative)]">
              Não foi possível carregar os dados do painel.
            </div>
          ) : null}
          {!isLoading && !isError && activityCount === 0 ? (
            <div className="grid min-h-44 place-items-center border-t border-[color:var(--ov-divider)] px-6 text-center">
              <div>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[color:var(--ov-accent-soft)] text-[color:var(--ov-accent-text)]"><Search size={18} /></span>
                <p className="mt-3 text-[13px] font-medium text-[color:var(--ov-text-3)]">Nenhuma atividade encontrada neste período.</p>
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
            </div>
          </motion.div>
        </div>
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
    <span className={`relative block overflow-hidden rounded-sm bg-[color:var(--ov-shimmer)] ${className}`} aria-hidden="true">
      <motion.span
        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-[color:var(--ov-shimmer-glint)] to-transparent"
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

const ActivityTableSkeleton = () => (
  <>
    {Array.from({ length: 6 }, (_, rowIndex) => (
      <motion.tr
        key={rowIndex}
        className="border-t border-[color:var(--ov-divider)]"
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
      className="flex flex-col gap-3 border-t border-[color:var(--ov-divider)] bg-[color:var(--ov-footer)] px-6 py-3 sm:flex-row sm:items-center sm:justify-between"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
    >
      <p className="text-[12.5px] font-normal text-[color:var(--ov-text-4)]">
        Exibindo <span className="font-medium text-[color:var(--ov-text-2)]">{rangeStart}–{rangeEnd}</span> de {totalItems} atividades
      </p>
      <div className="flex items-center gap-1" aria-label="Paginação das atividades">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Página anterior"
          className="grid h-7 w-7 place-items-center rounded-md text-[color:var(--ov-text-3)] transition hover:bg-[color:var(--ov-surface)] hover:text-[color:var(--ov-text)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft size={13} strokeWidth={1.8} />
        </button>
        {firstVisiblePage > 1 ? <span className="px-1 text-[11px] text-[color:var(--ov-text-5)]">…</span> : null}
        {pages.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? "page" : undefined}
            aria-label={`Página ${pageNumber}`}
            className={`grid h-7 min-w-7 place-items-center rounded-md px-1.5 text-[11.5px] font-medium transition ${
              pageNumber === page
                ? "bg-[color:var(--ov-text)] text-[color:var(--ov-panel)]"
                : "text-[color:var(--ov-text-3)] hover:bg-[color:var(--ov-surface)] hover:text-[color:var(--ov-text)]"
            }`}
          >
            {pageNumber}
          </button>
        ))}
        {firstVisiblePage + visiblePageCount - 1 < totalPages ? (
          <span className="px-1 text-[11px] text-[color:var(--ov-text-5)]">…</span>
        ) : null}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Próxima página"
          className="grid h-7 w-7 place-items-center rounded-md text-[color:var(--ov-text-3)] transition hover:bg-[color:var(--ov-surface)] hover:text-[color:var(--ov-text)] disabled:cursor-not-allowed disabled:opacity-30"
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
