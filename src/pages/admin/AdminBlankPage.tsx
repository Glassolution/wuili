import { type ElementType, type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  Boxes,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Download,
  Headphones,
  LayoutDashboard,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Percent,
  Plus,
  Search,
  ShieldCheck,
  ShoppingCart,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "amount" | "created_at" | "updated_at" | "status" | "plan" | "is_trial"
>;

type OrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "created_at" | "ordered_at" | "platform" | "profit" | "status" | "total_amount"
>;

type PublicationRow = Pick<
  Database["public"]["Tables"]["user_publications"]["Row"],
  "created_at" | "price" | "published_at" | "status" | "title"
>;

type CatalogProductRow = Pick<
  Database["public"]["Tables"]["catalog_products"]["Row"],
  "category" | "margin_percent" | "orders_count" | "suggested_price" | "title"
>;

type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "created_at" | "display_name" | "store_name">;
type SupportTicketHistoryRow = Pick<Database["public"]["Tables"]["support_tickets"]["Row"], "created_at" | "status">;
type RefundRequestRow = Pick<Database["public"]["Tables"]["refund_requests"]["Row"], "created_at" | "status">;

type CountResult = {
  count: number | null;
  error: { message?: string } | null;
};

type AdminPanelData = {
  counts: {
    users: number;
    products: number;
    publications: number;
    orders: number;
    activeSubscriptions: number;
    openTickets: number;
    pendingRefunds: number;
  };
  subscriptions: SubscriptionRow[];
  orders: OrderRow[];
  publications: PublicationRow[];
  products: CatalogProductRow[];
  profiles: ProfileRow[];
  supportTickets: SupportTicketHistoryRow[];
  refundRequests: RefundRequestRow[];
};

type MonthPoint = {
  key: string;
  label: string;
  receita: number;
};

type DayPoint = {
  label: string;
  valor: number;
};

type RevenueRange = 3 | 6 | 12;

type DeltaTone = "positive" | "negative" | "neutral";

const revenueRangeLabels: Record<RevenueRange, string> = {
  3: "Últimos 3 meses",
  6: "Últimos 6 meses",
  12: "Últimos 12 meses",
};

const emptyData: AdminPanelData = {
  counts: {
    users: 0,
    products: 0,
    publications: 0,
    orders: 0,
    activeSubscriptions: 0,
    openTickets: 0,
    pendingRefunds: 0,
  },
  subscriptions: [],
  orders: [],
  publications: [],
  products: [],
  profiles: [],
  supportTickets: [],
  refundRequests: [],
};

const readCount = (result: CountResult) => (result.error ? 0 : result.count ?? 0);

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Number(value || 0));

const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const getSourceDate = (value: string | null) => (value ? new Date(value) : null);

const isWithinDateWindow = (value: string | null, start: Date, end: Date) => {
  const date = getSourceDate(value);
  if (!date) return false;
  return date >= start && date <= end;
};

const getDayWindow = (days: number, offsetDays = 0) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() - offsetDays);

  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

const getMonthWindow = (monthsCount: RevenueRange, offsetPeriods = 0) => {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth() + 1 - offsetPeriods * monthsCount, 0, 23, 59, 59, 999);
  const start = new Date(end.getFullYear(), end.getMonth() - (monthsCount - 1), 1, 0, 0, 0, 0);
  return { start, end };
};

const buildMonthSeries = (subscriptions: SubscriptionRow[], monthsCount: RevenueRange): MonthPoint[] => {
  const { start } = getMonthWindow(monthsCount, 0);
  const months = Array.from({ length: monthsCount }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: getMonthKey(date),
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
      receita: 0,
    };
  });

  const byKey = new Map(months.map((month) => [month.key, month]));
  subscriptions.forEach((subscription) => {
    const sourceDate = subscription.updated_at ?? subscription.created_at;
    if (!sourceDate) return;
    const month = byKey.get(getMonthKey(new Date(sourceDate)));
    if (!month) return;
    month.receita += Number(subscription.amount ?? 0);
  });

  return months;
};

const buildDailyCountSeries = (dates: Array<string | null>, days = 7): DayPoint[] => {
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (days - 1 - index));
    const key = date.toISOString().slice(0, 10);
    return {
      label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", ""),
      valor: dates.filter((value) => (value ?? "").slice(0, 10) === key).length,
    };
  });
};

