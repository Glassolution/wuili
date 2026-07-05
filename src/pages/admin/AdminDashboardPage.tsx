import { type ElementType, type ReactNode, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  Filter,
  LifeBuoy,
  Loader2,
  Lock,
  ReceiptText,
  RefreshCcw,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

type AdminMetrics = {
  total_users: number;
  paid_users: number;
  mrr: number;
  total_orders: number;
  gross_revenue: number;
  growth_rate: number;
};

type MonthlyRevenue = {
  key: string;
  label: string;
  value: number;
};

type AdminTransaction = {
  id: string;
  user_id: string;
  user_name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string;
  amount: number;
  status: string;
  created_at: string;
  mp_payment_id: string | null;
};

type OnboardingMetricPayload = {
  total_users: number;
  new_users_today: number;
  onboarding_completed: number;
  reached_payment: number;
  paying_users: number;
  conversion_rate: number;
};

type OnboardingUser = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  category: string | null;
  marketplace: string | null;
  referral_source: string | null;
  lead_origin?: string | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  payment_status: string;
  user_status: string;
  created_at: string;
};

type BreakdownPoint = {
  name: string;
  value: number;
};

type UsersByDayPoint = {
  key: string;
  label: string;
  users: number;
};

type OnboardingPayload = {
  metrics: OnboardingMetricPayload;
  usersByDay: UsersByDayPoint[];
  sourceBreakdown: BreakdownPoint[];
  categoryBreakdown: BreakdownPoint[];
  marketplaceBreakdown: BreakdownPoint[];
  funnel: BreakdownPoint[];
  users: OnboardingUser[];
};

type AdminDashboardPayload = {
  metrics: AdminMetrics;
  monthlyRevenue: MonthlyRevenue[];
  transactions: AdminTransaction[];
  onboarding?: OnboardingPayload;
};

type ProfileRow = {
  id: string;
  user_id?: string | null;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
  created_at: string;
};

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: string;
  amount: number | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  mp_payment_id?: string | null;
};

const MOCK_ACCOUNT = {
  userId: "mock-xavier-luis-felipe",
  name: "Xavier Luis Felipe",
  email: "xavierluisfelipe12@gmail.com",
  amount: 7500,
  createdAt: "2026-07-04T12:00:00.000Z",
};

const emptyPayload: AdminDashboardPayload = {
  metrics: {
    total_users: 0,
    paid_users: 0,
    mrr: 0,
    total_orders: 0,
    gross_revenue: 0,
    growth_rate: 0,
  },
  monthlyRevenue: [],
  transactions: [],
  onboarding: {
    metrics: {
      total_users: 0,
      new_users_today: 0,
      onboarding_completed: 0,
      reached_payment: 0,
      paying_users: 0,
      conversion_rate: 0,
    },
    usersByDay: [],
    sourceBreakdown: [],
    categoryBreakdown: [],
    marketplaceBreakdown: [],
    funnel: [],
    users: [],
  },
};

const getProfileUserId = (profile: ProfileRow) => profile.user_id ?? profile.id;

async function loadProfiles(): Promise<ProfileRow[]> {
  const fullSelect = await (supabase as any)
    .from("profiles")
    .select("id,user_id,full_name,display_name,email,avatar_url,created_at")
    .order("created_at", { ascending: false });

  if (!fullSelect.error) return (fullSelect.data ?? []) as ProfileRow[];

  const fallback = await (supabase as any)
    .from("profiles")
    .select("id,user_id,display_name,avatar_url,created_at")
    .order("created_at", { ascending: false });

  if (fallback.error) throw fallback.error;
  return (fallback.data ?? []) as ProfileRow[];
}

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildMonthlyRevenue = (subscriptions: SubscriptionRow[]) => {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return {
      key: getMonthKey(date),
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
      value: 0,
    };
  });

  const revenueByMonth = new Map(months.map((month) => [month.key, month]));

  for (const subscription of subscriptions) {
    const sourceDate = subscription.updated_at ?? subscription.created_at;
    if (!sourceDate) continue;
    const key = getMonthKey(new Date(sourceDate));
    const month = revenueByMonth.get(key);
    if (!month) continue;
    month.value += Number(subscription.amount ?? 0);
  }

  return months;
};

const calculateGrowth = (monthlyRevenue: MonthlyRevenue[]) => {
  const current = monthlyRevenue.at(-1)?.value ?? 0;
  const previous = monthlyRevenue.at(-2)?.value ?? 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

const isSameLocalDay = (date: Date, reference: Date) =>
  date.getFullYear() === reference.getFullYear() &&
  date.getMonth() === reference.getMonth() &&
  date.getDate() === reference.getDate();

const labelOrEmpty = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed || "Não informado";
};

const groupOnboardingRows = (rows: OnboardingUser[], key: keyof OnboardingUser): BreakdownPoint[] => {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = labelOrEmpty(row[key] as string | null);
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  }
  return Array.from(grouped, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

const getOnboardingOrigin = (row: OnboardingUser) => labelOrEmpty(row.referral_source ?? row.lead_origin);

const groupOnboardingOrigins = (rows: OnboardingUser[]): BreakdownPoint[] => {
  const grouped = new Map<string, number>();
  for (const row of rows) {
    const label = getOnboardingOrigin(row);
    grouped.set(label, (grouped.get(label) ?? 0) + 1);
  }
  return Array.from(grouped, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
};

const buildOnboardingUsersByDay = (rows: OnboardingUser[]): UsersByDayPoint[] => {
  const today = new Date();
  return Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (13 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date).replace(".", ""),
      users: rows.filter((row) => isSameLocalDay(new Date(row.created_at), date)).length,
    };
  });
};