const getCurrentVsPreviousCount = (dates: Array<string | null>, days: number) => {
  const current = getDayWindow(days, 0);
  const previous = getDayWindow(days, days);
  return {
    current: dates.filter((value) => isWithinDateWindow(value, current.start, current.end)).length,
    previous: dates.filter((value) => isWithinDateWindow(value, previous.start, previous.end)).length,
  };
};

const getCurrentVsPreviousRevenue = (subscriptions: SubscriptionRow[], monthsCount: RevenueRange) => {
  const currentWindow = getMonthWindow(monthsCount, 0);
  const previousWindow = getMonthWindow(monthsCount, 1);

  const sumInWindow = (start: Date, end: Date) =>
    subscriptions.reduce((sum, subscription) => {
      const sourceDate = subscription.updated_at ?? subscription.created_at;
      if (!isWithinDateWindow(sourceDate, start, end)) return sum;
      return sum + Number(subscription.amount ?? 0);
    }, 0);

  return {
    current: sumInWindow(currentWindow.start, currentWindow.end),
    previous: sumInWindow(previousWindow.start, previousWindow.end),
  };
};

const getCurrentVsPreviousSubscriptionRevenue = (subscriptions: SubscriptionRow[], days: number) => {
  const currentWindow = getDayWindow(days, 0);
  const previousWindow = getDayWindow(days, days);

  const sumInWindow = (start: Date, end: Date) =>
    subscriptions.reduce((sum, subscription) => {
      const sourceDate = subscription.updated_at ?? subscription.created_at;
      if (!isWithinDateWindow(sourceDate, start, end)) return sum;
      return sum + Number(subscription.amount ?? 0);
    }, 0);

  return {
    current: sumInWindow(currentWindow.start, currentWindow.end),
    previous: sumInWindow(previousWindow.start, previousWindow.end),
  };
};

const getCurrentVsPreviousPendingActivity = (supportTickets: SupportTicketHistoryRow[], refundRequests: RefundRequestRow[], days: number) => {
  const supportDates = supportTickets
    .filter((ticket) => ticket.status === "open")
    .map((ticket) => ticket.created_at);
  const refundDates = refundRequests
    .filter((refund) => refund.status === "pending")
    .map((refund) => refund.created_at);

  const currentSupport = getCurrentVsPreviousCount(supportDates, days);
  const currentRefunds = getCurrentVsPreviousCount(refundDates, days);

  return {
    current: currentSupport.current + currentRefunds.current,
    previous: currentSupport.previous + currentRefunds.previous,
  };
};

const getDeltaMeta = (current: number, previous: number) => {
  if (current === 0 && previous === 0) {
    return { tone: "neutral" as DeltaTone, value: 0 };
  }

  if (previous === 0) {
    return { tone: "positive" as DeltaTone, value: 100 };
  }

  const raw = ((current - previous) / Math.abs(previous)) * 100;
  if (raw > 0) return { tone: "positive" as DeltaTone, value: raw };
  if (raw < 0) return { tone: "negative" as DeltaTone, value: raw };
  return { tone: "neutral" as DeltaTone, value: 0 };
};

const formatDelta = (delta: number) => {
  const sign = delta > 0 ? "+" : delta < 0 ? "-" : "";
  return `${sign}${Math.abs(delta).toFixed(1).replace(".", ",")}%`;
};

const getActiveRevenue = (subscriptions: SubscriptionRow[]) =>
  subscriptions
    .filter((subscription) => ["active", "paid", "approved", "authorized"].includes(String(subscription.status).toLowerCase()))
    .reduce((sum, subscription) => sum + Number(subscription.amount ?? 0), 0);

const getGrossRevenue = (orders: OrderRow[], subscriptions: SubscriptionRow[]) => {
  const ordersRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount ?? 0), 0);
  const subscriptionsRevenue = subscriptions.reduce((sum, subscription) => sum + Number(subscription.amount ?? 0), 0);
  return ordersRevenue + subscriptionsRevenue;
};

const fetchAdminPanelData = async (): Promise<AdminPanelData> => {
  const [
    usersCount,
    productsCount,
    publicationsCount,
    ordersCount,
    activeSubscriptionsCount,
    openTicketsCount,
    pendingRefundsCount,
    subscriptionsResult,
    ordersResult,
    publicationsResult,
    productsResult,
    profilesResult,
    supportTicketsResult,
    refundRequestsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("catalog_products").select("id", { count: "exact", head: true }).eq("is_blocked", false),
    supabase.from("user_publications").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "paid", "approved"]),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("refund_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("subscriptions")
      .select("amount,created_at,updated_at,status,plan,is_trial")
      .order("updated_at", { ascending: false })
      .limit(1000),
    supabase
      .from("orders")
      .select("created_at,ordered_at,platform,profit,status,total_amount")
      .order("created_at", { ascending: false })
      .limit(180),
    supabase
      .from("user_publications")
      .select("created_at,price,published_at,status,title")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("catalog_products")
      .select("category,margin_percent,orders_count,suggested_price,title")
      .eq("is_blocked", false)
      .order("orders_count", { ascending: false, nullsFirst: false })
      .limit(8),
    supabase
      .from("profiles")
      .select("created_at,display_name,store_name")
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("support_tickets")
      .select("created_at,status")
      .order("created_at", { ascending: false })
      .limit(160),
    supabase
      .from("refund_requests")
      .select("created_at,status")
      .order("created_at", { ascending: false })
      .limit(160),
  ]);

  return {
    counts: {
      users: readCount(usersCount),
      products: readCount(productsCount),
      publications: readCount(publicationsCount),
      orders: readCount(ordersCount),
      activeSubscriptions: readCount(activeSubscriptionsCount),
      openTickets: readCount(openTicketsCount),
      pendingRefunds: readCount(pendingRefundsCount),
    },
    subscriptions: subscriptionsResult.error ? [] : subscriptionsResult.data ?? [],
    orders: ordersResult.error ? [] : ordersResult.data ?? [],
    publications: publicationsResult.error ? [] : publicationsResult.data ?? [],
    products: productsResult.error ? [] : productsResult.data ?? [],
    profiles: profilesResult.error ? [] : profilesResult.data ?? [],
    supportTickets: supportTicketsResult.error ? [] : supportTicketsResult.data ?? [],
    refundRequests: refundRequestsResult.error ? [] : refundRequestsResult.data ?? [],
  };
};