const buildOnboardingOverview = (rows: OnboardingUser[]): OnboardingPayload => {
  const today = new Date();
  const totalUsers = rows.length;
  const completedOnboarding = rows.filter((row) => row.onboarding_completed).length;
  const reachedPayment = rows.filter((row) =>
    ["reached_payment", "paid"].includes((row.payment_status ?? "").toLowerCase())
  ).length;
  const payingUsers = rows.filter((row) => (row.payment_status ?? "").toLowerCase() === "paid").length;

  return {
    metrics: {
      total_users: totalUsers,
      new_users_today: rows.filter((row) => isSameLocalDay(new Date(row.created_at), today)).length,
      onboarding_completed: completedOnboarding,
      reached_payment: reachedPayment,
      paying_users: payingUsers,
      conversion_rate: totalUsers ? Math.round((payingUsers / totalUsers) * 1000) / 10 : 0,
    },
    usersByDay: buildOnboardingUsersByDay(rows),
    sourceBreakdown: groupOnboardingOrigins(rows),
    categoryBreakdown: groupOnboardingRows(rows, "category"),
    marketplaceBreakdown: groupOnboardingRows(rows, "marketplace"),
    funnel: [
      { name: "Cadastro", value: totalUsers },
      { name: "Setup", value: completedOnboarding },
      { name: "Pagamento", value: reachedPayment },
      { name: "Pagou", value: payingUsers },
    ],
    users: rows,
  };
};

async function fetchAdminOverview(): Promise<AdminDashboardPayload> {
  const { data, error } = await supabase.functions.invoke("admin-overview");
  if (error) {
    if (import.meta.env.DEV) return fetchAdminOverviewDevFallback();
    throw error;
  }
  return data as AdminDashboardPayload;
}

async function fetchAdminOverviewDevFallback(): Promise<AdminDashboardPayload> {
  const [
    totalUsersRes,
    paidUsersRes,
    activeSubsRes,
    paidGrossSubsRes,
    totalOrdersRes,
    transactionsRes,
    onboardingProfilesRes,
  ] = await Promise.all([
    (supabase as any).from("profiles").select("id", { count: "exact", head: true }),
    (supabase as any).from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    (supabase as any).from("subscriptions").select("amount").eq("status", "active"),
    (supabase as any)
      .from("subscriptions")
      .select("id,user_id,plan,amount,status,created_at,updated_at,mp_payment_id")
      .in("status", ["active", "paid"])
      .order("updated_at", { ascending: true }),
    (supabase as any).from("orders").select("id", { count: "exact", head: true }),
    (supabase as any)
      .from("subscriptions")
      .select("id,user_id,plan,amount,status,created_at,updated_at,mp_payment_id")
      .order("updated_at", { ascending: false })
      .limit(20),
    (supabase as any)
      .from("user_profiles")
      .select(
        "id,user_id,full_name,email,category,marketplace,referral_source,onboarding_step,onboarding_completed,payment_status,lead_origin,user_status,created_at,updated_at"
      )
      .order("created_at", { ascending: false }),
  ]);

  const error =
    totalUsersRes.error ??
    paidUsersRes.error ??
    activeSubsRes.error ??
    paidGrossSubsRes.error ??
    totalOrdersRes.error ??
    transactionsRes.error;

  if (error) throw error;

  const profiles = await loadProfiles();
  const profilesByUser = new Map<string, ProfileRow>();
  for (const profile of profiles) profilesByUser.set(getProfileUserId(profile), profile);

  const paidSubscriptions = [
    ...((paidGrossSubsRes.data ?? []) as SubscriptionRow[]),
    {
      id: "mock-subscription-xavier-luis-felipe",
      user_id: MOCK_ACCOUNT.userId,
      plan: "business",
      amount: MOCK_ACCOUNT.amount,
      status: "active",
      created_at: MOCK_ACCOUNT.createdAt,
      updated_at: MOCK_ACCOUNT.createdAt,
      mp_payment_id: "mock-mp-xavier-7500",
    },
  ];
  const monthlyRevenue = buildMonthlyRevenue(paidSubscriptions);
  const grossRevenue = paidSubscriptions.reduce((sum, subscription) => sum + Number(subscription.amount ?? 0), 0);
  const mrr = ((activeSubsRes.data ?? []) as Array<{ amount: number | null }>).reduce(
    (sum, subscription) => sum + Number(subscription.amount ?? 0),
    0
  );

  const transactionRows = [
    {
      id: "mock-subscription-xavier-luis-felipe",
      user_id: MOCK_ACCOUNT.userId,
      plan: "business",
      amount: MOCK_ACCOUNT.amount,
      status: "active",
      created_at: MOCK_ACCOUNT.createdAt,
      updated_at: MOCK_ACCOUNT.createdAt,
      mp_payment_id: "mock-mp-xavier-7500",
    },
    ...((transactionsRes.data ?? []) as SubscriptionRow[]),
  ];

  const transactions = transactionRows.map((subscription) => {
    const profile = profilesByUser.get(subscription.user_id);
    const isMockAccount = subscription.user_id === MOCK_ACCOUNT.userId;
    return {
      id: subscription.id,
      user_id: subscription.user_id,
      user_name: isMockAccount ? MOCK_ACCOUNT.name : profile?.full_name ?? profile?.display_name ?? profile?.email ?? null,
      email: isMockAccount ? MOCK_ACCOUNT.email : profile?.email ?? null,
      avatar_url: profile?.avatar_url ?? null,
      plan: subscription.plan,
      amount: Number(subscription.amount ?? 0),
      status: subscription.status,
      created_at: subscription.updated_at ?? subscription.created_at,
      mp_payment_id: subscription.mp_payment_id ?? null,
    };
  });

  return {
    metrics: {
      total_users: totalUsersRes.count ?? 0,
      paid_users: (paidUsersRes.count ?? 0) + 1,
      mrr: mrr + MOCK_ACCOUNT.amount,
      total_orders: totalOrdersRes.count ?? 0,
      gross_revenue: grossRevenue,
      growth_rate: calculateGrowth(monthlyRevenue),
    },
    monthlyRevenue,
    transactions,
    onboarding: buildOnboardingOverview((onboardingProfilesRes.data ?? []) as OnboardingUser[]),
  };
}