const AdminBlankPage = () => {
  const { user } = useAuth();
  const [revenueRange, setRevenueRange] = useState<RevenueRange>(6);
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
  const { data = emptyData, isLoading } = useQuery({
    queryKey: ["admin-panel-command-center"],
    queryFn: fetchAdminPanelData,
    refetchInterval: 30000,
  });

  const monthSeries = useMemo(() => buildMonthSeries(data.subscriptions, revenueRange), [data.subscriptions, revenueRange]);
  const usersByDay = useMemo(
    () => buildDailyCountSeries(data.profiles.map((profile) => profile.created_at)),
    [data.profiles]
  );
  const ordersByDay = useMemo(
    () => buildDailyCountSeries(data.orders.map((order) => order.ordered_at ?? order.created_at)),
    [data.orders]
  );

  const activeRevenue = useMemo(() => getActiveRevenue(data.subscriptions), [data.subscriptions]);
  const grossRevenue = useMemo(() => getGrossRevenue(data.orders, data.subscriptions), [data.orders, data.subscriptions]);
  const openWork = data.counts.openTickets + data.counts.pendingRefunds;
  const avgMargin = data.products.length
    ? data.products.reduce((sum, product) => sum + Number(product.margin_percent ?? 0), 0) / data.products.length
    : 0;

  const revenuePeriod = useMemo(
    () => getCurrentVsPreviousRevenue(data.subscriptions, revenueRange),
    [data.subscriptions, revenueRange]
  );
  const usersPeriod = useMemo(
    () => getCurrentVsPreviousCount(data.profiles.map((profile) => profile.created_at), 30),
    [data.profiles]
  );
  const revenueCardPeriod = useMemo(
    () => getCurrentVsPreviousSubscriptionRevenue(data.subscriptions, 30),
    [data.subscriptions]
  );
  const catalogPeriod = useMemo(
    () => getCurrentVsPreviousCount(data.publications.map((publication) => publication.created_at), 30),
    [data.publications]
  );
  const pendingPeriod = useMemo(
    () => getCurrentVsPreviousPendingActivity(data.supportTickets, data.refundRequests, 14),
    [data.supportTickets, data.refundRequests]
  );
  const usersWeek = useMemo(
    () => getCurrentVsPreviousCount(data.profiles.map((profile) => profile.created_at), 7),
    [data.profiles]
  );
  const ordersWeek = useMemo(
    () => getCurrentVsPreviousCount(data.orders.map((order) => order.ordered_at ?? order.created_at), 7),
    [data.orders]
  );

  const revenueDelta = getDeltaMeta(revenuePeriod.current, revenuePeriod.previous);
  const usersDelta = getDeltaMeta(usersPeriod.current, usersPeriod.previous);
  const revenueCardDelta = getDeltaMeta(revenueCardPeriod.current, revenueCardPeriod.previous);
  const catalogDelta = getDeltaMeta(catalogPeriod.current, catalogPeriod.previous);
  const pendingDelta = getDeltaMeta(pendingPeriod.current, pendingPeriod.previous);
  const usersWeekDelta = getDeltaMeta(usersWeek.current, usersWeek.previous);
  const ordersWeekDelta = getDeltaMeta(ordersWeek.current, ordersWeek.previous);

  const platformSummary = useMemo(() => {
    const byPlatform = new Map<string, number>();
    data.orders.forEach((order) => {
      const platform = order.platform || "Sem origem";
      byPlatform.set(platform, (byPlatform.get(platform) ?? 0) + 1);
    });
    return Array.from(byPlatform, ([name, value]) => ({ name, value })).slice(0, 5);
  }, [data.orders]);

  const topProducts = data.products.slice(0, 5);
  const topProductsOrders = topProducts.reduce((sum, product) => sum + Number(product.orders_count ?? 0), 0);
  const activeTrials = data.subscriptions.filter((item) => item.is_trial).length;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#F5F5F5]">
      <div className="flex min-h-screen">
        <aside className="hidden w-[252px] shrink-0 bg-[#111111] px-4 py-4 lg:flex lg:flex-col">
          <Link to="/admin/painel" className="flex items-center gap-3 rounded-[14px] px-2 py-2">
            <VeloMark />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[18px] font-semibold tracking-[-0.04em] text-[#F5F5F5]">VeloMetric</p>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">
                  Admin
                </span>
              </div>
              <p className="mt-1 text-[12px] text-[#6B7280]">Painel interno da operação Velo</p>
            </div>
          </Link>

          <nav className="mt-8 space-y-1">
            <SidebarLink icon={LayoutDashboard} label="Painel" to="/admin/painel" active />
            <SidebarLink icon={Percent} label="Comissões" to="/admin/comissoes" />
            <SidebarLink icon={Users} label="Usuários" to="/admin/usuarios" />
            <SidebarLink icon={Headphones} label="Suporte" to="/admin/suporte" />
          </nav>

          <div className="mt-auto space-y-3 pt-6">
            <div className="rounded-[12px] border border-[#262626] bg-[#171717] p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-white/[0.06] text-white">
                  <ShieldCheck size={17} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[#9CA3AF]">Admin ID</p>
                  <p className="truncate text-[14px] font-semibold tracking-[0.04em] text-[#F5F5F5]">
                    {(user?.id ?? "VELOADMIN").slice(0, 8).toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            <Link
              to="/dashboard"
              className="flex h-11 items-center gap-2 rounded-[12px] border border-transparent px-3 text-[13px] font-medium text-[#D1D5DB] transition hover:border-white/5 hover:bg-white/[0.03] hover:text-white"
            >
              <ArrowLeft size={15} />
              Voltar à Velo
            </Link>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-white/5 px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="lg:hidden">
                  <VeloMark />
                </div>
                <label className="flex h-11 min-w-0 items-center gap-3 rounded-full border border-[#262626] bg-[#121212] px-4 text-[#6B7280] sm:w-[360px]">
                  <Search size={15} />
                  <input
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-[#F5F5F5] outline-none placeholder:text-[#6B7280]"
                    placeholder="Buscar usuário, pedido ou produto..."
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center rounded-full border border-[#262626] bg-[#121212] p-1">
                  <button className="rounded-full bg-[#1D1D1D] px-4 py-2 text-[12px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    Mensal
                  </button>
                  <button className="rounded-full px-4 py-2 text-[12px] font-medium text-[#6B7280] transition hover:text-white">
                    Anual
                  </button>
                </div>

                <button className="inline-flex h-11 items-center gap-2 rounded-full border border-[#2A2A2A] bg-transparent px-4 text-[13px] font-medium text-[#D1D5DB] transition hover:border-[#3A3A3A] hover:bg-white/[0.03] hover:text-white">
                  <Download size={15} />
                  Exportar
                </button>

                <button className="inline-flex h-11 items-center gap-2 rounded-full bg-[#22C55E] px-4 text-[13px] font-semibold text-white transition hover:bg-[#1fb455]">
                  <Plus size={15} />
                  Relatório
                </button>

                <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#262626] bg-[#121212] text-[#D1D5DB] transition hover:border-[#3A3A3A] hover:text-white">
                  <Bell size={16} />
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#22C55E]" />
                </button>
              </div>
            </div>
          </header>

          <div className="space-y-4 px-4 py-4 sm:px-5 lg:px-6 lg:py-6">
            {isLoading ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-[20px] border border-[#262626] bg-[#111111]">
                <Loader2 className="h-8 w-8 animate-spin text-white/80" />
              </div>
            ) : (
              <>
                <section className="grid gap-4 xl:grid-cols-4">
                  <MetricCard
                    icon={Users}
                    label="Usuários totais"
                    value={formatNumber(data.counts.users)}
                    description={`${formatNumber(data.counts.activeSubscriptions)} assinaturas ativas`}
                    delta={usersDelta}
                    accent="violet"
                  />
                  <MetricCard
                    icon={CircleDollarSign}
                    label="Receita ativa"
                    value={formatBRL(activeRevenue)}
                    description={`${formatBRL(grossRevenue)} no histórico carregado`}
                    delta={revenueCardDelta}
                    accent="green"
                  />
                  <MetricCard
                    icon={Boxes}
                    label="Catálogo Velo"
                    value={formatNumber(data.counts.products)}
                    description={`${Math.round(avgMargin)}% margem média dos destaques`}
                    delta={catalogDelta}
                    accent="blue"
                  />
                  <MetricCard
                    icon={Headphones}
                    label="Pendências"
                    value={formatNumber(openWork)}
                    description={`${data.counts.openTickets} suporte · ${data.counts.pendingRefunds} reembolsos`}
                    delta={pendingDelta}
                    accent="rose"
                  />
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]">
                  <SurfaceCard className="p-5 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[12px] font-medium text-[#9CA3AF]">Receita recorrente</p>
                        <div className="mt-3 flex flex-wrap items-end gap-3">
                          <p className="text-[34px] font-bold tracking-[-0.04em] text-[#F5F5F5]">
                            {formatBRL(revenuePeriod.current)}
                          </p>
                          <DeltaInline delta={revenueDelta} />
                        </div>
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setPeriodMenuOpen((open) => !open)}
                          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#2A2A2A] bg-[#121212] px-4 text-[12px] font-medium text-[#D1D5DB] transition hover:border-[#3A3A3A] hover:text-white"
                        >
                          <CalendarDays size={14} />
                          {revenueRangeLabels[revenueRange]}
                          <ChevronDown size={14} />
                        </button>

                        {periodMenuOpen && (
                          <div className="absolute right-0 top-12 z-10 w-44 overflow-hidden rounded-[14px] border border-[#2A2A2A] bg-[#151515] p-1 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
                            {([3, 6, 12] as RevenueRange[]).map((range) => (
                              <button
                                key={range}
                                type="button"
                                onClick={() => {
                                  setRevenueRange(range);
                                  setPeriodMenuOpen(false);
                                }}
                                className={cn(
                                  "flex h-10 w-full items-center rounded-[10px] px-3 text-left text-[12px] font-medium transition",
                                  range === revenueRange
                                    ? "bg-[#202020] text-white"
                                    : "text-[#9CA3AF] hover:bg-white/[0.03] hover:text-white"
                                )}
                              >
                                {revenueRangeLabels[range]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthSeries}>
                          <defs>
                            <linearGradient id="adminRevenueFill" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.28} />
                              <stop offset="75%" stopColor="#22C55E" stopOpacity={0.04} />
                              <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#6B7280", fontSize: 12 }}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#6B7280", fontSize: 11 }}
                            width={56}
                            tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
                          />
                          <Tooltip content={<ChartTooltip formatter={formatBRL} />} />
                          <Area
                            type="monotone"
                            dataKey="receita"
                            stroke="#22C55E"
                            strokeWidth={2.4}
                            fill="url(#adminRevenueFill)"
                            dot={{ r: 0 }}
                            activeDot={{ r: 4, fill: "#22C55E", strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </SurfaceCard>

                  <div className="grid gap-4">
                    <MiniTrendCard
                      icon={Users}
                      label="Novos usuários"
                      value={formatNumber(usersWeek.current)}
                      delta={usersWeekDelta}
                      linkLabel="Ver relatório"
                      accent="violet"
                      chart={
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={usersByDay}>
                            <defs>
                              <linearGradient id="miniUsersFill" x1="0" x2="0" y1="0" y2="1">
                                <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.26} />
                                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Tooltip content={<ChartTooltip />} />
                            <Area
                              type="monotone"
                              dataKey="valor"
                              stroke="#8B5CF6"
                              strokeWidth={2}
                              fill="url(#miniUsersFill)"
                              dot={false}
                            />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
                            <YAxis hide />
                          </AreaChart>
                        </ResponsiveContainer>
                      }
                    />

                    <MiniTrendCard
                      icon={ShoppingCart}
                      label="Pedidos recentes"
                      value={formatNumber(ordersWeek.current)}
                      delta={ordersWeekDelta}
                      linkLabel="Ver relatório"
                      accent="green"
                      chart={
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ordersByDay}>
                            <Tooltip content={<ChartTooltip />} />
                            <Bar dataKey="valor" fill="#22C55E" radius={[6, 6, 2, 2]} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
                            <YAxis hide />
                          </BarChart>
                        </ResponsiveContainer>
                      }
                    />
                  </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.75fr)]">
                  <SurfaceCard className="p-5 sm:p-6">
                    <CardHeader
                      title="Produtos em alta"
                      subtitle="Itens do catálogo com maior volume de pedidos"
                      action={<IconButton />}
                    />
                    <div className="mt-5 space-y-3">
                      {topProducts.length ? (
                        topProducts.map((product, index) => (
                          <ProductRow key={`${product.title}-${index}`} product={product} index={index} />
                        ))
                      ) : (
                        <EmptyState text="Nenhum produto do catálogo disponível para ranquear no momento." />
                      )}
                    </div>
                  </SurfaceCard>

                  <SurfaceCard className="p-5 sm:p-6">
                    <CardHeader
                      title="Pedidos por plataforma"
                      subtitle={`${formatNumber(data.counts.orders)} pedidos monitorados`}
                      action={<IconButton />}
                    />
                    <div className="mt-5 space-y-4">
                      {platformSummary.length ? (
                        platformSummary.map((item) => (
                          <PlatformRow
                            key={item.name}
                            label={item.name}
                            value={item.value}
                            total={data.counts.orders}
                          />
                        ))
                      ) : (
                        <EmptyState text="Os canais com pedidos aparecerão aqui assim que o painel receber volume suficiente." />
                      )}
                    </div>
                  </SurfaceCard>
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.7fr)]">
                  <SurfaceCard className="p-5 sm:p-6">
                    <CardHeader
                      title="Publicações recentes"
                      subtitle={`${formatNumber(data.counts.publications)} anúncios publicados no total`}
                      action={
                        <span className="rounded-full border border-[#2A2A2A] bg-[#121212] px-3 py-1.5 text-[11px] font-medium text-[#D1D5DB]">
                          {formatNumber(data.counts.publications)} anúncios
                        </span>
                      }
                    />
                    <div className="mt-5 overflow-hidden rounded-[14px] border border-[#262626]">
                      <table className="w-full min-w-[720px] text-left">
                        <thead className="bg-[#141414] text-[11px] uppercase tracking-[0.12em] text-[#6B7280]">
                          <tr>
                            <th className="px-4 py-3 font-medium">Publicação</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Data</th>
                            <th className="px-4 py-3 text-right font-medium">Preço</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.publications.length ? (
                            data.publications.slice(0, 6).map((publication, index) => (
                              <tr key={`${publication.title}-${index}`} className="border-t border-[#262626] text-[13px] text-[#D1D5DB]">
                                <td className="max-w-[340px] truncate px-4 py-3 font-medium text-[#F5F5F5]">
                                  {publication.title}
                                </td>
                                <td className="px-4 py-3">
                                  <StatusPill value={publication.status ?? "pendente"} />
                                </td>
                                <td className="px-4 py-3 text-[#9CA3AF]">
                                  {formatDate(publication.published_at ?? publication.created_at)}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-[#F5F5F5]">
                                  {formatBRL(Number(publication.price ?? 0))}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-4 py-10 text-center text-[13px] text-[#6B7280]">
                                Nenhuma publicação encontrada.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </SurfaceCard>

                  <div className="grid gap-4">
                    <SurfaceCard className="p-5">
                      <CardHeader
                        title="Pendências abertas"
                        subtitle="Fila atual de suporte e reembolso"
                        action={<IconButton />}
                      />
                      <div className="mt-5 grid gap-3">
                        <SignalRow label="Suporte aberto" value={data.counts.openTickets} tone={data.counts.openTickets ? "warning" : "ok"} />
                        <SignalRow label="Reembolsos pendentes" value={data.counts.pendingRefunds} tone={data.counts.pendingRefunds ? "warning" : "ok"} />
                        <SignalRow label="Trials ativos" value={activeTrials} tone="neutral" />
                      </div>
                    </SurfaceCard>

                    <SurfaceCard className="p-5">
                      <CardHeader
                        title="Leitura rápida"
                        subtitle="Resumo operacional do painel"
                        action={<IconButton />}
                      />
                      <div className="mt-5 grid gap-3">
                        <QuickStat label="Receita ativa" value={formatBRL(activeRevenue)} tone="positive" />
                        <QuickStat label="Pedidos carregados" value={formatNumber(data.counts.orders)} tone="neutral" />
                        <QuickStat label="Top produtos" value={formatNumber(topProductsOrders)} tone="positive" />
                      </div>
                    </SurfaceCard>
                  </div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

const SidebarLink = ({
  icon: Icon,
  label,
  to,
  active = false,
}: {
  icon: ElementType;
  label: string;
  to: string;
  active?: boolean;
}) => (
  <Link
    to={to}
    className={cn(
      "group flex h-11 items-center gap-3 rounded-[12px] px-3 text-[14px] font-medium transition",
      active
        ? "bg-[#1B1B1B] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        : "text-[#9CA3AF] hover:bg-white/[0.03] hover:text-white"
    )}
  >
    <Icon size={16} strokeWidth={active ? 2.15 : 1.9} />
    {label}
  </Link>
);

const SurfaceCard = ({ children, className }: { children: ReactNode; className?: string }) => (
  <section
    className={cn(
      "rounded-[12px] border border-[#262626] bg-[#171717] shadow-[0_16px_40px_rgba(0,0,0,0.18)]",
      className
    )}
  >
    {children}
  </section>
);

const MetricCard = ({
  icon: Icon,
  label,
  value,
  description,
  delta,
  accent,
}: {
  icon: ElementType;
  label: string;
  value: string;
  description: string;
  delta: { tone: DeltaTone; value: number };
  accent: "violet" | "green" | "blue" | "rose";
}) => {
  const accentClass = {
    violet: "bg-violet-500/15 text-violet-400",
    green: "bg-emerald-500/15 text-emerald-400",
    blue: "bg-sky-500/15 text-sky-400",
    rose: "bg-rose-500/15 text-rose-400",
  }[accent];

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-[12px]", accentClass)}>
          <Icon size={18} />
        </span>
        <div>
          <p className="text-[12px] font-medium text-[#9CA3AF]">{label}</p>
        </div>
      </div>
      <p className="mt-5 text-[31px] font-bold tracking-[-0.04em] text-[#F5F5F5]">{value}</p>
      <p className="mt-2 text-[12px] text-[#9CA3AF]">{description}</p>
      <div className="mt-4">
        <DeltaInline delta={delta} />
      </div>
    </SurfaceCard>
  );
};

const MiniTrendCard = ({
  icon: Icon,
  label,
  value,
  delta,
  linkLabel,
  accent,
  chart,
}: {
  icon: ElementType;
  label: string;
  value: string;
  delta: { tone: DeltaTone; value: number };
  linkLabel: string;
  accent: "violet" | "green";
  chart: ReactNode;
}) => {
  const accentClass = accent === "violet" ? "bg-violet-500/15 text-violet-400" : "bg-emerald-500/15 text-emerald-400";

  return (
    <SurfaceCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-[12px]", accentClass)}>
            <Icon size={16} />
          </span>
          <div>
            <p className="text-[12px] font-medium text-[#9CA3AF]">{label}</p>
            <p className="mt-2 text-[28px] font-bold tracking-[-0.04em] text-[#F5F5F5]">{value}</p>
          </div>
        </div>
        <IconButton />
      </div>

      <div className="mt-3">
        <DeltaInline delta={delta} />
      </div>

      <div className="mt-4 h-[124px]">{chart}</div>

      <button className="mt-3 text-[12px] font-semibold text-[#22C55E] transition hover:text-[#4ade80]">
        {linkLabel}
      </button>
    </SurfaceCard>
  );
};

const CardHeader = ({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
}) => (
  <div className="flex items-start justify-between gap-3">
    <div>
      <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[#F5F5F5]">{title}</h2>
      <p className="mt-1 text-[12px] text-[#9CA3AF]">{subtitle}</p>
    </div>
    {action}
  </div>
);

const DeltaInline = ({ delta }: { delta: { tone: DeltaTone; value: number } }) => (
  <div className="flex items-center gap-2 text-[12px]">
    <span
      className={cn(
        "font-semibold",
        delta.tone === "positive" && "text-[#22C55E]",
        delta.tone === "negative" && "text-[#EF4444]",
        delta.tone === "neutral" && "text-[#9CA3AF]"
      )}
    >
      {formatDelta(delta.value)}
    </span>
    <span className="text-[#9CA3AF]">vs período anterior</span>
  </div>
);

const ProductRow = ({ product, index }: { product: CatalogProductRow; index: number }) => (
  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[12px] border border-[#262626] bg-[#121212] px-4 py-3">
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-[12px] font-semibold text-[#F5F5F5]">
      {index + 1}
    </span>
    <div className="min-w-0">
      <p className="truncate text-[13px] font-medium text-[#F5F5F5]">{product.title}</p>
      <p className="mt-1 truncate text-[11px] text-[#9CA3AF]">
        {product.category ?? "Sem categoria"} · margem {Math.round(Number(product.margin_percent ?? 0))}%
      </p>
    </div>
    <div className="text-right">
      <p className="text-[12px] font-semibold text-[#22C55E]">{formatNumber(product.orders_count ?? 0)}</p>
      <p className="mt-1 text-[10px] text-[#6B7280]">
        {formatBRL(Number(product.suggested_price ?? 0))}
      </p>
    </div>
  </div>
);

const PlatformRow = ({ label, value, total }: { label: string; value: number; total: number }) => {
  const percent = total ? Math.max((value / total) * 100, 4) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12px]">
        <span className="font-medium text-[#D1D5DB]">{label}</span>
        <span className="text-[#9CA3AF]">{formatNumber(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

const SignalRow = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warning" | "neutral";
}) => (
  <div className="flex items-center justify-between rounded-[12px] border border-[#262626] bg-[#121212] px-4 py-3">
    <span className="text-[13px] text-[#D1D5DB]">{label}</span>
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        tone === "ok" && "bg-emerald-500/15 text-emerald-400",
        tone === "warning" && "bg-rose-500/15 text-rose-400",
        tone === "neutral" && "bg-white/[0.06] text-[#D1D5DB]"
      )}
    >
      {formatNumber(value)}
    </span>
  </div>
);

const QuickStat = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "positive" | "neutral";
}) => (
  <div className="rounded-[12px] border border-[#262626] bg-[#121212] px-4 py-3">
    <p className="text-[12px] text-[#9CA3AF]">{label}</p>
    <p className={cn("mt-2 text-[20px] font-bold tracking-[-0.03em]", tone === "positive" ? "text-[#F5F5F5]" : "text-[#D1D5DB]")}>
      {value}
    </p>
  </div>
);

const StatusPill = ({ value }: { value: string }) => {
  const normalized = value.toLowerCase();
  const isActive = ["active", "published", "approved", "ativo", "publicado"].includes(normalized);
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        isActive ? "bg-emerald-500/15 text-emerald-400" : "bg-white/[0.06] text-[#D1D5DB]"
      )}
    >
      {value}
    </span>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="flex min-h-[148px] items-center justify-center rounded-[12px] border border-dashed border-[#2A2A2A] bg-[#121212] px-4 text-center text-[13px] leading-6 text-[#6B7280]">
    {text}
  </div>
);

const IconButton = () => (
  <button className="flex h-9 w-9 items-center justify-center rounded-full border border-[#262626] bg-[#121212] text-[#9CA3AF] transition hover:border-[#343434] hover:text-white">
    <MoreHorizontal size={15} />
  </button>
);

const ChartTooltip = ({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string }>;
  label?: string;
  formatter?: (value: number) => string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[12px] border border-[#2A2A2A] bg-[#111111] px-3 py-2 text-[12px] text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
      <p className="mb-1 text-[#9CA3AF]">{label}</p>
      {payload.map((item) => (
        <p key={item.name ?? "valor"} className="font-semibold text-[#F5F5F5]">
          {formatter ? formatter(Number(item.value ?? 0)) : formatNumber(Number(item.value ?? 0))}
        </p>
      ))}
    </div>
  );
};

const formatDate = (value: string | null) => {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const VeloMark = () => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-black shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M33 18A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path d="M30 26L34 30L38 26" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </span>
);

export default AdminBlankPage;