const adminRoleChecks = (userId: string) => [
  { _role: "admin" },
  { role: "admin" },
  { _user_id: userId, _role: "admin" },
  { user_id: userId, role: "admin" },
];

async function checkAdminAccess(userId: string, email?: string | null) {
  if (isAdminEmail(email)) return true;

  for (const params of adminRoleChecks(userId)) {
    const { data, error } = await (supabase as any).rpc("has_role", params);
    if (!error && data === true) return true;
  }

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("role")
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle();

  if (error) return false;
  return data?.role === "admin";
}

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

const formatDate = (value: string | null) => {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatPlan = (plan?: string | null) => {
  const normalized = (plan ?? "free").toLowerCase();
  if (normalized === "business") return "Business";
  if (normalized === "pro") return "Pro";
  if (normalized === "gratis" || normalized === "free") return "Gratuito";
  return plan ?? "Gratuito";
};

const formatStatus = (status?: string | null) => {
  const normalized = (status ?? "inactive").toLowerCase();
  if (["active", "approved", "authorized", "paid"].includes(normalized)) return "Ativo";
  if (["cancelled", "canceled", "inactive", "refunded"].includes(normalized)) return "Cancelado";
  if (["pending", "waiting", "in_process"].includes(normalized)) return "Pendente";
  return status ?? "Inativo";
};

const getStatusStyle = (status?: string | null) => {
  const normalized = (status ?? "").toLowerCase();
  if (["active", "approved", "authorized", "paid"].includes(normalized)) return "bg-emerald-500/10 text-emerald-300";
  if (["pending", "waiting", "in_process"].includes(normalized)) return "bg-amber-400/10 text-amber-200";
  return "bg-white/8 text-white/42";
};

const formatOnboardingStatus = (user: OnboardingUser) => {
  const payment = (user.payment_status ?? "").toLowerCase();
  if (payment === "paid") return "Pagante";
  if (payment === "reached_payment") return "No pagamento";
  if (user.onboarding_completed) return "Setup completo";
  if ((user.onboarding_step ?? 0) > 0) return `Setup ${user.onboarding_step}/3`;
  return "Cadastro";
};

const getOnboardingStatusStyle = (status: string) => {
  if (status === "Pagante") return "bg-emerald-400/10 text-emerald-300";
  if (status === "No pagamento") return "bg-sky-400/10 text-sky-200";
  if (status === "Setup completo") return "bg-white/10 text-white/76";
  return "bg-amber-300/10 text-amber-100";
};

const chartColors = ["#f8fafc", "#a7f3d0", "#93c5fd", "#fde68a", "#c4b5fd", "#fca5a5"];

const getInitials = (name?: string | null, email?: string | null) => {
  const source = name || email || "VL";
  return source
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const buildLinePath = (monthlyRevenue: MonthlyRevenue[]) => {
  const values = monthlyRevenue.length ? monthlyRevenue.map((month) => month.value) : [0, 0, 0, 0, 0, 0];
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const width = 920;
  const height = 260;
  const step = width / Math.max(values.length - 1, 1);
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * 210 - 25;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};

const AdminDashboardPage = () => {
  const { user, loading } = useAuth();

  const { data: isAdmin = false, isLoading: loadingRole } = useQuery({
    queryKey: ["admin-dashboard-access", user?.id],
    enabled: !!user?.id,
    queryFn: () => checkAdminAccess(user!.id, user!.email),
  });

  const { data: dashboard = emptyPayload, isLoading: loadingDashboard, isError } = useQuery({
    queryKey: ["admin-dashboard-overview"],
    enabled: !!user?.id && isAdmin,
    queryFn: fetchAdminOverview,
  });

  const { data: operationalCounts } = useQuery({
    queryKey: ["admin-dashboard-operational-counts"],
    enabled: !!user?.id && isAdmin,
    queryFn: async () => {
      const [{ count: refunds }, { count: tickets }] = await Promise.all([
        supabase.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      return { refunds: refunds ?? 0, tickets: tickets ?? 0 };
    },
  });

  const metrics = dashboard.metrics ?? emptyPayload.metrics;
  const monthlyRevenue = dashboard.monthlyRevenue ?? [];
  const transactions = dashboard.transactions ?? [];
  const onboarding = dashboard.onboarding ?? (emptyPayload.onboarding as OnboardingPayload);
  const [onboardingFilters, setOnboardingFilters] = useState({
    origin: "Todos",
    category: "Todos",
    marketplace: "Todos",
    status: "Todos",
    date: "",
  });

  const topTransactions = useMemo(
    () => [...transactions].sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0)).slice(0, 6),
    [transactions]
  );

  const planRevenue = useMemo(() => {
    const byPlan = new Map<string, { plan: string; amount: number; count: number }>();
    transactions.forEach((transaction) => {
      const key = formatPlan(transaction.plan);
      const current = byPlan.get(key) ?? { plan: key, amount: 0, count: 0 };
      current.amount += Number(transaction.amount ?? 0);
      current.count += 1;
      byPlan.set(key, current);
    });
    return Array.from(byPlan.values()).sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  const maxMonthlyRevenue = useMemo(
    () => Math.max(...monthlyRevenue.map((month) => month.value), 1),
    [monthlyRevenue]
  );

  const linePath = useMemo(() => buildLinePath(monthlyRevenue), [monthlyRevenue]);
  const growthPositive = metrics.growth_rate >= 0;
  const onboardingOptions = useMemo(() => {
    const unique = (values: string[]) => ["Todos", ...Array.from(new Set(values.filter(Boolean))).sort()];
    return {
      origins: unique(onboarding.users.map((row) => getOnboardingOrigin(row))),
      categories: unique(onboarding.users.map((row) => labelOrEmpty(row.category))),
      marketplaces: unique(onboarding.users.map((row) => labelOrEmpty(row.marketplace))),
      statuses: unique(onboarding.users.map((row) => formatOnboardingStatus(row))),
    };
  }, [onboarding.users]);
  const filteredOnboardingUsers = useMemo(
    () =>
      onboarding.users.filter((row) => {
        const rowDate = row.created_at?.slice(0, 10) ?? "";
        return (
          (onboardingFilters.origin === "Todos" || getOnboardingOrigin(row) === onboardingFilters.origin) &&
          (onboardingFilters.category === "Todos" || labelOrEmpty(row.category) === onboardingFilters.category) &&
          (onboardingFilters.marketplace === "Todos" || labelOrEmpty(row.marketplace) === onboardingFilters.marketplace) &&
          (onboardingFilters.status === "Todos" || formatOnboardingStatus(row) === onboardingFilters.status) &&
          (!onboardingFilters.date || rowDate === onboardingFilters.date)
        );
      }),
    [onboarding.users, onboardingFilters]
  );

  if (loading || loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111]">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#111] p-6 text-white">
        <div className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#181818] p-8 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black">
            <Lock size={21} />
          </div>
          <h1 className="mt-5 text-[24px] font-semibold tracking-[-0.04em]">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-white/50">
            Este dashboard é exclusivo para usuários com role admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell active="dashboard" userId={user.id}>
      {isError ? (
        <div className="m-6 rounded-[18px] border border-red-400/20 bg-red-500/10 p-6 text-red-100">
          <p className="text-[18px] font-semibold">Não foi possível carregar o dashboard admin.</p>
          <p className="mt-2 text-[14px] text-red-100/65">
            Verifique as permissões de leitura das tabelas profiles, subscriptions e orders.
          </p>
        </div>
      ) : loadingDashboard ? (
        <div className="flex min-h-[620px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      ) : (
        <div className="bg-[#171717] text-white">
          <header className="flex min-h-[74px] flex-col gap-4 border-b border-white/[0.07] px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-7">
            <div className="flex w-full max-w-[360px] items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.035] px-3 py-2 text-white/38">
              <Search size={16} />
              <span className="text-[13px]">Search...</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-[10px] border border-white/10 px-3 py-2 text-[13px] text-white/72 transition hover:bg-white/[0.05]">
                Export
              </button>
              <button className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.035]">
                <Bell size={15} />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-400" />
              </button>
            </div>
          </header>

          <div className="flex items-center gap-7 border-b border-white/[0.07] px-5 py-4 text-[14px] lg:px-7">
            <a href="#overview" className="border-b border-white pb-3 text-white">Overview</a>
            <a href="#orders" className="pb-3 text-white/48 transition hover:text-white">Orders</a>
            <a href="#historico" className="pb-3 text-white/48 transition hover:text-white">Revenue</a>
          </div>

          <main className="space-y-8 px-5 py-7 lg:px-7">
            <section id="overview">
              <div className="mb-6">
                <h1 className="text-[24px] font-semibold tracking-[-0.045em]">Overview</h1>
                <p className="mt-1 text-[13px] text-white/45">Visual summary of key performance metrics and real Velo data</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={CreditCard} label="Faturamento bruto" value={formatBRL(metrics.gross_revenue)} trend={`${growthPositive ? "↑" : "↓"} ${Math.abs(metrics.growth_rate).toFixed(1)}%`} positive={growthPositive} />
                <MetricCard icon={BarChart3} label="MRR" value={formatBRL(metrics.mrr)} trend="receita mensal" positive />
                <MetricCard icon={ShoppingBag} label="Pedidos" value={String(metrics.total_orders)} trend="operações reais" positive />
                <MetricCard icon={Users} label="Clientes pagos" value={String(metrics.paid_users)} trend={`${metrics.total_users} usuários`} positive />
              </div>
            </section>

            <section id="historico" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <Panel className="min-h-[430px]">
                <PanelHeader
                  title="Sales Revenue"
                  right={
                    <div className="flex items-center gap-2">
                      <Chip icon={Filter}>Filters</Chip>
                      <Chip icon={CalendarDays}>Últimos 6 meses</Chip>
                    </div>
                  }
                />

                <div className="mt-7 h-[330px] rounded-[14px] border border-white/[0.07] bg-[#151515] p-6">
                  <svg viewBox="0 0 980 300" className="h-full w-full overflow-visible">
                    {[0, 1, 2, 3, 4].map((line) => (
                      <line
                        key={line}
                        x1="0"
                        x2="980"
                        y1={40 + line * 52}
                        y2={40 + line * 52}
                        stroke="rgba(255,255,255,0.06)"
                      />
                    ))}
                    <path d={linePath} fill="none" stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    {monthlyRevenue.map((month, index) => (
                      <text key={month.key} x={index * (920 / Math.max(monthlyRevenue.length - 1, 1))} y="292" fill="rgba(255,255,255,0.55)" fontSize="12">
                        {month.label}
                      </text>
                    ))}
                  </svg>
                </div>
              </Panel>

              <div className="space-y-4">
                <Panel className="p-5">
                  <p className="text-[13px] text-white/45">Best deal</p>
                  <p className="mt-2 text-[34px] font-semibold tracking-[-0.06em]">{topTransactions[0] ? formatBRL(topTransactions[0].amount) : formatBRL(0)}</p>
                  <div className="mt-5 flex items-center gap-3">
                    {topTransactions[0] ? <Avatar transaction={topTransactions[0]} /> : <span className="h-9 w-9 rounded-full bg-white/10" />}
                    <div>
                      <p className="text-[14px] font-medium">{topTransactions[0]?.user_name || topTransactions[0]?.email || "Sem vendas"}</p>
                      <p className="text-[12px] text-white/40">{topTransactions[0] ? formatPlan(topTransactions[0].plan) : "Nenhum plano"}</p>
                    </div>
                  </div>
                </Panel>

                <Panel className="p-5">
                  <p className="text-[13px] text-white/45">Operação</p>
                  <div className="mt-4 space-y-3">
                    <MiniRow icon={ReceiptText} label="Pedidos" value={String(metrics.total_orders)} />
                    <MiniRow icon={RefreshCcw} label="Reembolsos pendentes" value={String(operationalCounts?.refunds ?? 0)} />
                    <MiniRow icon={LifeBuoy} label="Tickets abertos" value={String(operationalCounts?.tickets ?? 0)} />
                  </div>
                </Panel>
              </div>
            </section>

            <OnboardingIntelligenceSection
              onboarding={onboarding}
              users={filteredOnboardingUsers}
              filters={onboardingFilters}
              options={onboardingOptions}
              onFilterChange={(key, value) => setOnboardingFilters((current) => ({ ...current, [key]: value }))}
            />

            <section id="analytics" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Panel>
                <PanelHeader title="Receita por plano" right={<Chip icon={Filter}>Plans</Chip>} />
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {planRevenue.length === 0 ? (
                    <EmptyState message="Nenhuma receita por plano ainda." />
                  ) : (
                    planRevenue.map((plan) => (
                      <div key={plan.plan} className="rounded-[14px] border border-white/[0.07] bg-white/[0.035] p-4">
                        <p className="text-[13px] text-white/45">{plan.plan}</p>
                        <p className="mt-3 text-[25px] font-semibold tracking-[-0.055em]">{formatBRL(plan.amount)}</p>
                        <p className="mt-1 text-[12px] text-white/38">{plan.count} assinatura(s)</p>
                      </div>
                    ))
                  )}
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Revenue by month" right={<Chip icon={Filter}>Live</Chip>} />
                <div className="mt-6 flex h-[210px] items-end gap-3">
                  {monthlyRevenue.length === 0 ? (
                    <EmptyState message="Sem dados suficientes para o gráfico." />
                  ) : (
                    monthlyRevenue.map((month) => (
                      <div key={month.key} className="flex h-full flex-1 flex-col justify-end gap-2">
                        <div
                          className="rounded-t-[10px] bg-white/85 transition hover:bg-white"
                          style={{ height: `${Math.max((month.value / maxMonthlyRevenue) * 170, month.value > 0 ? 18 : 7)}px` }}
                          title={formatBRL(month.value)}
                        />
                        <span className="text-center text-[11px] capitalize text-white/40">{month.label}</span>
                      </div>
                    ))
                  )}
                </div>
              </Panel>
            </section>

            <section id="orders" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
              <Panel>
                <PanelHeader
                  title="Top Products"
                  right={
                    <div className="flex items-center gap-2">
                      <Chip icon={Filter}>Filters</Chip>
                      <Chip icon={CalendarDays}>Atual</Chip>
                    </div>
                  }
                />
                <div className="mt-5 max-h-[360px] overflow-auto">
                  <table className="w-full min-w-[780px] text-left text-[13px]">
                    <thead className="bg-white/[0.035] text-white/68">
                      <tr>
                        <th className="px-4 py-3 font-medium">Usuário</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Plano</th>
                        <th className="px-4 py-3 font-medium">Data</th>
                        <th className="px-4 py-3 text-right font-medium">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-white/42">Nenhuma transação encontrada.</td>
                        </tr>
                      ) : (
                        transactions.map((transaction) => (
                          <TransactionRow key={transaction.id} transaction={transaction} />
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel>
                <PanelHeader title="Ranking" right={<Chip icon={Filter}>Revenue</Chip>} />
                <div className="mt-5 space-y-3">
                  {(topTransactions.length ? topTransactions : transactions.slice(0, 5)).map((transaction) => (
                    <RankingRow key={transaction.id} transaction={transaction} />
                  ))}
                  {transactions.length === 0 && <EmptyState message="Nenhum ranking disponível." />}
                </div>
              </Panel>
            </section>

            <AffiliateTrackingSection />
          </main>
        </div>
      )}
    </AdminShell>
  );
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  trend,
  positive,
}: {
  icon: ElementType;
  label: string;
  value: string;
  trend: string;
  positive?: boolean;
}) => (
  <article className="rounded-[12px] border border-white/[0.08] bg-white/[0.045] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/[0.10] bg-[#1f1f1f] text-white">
        <Icon size={19} strokeWidth={1.7} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] text-white/45">{label}</p>
        <p className="mt-1 truncate text-[22px] font-semibold tracking-[-0.04em]">{value}</p>
      </div>
      <span className={cn("ml-auto flex items-center gap-1 text-[12px]", positive ? "text-emerald-400" : "text-red-300")}>
        {positive ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
        {trend}
      </span>
    </div>
  </article>
);

const Panel = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section className={cn("rounded-[12px] border border-white/[0.08] bg-[#181818] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]", className)}>
    {children}
  </section>
);

const PanelHeader = ({ title, right }: { title: string; right?: ReactNode }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <h2 className="text-[19px] font-semibold tracking-[-0.035em]">{title}</h2>
    {right}
  </div>
);

const Chip = ({ icon: Icon, children }: { icon: ElementType; children: ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-[8px] border border-white/[0.08] bg-white/[0.035] px-3 py-2 text-[12px] text-white/64">
    <Icon size={13} />
    {children}
  </span>
);

const MiniRow = ({ icon: Icon, label, value }: { icon: ElementType; label: string; value: string }) => (
  <div className="flex items-center justify-between rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-3 py-3">
    <span className="flex items-center gap-2.5 text-[13px] text-white/62">
      <Icon size={14} />
      {label}
    </span>
    <span className="font-semibold">{value}</span>
  </div>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex min-h-[110px] items-center justify-center rounded-[12px] border border-dashed border-white/[0.10] bg-white/[0.025] px-4 text-center text-[13px] text-white/38">
    {message}
  </div>
);

type OnboardingFilterKey = "origin" | "category" | "marketplace" | "status" | "date";

const OnboardingIntelligenceSection = ({
  onboarding,
  users,
  filters,
  options,
  onFilterChange,
}: {
  onboarding: OnboardingPayload;
  users: OnboardingUser[];
  filters: Record<OnboardingFilterKey, string>;
  options: {
    origins: string[];
    categories: string[];
    marketplaces: string[];
    statuses: string[];
  };
  onFilterChange: (key: OnboardingFilterKey, value: string) => void;
}) => (
  <section id="onboarding" className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/55">
          Onboarding intelligence
        </p>
        <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.055em]">Dados reais do fluxo</h2>
        <p className="mt-1 max-w-[640px] text-[13px] leading-6 text-white/45">
          Tudo que o usuário escolhe no cadastro vira métrica, gráfico e filtro no admin.
        </p>
      </div>
      <Chip icon={Activity}>Supabase live</Chip>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      <OnboardingMetric label="Usuários" value={String(onboarding.metrics.total_users)} />
      <OnboardingMetric label="Novos hoje" value={String(onboarding.metrics.new_users_today)} />
      <OnboardingMetric label="Setup completo" value={String(onboarding.metrics.onboarding_completed)} />
      <OnboardingMetric label="Chegaram no pagamento" value={String(onboarding.metrics.reached_payment)} />
      <OnboardingMetric label="Pagantes" value={String(onboarding.metrics.paying_users)} tone="green" />
      <OnboardingMetric label="Conversão" value={`${onboarding.metrics.conversion_rate}%`} tone="green" />
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <ChartPanel title="Usuários por dia">
        {onboarding.usersByDay.some((point) => point.users > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={onboarding.usersByDay}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.42)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#111" }} />
              <Line type="monotone" dataKey="users" stroke="#f8fafc" strokeWidth={2.4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="Ainda não existem usuários suficientes para este gráfico." />
        )}
      </ChartPanel>

      <ChartPanel title="Funil de entrada">
        {onboarding.funnel.some((point) => point.value > 0) ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={onboarding.funnel}>
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.48)", fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#111" }} />
              <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                {onboarding.funnel.map((_, index) => (
                  <Cell key={`funnel-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState message="O funil aparecerá assim que usuários passarem pelo onboarding." />
        )}
      </ChartPanel>
    </div>

    <div className="grid gap-6 xl:grid-cols-3">
      <BreakdownChart title="Origem dos leads" data={onboarding.sourceBreakdown} />
      <BreakdownChart title="Categorias escolhidas" data={onboarding.categoryBreakdown} />
      <BreakdownChart title="Marketplaces escolhidos" data={onboarding.marketplaceBreakdown} />
    </div>

    <Panel>
      <PanelHeader
        title="Usuários do onboarding"
        right={
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <FilterSelect label="Origem" value={filters.origin} options={options.origins} onChange={(value) => onFilterChange("origin", value)} />
            <FilterSelect label="Categoria" value={filters.category} options={options.categories} onChange={(value) => onFilterChange("category", value)} />
            <FilterSelect label="Marketplace" value={filters.marketplace} options={options.marketplaces} onChange={(value) => onFilterChange("marketplace", value)} />
            <FilterSelect label="Status" value={filters.status} options={options.statuses} onChange={(value) => onFilterChange("status", value)} />
            <input
              type="date"
              value={filters.date}
              onChange={(event) => onFilterChange("date", event.target.value)}
              className="h-10 rounded-[9px] border border-white/[0.08] bg-white/[0.035] px-3 text-[12px] text-white/72 outline-none [color-scheme:dark]"
            />
          </div>
        }
      />
      <div className="mt-5 max-h-[320px] overflow-auto">
        <table className="w-full min-w-[980px] text-left text-[13px]">
          <thead className="bg-white/[0.035] text-white/62">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">E-mail</th>
              <th className="px-4 py-3 font-medium">Categoria</th>
              <th className="px-4 py-3 font-medium">Marketplace</th>
              <th className="px-4 py-3 font-medium">Origem</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Data</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-white/42">
                  Nenhum usuário encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              users.map((row) => (
                <tr key={row.user_id} className="border-b border-white/[0.055] text-white/62 last:border-0">
                  <td className="px-4 py-3 font-medium text-white">{row.full_name || "Sem nome"}</td>
                  <td className="px-4 py-3">{row.email || "Sem e-mail"}</td>
                  <td className="px-4 py-3">{labelOrEmpty(row.category)}</td>
                  <td className="px-4 py-3">{labelOrEmpty(row.marketplace)}</td>
                  <td className="px-4 py-3">{getOnboardingOrigin(row)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", getOnboardingStatusStyle(formatOnboardingStatus(row)))}>
                      {formatOnboardingStatus(row)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDate(row.created_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Panel>
  </section>
);

const OnboardingMetric = ({ label, value, tone }: { label: string; value: string; tone?: "green" }) => (
  <article className="rounded-[12px] border border-white/[0.08] bg-white/[0.04] p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">{label}</p>
    <p className={cn("mt-3 text-[28px] font-semibold tracking-[-0.06em]", tone === "green" && "text-emerald-300")}>{value}</p>
  </article>
);

const ChartPanel = ({ title, children }: { title: string; children: ReactNode }) => (
  <Panel className="min-h-[300px]">
    <PanelHeader title={title} />
    <div className="mt-5">{children}</div>
  </Panel>
);

const tooltipStyle = {
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  color: "#111",
  fontSize: 12,
};

const BreakdownChart = ({ title, data }: { title: string; data: BreakdownPoint[] }) => (
  <ChartPanel title={title}>
    {data.length ? (
      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <ResponsiveContainer width="100%" height={150}>
          <PieChart>
            <Pie data={data.slice(0, 6)} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={3}>
              {data.slice(0, 6).map((_, index) => (
                <Cell key={`slice-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#111" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2">
          {data.slice(0, 6).map((row, index) => (
            <div key={row.name} className="flex items-center justify-between gap-3 text-[12px] text-white/58">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: chartColors[index % chartColors.length] }} />
                <span className="truncate">{row.name}</span>
              </span>
              <span className="font-semibold text-white/78">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    ) : (
      <EmptyState message="Sem dados reais para exibir ainda." />
    )}
  </ChartPanel>
);

const FilterSelect = ({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) => (
  <select
    aria-label={label}
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className="h-10 rounded-[9px] border border-white/[0.08] bg-white/[0.035] px-3 text-[12px] text-white/72 outline-none"
  >
    {options.map((option) => (
      <option key={option} value={option} className="bg-[#181818] text-white">
        {option}
      </option>
    ))}
  </select>
);

const Avatar = ({ transaction }: { transaction: AdminTransaction }) => (
  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[11px] font-bold text-black">
    {transaction.avatar_url ? (
      <img src={transaction.avatar_url} alt={transaction.user_name ?? "Usuário"} className="h-full w-full object-cover" />
    ) : (
      getInitials(transaction.user_name, transaction.email)
    )}
  </div>
);

const TransactionRow = ({ transaction }: { transaction: AdminTransaction }) => (
  <tr className="border-b border-white/[0.055] text-white/64 last:border-0">
    <td className="px-4 py-3">
      <div className="flex items-center gap-3">
        <Avatar transaction={transaction} />
        <div>
          <p className="font-medium text-white">{transaction.user_name || transaction.email || "Usuário"}</p>
          <p className="text-[11px] text-white/36">{transaction.email || transaction.user_id}</p>
        </div>
      </div>
    </td>
    <td className="px-4 py-3">
      <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", getStatusStyle(transaction.status))}>
        {formatStatus(transaction.status)}
      </span>
    </td>
    <td className="px-4 py-3">{formatPlan(transaction.plan)}</td>
    <td className="px-4 py-3">{formatDate(transaction.created_at)}</td>
    <td className="px-4 py-3 text-right font-semibold text-white">{formatBRL(transaction.amount)}</td>
  </tr>
);

const RankingRow = ({ transaction }: { transaction: AdminTransaction }) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-3 py-3">
    <Avatar transaction={transaction} />
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-white">{transaction.user_name || transaction.email || "Usuário"}</p>
      <p className="text-[11px] text-white/38">{formatPlan(transaction.plan)}</p>
    </div>
    <p className="text-[13px] font-semibold">{formatBRL(transaction.amount)}</p>
  </div>
);

const AffiliateTrackingSection = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-affiliate-tracking"],
    queryFn: async () => {
      const [affRes, clicksRes, convRes] = await Promise.all([
        (supabase as any).from("affiliates").select("code, user_id, created_at").order("created_at", { ascending: false }),
        (supabase as any).from("affiliate_clicks").select("affiliate_code"),
        (supabase as any).from("affiliate_conversions").select("affiliate_code, status, commission_value, subscriber_user_id"),
      ]);
      if (affRes.error) throw affRes.error;
      if (clicksRes.error) throw clicksRes.error;
      if (convRes.error) throw convRes.error;

      const affiliates = (affRes.data ?? []) as Array<{ code: string; user_id: string; created_at: string }>;
      const profiles = await loadProfiles();
      const profileByUser = new Map<string, ProfileRow>();
      for (const profile of profiles) profileByUser.set(getProfileUserId(profile), profile);

      const clicksByCode = new Map<string, number>();
      for (const click of (clicksRes.data ?? []) as Array<{ affiliate_code: string }>) {
        clicksByCode.set(click.affiliate_code, (clicksByCode.get(click.affiliate_code) ?? 0) + 1);
      }

      const signupsByCode = new Map<string, Set<string>>();
      const paidByCode = new Map<string, Set<string>>();
      const commissionByCode = new Map<string, number>();
      for (const conversion of (convRes.data ?? []) as Array<{
        affiliate_code: string;
        status: string;
        commission_value: number;
        subscriber_user_id: string;
      }>) {
        const signups = signupsByCode.get(conversion.affiliate_code) ?? new Set<string>();
        signups.add(conversion.subscriber_user_id);
        signupsByCode.set(conversion.affiliate_code, signups);

        if (["paid", "active", "approved", "authorized"].includes((conversion.status ?? "").toLowerCase())) {
          const paid = paidByCode.get(conversion.affiliate_code) ?? new Set<string>();
          paid.add(conversion.subscriber_user_id);
          paidByCode.set(conversion.affiliate_code, paid);
          commissionByCode.set(
            conversion.affiliate_code,
            (commissionByCode.get(conversion.affiliate_code) ?? 0) + Number(conversion.commission_value ?? 0)
          );
        }
      }

      return affiliates.map((affiliate) => {
        const profile = profileByUser.get(affiliate.user_id);
        return {
          code: affiliate.code,
          userName: profile?.full_name ?? profile?.display_name ?? profile?.email ?? affiliate.user_id,
          clicks: clicksByCode.get(affiliate.code) ?? 0,
          signups: signupsByCode.get(affiliate.code)?.size ?? 0,
          subscribers: paidByCode.get(affiliate.code)?.size ?? 0,
          commission: commissionByCode.get(affiliate.code) ?? 0,
        };
      });
    },
  });

  return (
    <Panel>
      <PanelHeader title="Affiliate tracking" right={<Chip icon={Activity}>Real data</Chip>} />
      <div className="mt-5 max-h-[340px] overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-white" />
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState message="Nenhum afiliado cadastrado ainda." />
        ) : (
          <table className="w-full min-w-[760px] text-left text-[13px]">
            <thead className="bg-white/[0.035] text-white/60">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Afiliado</th>
                <th className="px-4 py-3 text-right font-medium">Cliques</th>
                <th className="px-4 py-3 text-right font-medium">Cadastros</th>
                <th className="px-4 py-3 text-right font-medium">Assinantes</th>
                <th className="px-4 py-3 text-right font-medium">Comissão</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.code} className="border-b border-white/[0.055] text-white/64 last:border-0">
                  <td className="px-4 py-3 font-mono text-[12px] font-semibold text-white">{row.code}</td>
                  <td className="px-4 py-3 font-medium text-white">{row.userName}</td>
                  <td className="px-4 py-3 text-right">{row.clicks}</td>
                  <td className="px-4 py-3 text-right">{row.signups}</td>
                  <td className="px-4 py-3 text-right">{row.subscribers}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-300">{formatBRL(row.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
};

export default AdminDashboardPage;
