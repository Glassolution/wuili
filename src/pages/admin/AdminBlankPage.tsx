import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  ChevronDown,
  CircleDollarSign,
  Download,
  HelpCircle,
  ListChecks,
  MoreHorizontal,
  Plus,
  Search,
  Users,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/contexts/AuthContext";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type SubscriptionRow = Pick<
  Database["public"]["Tables"]["subscriptions"]["Row"],
  "amount" | "created_at" | "updated_at" | "status"
>;
type OrderRow = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "created_at" | "ordered_at" | "status" | "total_amount"
>;
type PublicationRow = Pick<Database["public"]["Tables"]["user_publications"]["Row"], "created_at" | "status">;
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
type RefundRow = { refund_amount: number | string | null; processed_at: string | null; status: string | null };

type PanelData = {
  counts: { users: number; publications: number; orders: number };
  subscriptions: SubscriptionRow[];
  orders: OrderRow[];
  publications: PublicationRow[];
  profiles: ProfileRow[];
  refunds: RefundRow[];
};

type Period = "monthly" | "annually";

const EMPTY_DATA: PanelData = {
  counts: { users: 0, publications: 0, orders: 0 },
  subscriptions: [],
  orders: [],
  publications: [],
  profiles: [],
  refunds: [],
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const PAID_STATUSES = new Set(["active", "paid", "approved"]);

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(value || 0);

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: value >= 1000 ? 1 : 0 }).format(value || 0);

const formatCompact = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1).replace(".", ",")}K`;
  return formatNumber(value);
};

const getWindow = (days: number, offset = 0) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() - offset);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

const inRange = (value: string | null, start: Date, end: Date) => {
  if (!value) return false;
  const date = new Date(value);
  return date >= start && date <= end;
};

const deltaPct = (current: number, previous: number) => {
  if (current === 0 && previous === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const formatDelta = (delta: number) =>
  `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${Math.abs(delta).toFixed(1).replace(".", ",")}%`;

const fetchPanel = async (): Promise<PanelData> => {
  const [users, publications, orders, subscriptionsData, ordersData, publicationsData, profilesData, refundsData] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("user_publications").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("id", { count: "exact", head: true }),
      supabase.from("subscriptions").select("amount,created_at,updated_at,status").order("updated_at", { ascending: false }).limit(1000),
      supabase.from("orders").select("created_at,ordered_at,status,total_amount").order("created_at", { ascending: false }).limit(1000),
      supabase.from("user_publications").select("created_at,status").order("created_at", { ascending: false }).limit(1000),
      supabase.from("profiles").select("created_at").order("created_at", { ascending: false }).limit(1000),
      supabase
        .from("refund_requests")
        .select("refund_amount,processed_at,status")
        .in("status", ["approved", "processed", "completed", "refunded"])
        .limit(1000),
    ]);

  return {
    counts: {
      users: users.count ?? 0,
      publications: publications.count ?? 0,
      orders: orders.count ?? 0,
    },
    subscriptions: subscriptionsData.data ?? [],
    orders: ordersData.data ?? [],
    publications: publicationsData.data ?? [],
    profiles: profilesData.data ?? [],
    refunds: (refundsData.data as RefundRow[] | null) ?? [],
  };
};

const AdminPainelPage = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>("monthly");
  const { data = EMPTY_DATA } = useQuery({
    queryKey: ["admin-panel-v3"],
    queryFn: fetchPanel,
    refetchInterval: 30_000,
  });
  const onlineNow = useOnlinePresence(user?.id ?? null);
  const daysWindow = period === "monthly" ? 30 : 365;

  const publicationsMetric = useMemo(() => {
    const current = getWindow(daysWindow);
    const previous = getWindow(daysWindow, daysWindow);
    const currentCount = data.publications.filter((item) => inRange(item.created_at, current.start, current.end)).length;
    const previousCount = data.publications.filter((item) => inRange(item.created_at, previous.start, previous.end)).length;
    return { value: data.counts.publications, delta: deltaPct(currentCount, previousCount) };
  }, [data.counts.publications, data.publications, daysWindow]);

  const usersMetric = useMemo(() => {
    const current = getWindow(daysWindow);
    const previous = getWindow(daysWindow, daysWindow);
    const currentCount = data.profiles.filter((item) => inRange(item.created_at, current.start, current.end)).length;
    const previousCount = data.profiles.filter((item) => inRange(item.created_at, previous.start, previous.end)).length;
    return { value: data.counts.users, delta: deltaPct(currentCount, previousCount) };
  }, [data.counts.users, data.profiles, daysWindow]);

  const ordersMetric = useMemo(() => {
    const current = getWindow(daysWindow);
    const previous = getWindow(daysWindow, daysWindow);
    const currentCount = data.orders.filter((item) => inRange(item.ordered_at ?? item.created_at, current.start, current.end)).length;
    const previousCount = data.orders.filter((item) => inRange(item.ordered_at ?? item.created_at, previous.start, previous.end)).length;
    return { value: currentCount, delta: deltaPct(currentCount, previousCount) };
  }, [data.orders, daysWindow]);

  const revenueMetric = useMemo(() => {
    const current = getWindow(daysWindow);
    const previous = getWindow(daysWindow, daysWindow);
    const sumSubscriptions = (start: Date, end: Date) =>
      data.subscriptions.reduce((sum, subscription) => {
        if (!PAID_STATUSES.has(String(subscription.status ?? "").toLowerCase())) return sum;
        return inRange(subscription.updated_at ?? subscription.created_at, start, end)
          ? sum + Number(subscription.amount ?? 0)
          : sum;
      }, 0);
    const sumRefunds = (start: Date, end: Date) =>
      data.refunds.reduce(
        (sum, refund) => (inRange(refund.processed_at, start, end) ? sum + Number(refund.refund_amount ?? 0) : sum),
        0,
      );
    const currentValue = sumSubscriptions(current.start, current.end) - sumRefunds(current.start, current.end);
    const previousValue = sumSubscriptions(previous.start, previous.end) - sumRefunds(previous.start, previous.end);
    return { value: currentValue, delta: deltaPct(currentValue, previousValue) };
  }, [data.refunds, data.subscriptions, daysWindow]);

  const revenueDaily = useMemo(() => {
    const now = new Date();
    const totalDays = 180;
    const highlightedDays = 30;
    const start = new Date(now);
    start.setDate(now.getDate() - (totalDays - 1));
    start.setHours(0, 0, 0, 0);

    const points = Array.from({ length: totalDays }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return {
        index,
        date: date.toISOString().slice(0, 10),
        label: MONTHS[date.getMonth()],
        value: 0,
        currentValue: null as number | null,
      };
    });
    const byDate = new Map(points.map((point) => [point.date, point]));

    data.subscriptions.forEach((subscription) => {
      if (!PAID_STATUSES.has(String(subscription.status ?? "").toLowerCase())) return;
      const date = (subscription.updated_at ?? subscription.created_at ?? "").slice(0, 10);
      const point = byDate.get(date);
      if (point) point.value += Number(subscription.amount ?? 0);
    });
    data.refunds.forEach((refund) => {
      const point = byDate.get((refund.processed_at ?? "").slice(0, 10));
      if (point) point.value -= Number(refund.refund_amount ?? 0);
    });
    points.forEach((point, index) => {
      if (index >= totalDays - highlightedDays) point.currentValue = point.value;
    });
    return points;
  }, [data.refunds, data.subscriptions]);

  const monthTicks = useMemo(() => {
    const seen = new Set<string>();
    return revenueDaily.reduce<number[]>((ticks, point) => {
      if (!seen.has(point.label)) {
        seen.add(point.label);
        ticks.push(point.index);
      }
      return ticks;
    }, []);
  }, [revenueDaily]);

  const revenueTotal = useMemo(() => revenueDaily.reduce((sum, point) => sum + point.value, 0), [revenueDaily]);
  const revenueAxisMax = useMemo(() => {
    const maxValue = Math.max(...revenueDaily.map((point) => Math.abs(point.value)), 0);
    if (maxValue === 0) return 100;
    return Math.ceil(maxValue / 4) * 4;
  }, [revenueDaily]);
  const revenueTicks = useMemo(
    () => Array.from({ length: 5 }, (_, index) => Math.round((revenueAxisMax / 4) * index)),
    [revenueAxisMax],
  );

  const newUsersSeries = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (11 - index));
      const key = date.toISOString().slice(0, 10);
      const value = data.profiles.filter((profile) => (profile.created_at ?? "").slice(0, 10) === key).length;
      return { index, label: key, value, mirror: -value };
    });
  }, [data.profiles]);

  const ordersSeries = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, index) => {
      const date = new Date(now);
      date.setDate(now.getDate() - (13 - index));
      const key = date.toISOString().slice(0, 10);
      const value = data.orders.filter((order) => ((order.ordered_at ?? order.created_at) ?? "").slice(0, 10) === key).length;
      return { index, label: key, value };
    });
  }, [data.orders]);

  const rangeLabel = useMemo(() => {
    if (revenueDaily.length === 0) return "Últimos 6 meses";
    const first = new Date(revenueDaily[0].date);
    const last = new Date(revenueDaily[revenueDaily.length - 1].date);
    return `${first.getDate()} ${MONTHS[first.getMonth()]} – ${last.getDate()} ${MONTHS[last.getMonth()]}`;
  }, [revenueDaily]);

  return (
    <AdminShell active="dashboard" userId={user?.id ?? "admin"} fullBleed>
      <div className="min-h-full bg-[#101011] text-[#F4F4F5]">
        <AdminTopbar period={period} onPeriodChange={setPeriod} />

        <section className="relative grid overflow-hidden border-y border-black/60 bg-[#151516] shadow-[inset_0_1px_0_rgba(255,255,255,0.045),inset_0_-1px_0_rgba(255,255,255,0.018),0_-1px_0_rgba(255,255,255,0.025),0_1px_0_rgba(0,0,0,0.92)] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/[0.035] after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-black/80 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCell
            icon={ListChecks}
            iconClass="bg-pink-500 text-white"
            label="Publicações"
            value={formatNumber(publicationsMetric.value)}
            delta={publicationsMetric.delta}
          />
          <MetricCell
            icon={Users}
            iconClass="bg-violet-500 text-white"
            label="Usuários ativos"
            value={formatCompact(usersMetric.value)}
            delta={usersMetric.delta}
          />
          <MetricCell
            icon={Workflow}
            iconClass="bg-blue-500 text-white"
            label="Pedidos processados"
            value={formatNumber(data.counts.orders)}
            delta={ordersMetric.delta}
          />
          <MetricCell
            icon={CircleDollarSign}
            iconClass="bg-[#22C55E] text-white"
            label="Faturamento líquido"
            value={formatBRL(revenueMetric.value)}
            delta={revenueMetric.delta}
          />
        </section>

        <div className="p-4 sm:p-5">
          <section className="grid overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E0E10] xl:grid-cols-[minmax(0,2.1fr)_minmax(320px,1fr)]">
            <div className="min-w-0 border-b border-white/[0.08] p-5 sm:p-6 xl:border-b-0 xl:border-r">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[13px] font-medium text-[#D4D4D8]">Receita</p>
                  <p className="mt-5 text-[28px] font-semibold text-white">{formatBRL(revenueTotal)}</p>
                  <DeltaLine delta={revenueMetric.delta} />
                </div>
                <div className="flex items-center gap-2">
                  <ControlButton label={rangeLabel} chevron />
                  <IconButton label="Mais opções" icon={MoreHorizontal} />
                </div>
              </div>

              <div className="mt-7 h-[432px] min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueDaily} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="adminRevenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity={0.22} />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.035)" />
                    <XAxis
                      dataKey="index"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      ticks={monthTicks}
                      tickFormatter={(index) => revenueDaily[index as number]?.label ?? ""}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#71717A", fontSize: 11 }}
                      tickMargin={14}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      width={46}
                      domain={[0, revenueAxisMax]}
                      ticks={revenueTicks}
                      tick={{ fill: "#71717A", fontSize: 11 }}
                      tickFormatter={(value) => (Math.abs(value) >= 1000 ? `${Math.round(value / 1000)}K` : `${Math.round(value)}`)}
                    />
                    <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "rgba(255,255,255,0.10)", strokeDasharray: "3 3" }} />
                    <Area type="monotone" dataKey="value" stroke="#7D7D84" strokeWidth={1.35} fill="transparent" dot={false} activeDot={{ r: 3, fill: "#D4D4D8", stroke: "#171717", strokeWidth: 2 }} isAnimationActive={false} />
                    <Area type="monotone" dataKey="currentValue" stroke="#22C55E" strokeWidth={1.8} fill="url(#adminRevenueFill)" dot={{ r: 2.5, fill: "#22C55E", stroke: "#0E0E10", strokeWidth: 1.5 }} connectNulls={false} activeDot={{ r: 4, fill: "#22C55E", stroke: "#171717", strokeWidth: 2 }} isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid min-w-0 grid-rows-2 divide-y divide-white/[0.08]">
              <SideAnalytics
                icon={BarChart3}
                title="Novos usuários"
                value={formatNumber(newUsersSeries.reduce((sum, item) => sum + item.value, 0))}
                delta={usersMetric.delta}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={newUsersSeries} margin={{ top: 12, right: 4, left: 4, bottom: 8 }}>
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.16)" strokeDasharray="3 3" />
                    <Bar dataKey="value" fill="#22C55E" stackId="users" radius={[3, 3, 0, 0]} barSize={10} />
                    <Bar dataKey="mirror" fill="rgba(134,239,172,0.72)" stackId="users" radius={[0, 0, 3, 3]} barSize={10} />
                    <XAxis dataKey="index" type="number" domain={[0, 11]} axisLine={false} tickLine={false} tickMargin={8} ticks={[1, 5, 10]} interval={0} tick={{ fill: "#6E6E76", fontSize: 10 }} tickFormatter={(value) => ({ 1: "12d", 5: "6d", 10: "hoje" })[Number(value)] ?? ""} />
                  </BarChart>
                </ResponsiveContainer>
              </SideAnalytics>

              <SideAnalytics
                icon={Workflow}
                title="Total de pedidos"
                value={formatNumber(data.counts.orders)}
                delta={ordersMetric.delta}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ordersSeries} margin={{ top: 10, right: 4, left: 4, bottom: 8 }}>
                    <defs>
                      <linearGradient id="adminOrdersFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={1.8} fill="url(#adminOrdersFill)" dot={false} isAnimationActive={false} />
                    <XAxis dataKey="index" type="number" domain={[0, 13]} axisLine={false} tickLine={false} tickMargin={8} ticks={[1, 6, 12]} interval={0} tick={{ fill: "#6E6E76", fontSize: 10 }} tickFormatter={(value) => ({ 1: "14d", 6: "7d", 12: "hoje" })[Number(value)] ?? ""} />
                  </AreaChart>
                </ResponsiveContainer>
              </SideAnalytics>
            </div>
          </section>

          <section className="mt-5">
            <div className="flex flex-col gap-3 border-y border-white/[0.08] py-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-[14px] font-semibold text-white">Visão geral dos relatórios</h2>
              <div className="flex items-center gap-2">
                <ControlButton label={rangeLabel} chevron />
                <ControlButton label="Exportar dados" icon={Download} />
                <IconButton label="Mais opções" icon={MoreHorizontal} />
              </div>
            </div>

            <div className="grid overflow-hidden rounded-b-2xl border-x border-b border-white/[0.08] bg-[#0E0E10] lg:grid-cols-2 lg:divide-x lg:divide-white/[0.08]">
              <ReportSummary
                title="Faturamento real"
                value={formatBRL(revenueTotal)}
                delta={revenueMetric.delta}
                description="Receita paga, já descontando reembolsos processados."
              />
              <ReportSummary
                title="Pedidos concluídos"
                value={formatNumber(data.orders.filter((order) => ["delivered", "shipped"].includes(String(order.status))).length)}
                delta={ordersMetric.delta}
                description="Pedidos enviados ou entregues dentro do período analisado."
              />
            </div>
          </section>

          <p className="mt-5 text-[10px] font-medium uppercase text-white/25">
            Admin ID · {(user?.id ?? "VELOADMIN").slice(0, 8)} · {onlineNow} online agora
          </p>
        </div>
      </div>
    </AdminShell>
  );
};

const AdminTopbar = ({ period, onPeriodChange }: { period: Period; onPeriodChange: (period: Period) => void }) => (
  <header className="flex min-h-[72px] flex-col gap-3 border-b border-black/70 bg-[#111112] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.025),inset_0_-1px_0_rgba(255,255,255,0.022),0_1px_0_rgba(0,0,0,0.86)] lg:flex-row lg:items-center lg:px-5 lg:py-0">
    <label className="relative block w-full max-w-[260px]">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#66666D]" strokeWidth={1.5} />
      <input
        type="search"
        placeholder="Buscar..."
        className="h-9 w-full rounded-full border border-white/[0.09] bg-[#1A1A1C] pl-9 pr-3 text-[12px] text-white outline-none placeholder:text-[#66666D] focus:border-white/[0.18]"
      />
    </label>

    <div className="flex min-w-0 flex-wrap items-center gap-2 lg:ml-auto lg:flex-nowrap">
      <div className="flex h-9 shrink-0 overflow-hidden rounded-full border border-white/[0.08] bg-[#171719] p-0.5 text-[12px]">
        <button type="button" onClick={() => onPeriodChange("monthly")} className={cn("rounded-full px-3.5 transition", period === "monthly" ? "bg-[#E5E5E7] text-[#121214]" : "text-[#77777E] hover:text-white")}>
          Mensal
        </button>
        <button type="button" onClick={() => onPeriodChange("annually")} className={cn("rounded-full px-3.5 transition", period === "annually" ? "bg-[#E5E5E7] text-[#121214]" : "text-[#77777E] hover:text-white")}>
          Anual
        </button>
      </div>
      <ControlButton label="Exportar dados" icon={Download} />
      <button type="button" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-[#22C55E] px-4 text-[12px] font-semibold text-[#07150C] transition hover:bg-[#2DD46A]">
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Criar relatório
      </button>
      <IconButton label="Ajuda" icon={HelpCircle} />
      <IconButton label="Notificações" icon={Bell} />
    </div>
  </header>
);

const MetricCell = ({
  icon: Icon,
  iconClass,
  label,
  value,
  delta,
}: {
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  delta: number;
}) => (
  <div className="relative min-w-0 bg-[#151516] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.028),inset_0_-1px_0_rgba(0,0,0,0.46)] before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(180deg,rgba(255,255,255,0.018),transparent_34%,rgba(0,0,0,0.16))] after:pointer-events-none after:absolute after:bottom-0 after:right-0 after:top-0 after:hidden after:w-[3px] after:bg-[linear-gradient(90deg,rgba(0,0,0,0.72),rgba(255,255,255,0.045),transparent)] after:shadow-[-1px_0_0_rgba(0,0,0,0.72),1px_0_0_rgba(255,255,255,0.016)] sm:[&:nth-child(odd)]:after:block xl:after:block xl:last:after:hidden">
    <div className="flex items-center gap-2.5">
      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]", iconClass)}>
        <Icon className="h-3 w-3" strokeWidth={1.7} />
      </span>
      <span className="truncate text-[12px] font-medium text-[#8B8B91]">{label}</span>
    </div>
    <p className="mt-6 truncate text-[25px] font-semibold text-white">{value}</p>
    <DeltaLine delta={delta} compact />
  </div>
);

const DeltaLine = ({ delta, compact = false }: { delta: number; compact?: boolean }) => (
  <p className={cn("mt-2 text-[#77777E]", compact ? "text-[11px]" : "text-[12px]")}>
    <span className={delta >= 0 ? "text-[#22C55E]" : "text-[#F05266]"}>{formatDelta(delta)}</span>{" "}
    vs período anterior
  </p>
);

const SideAnalytics = ({
  icon: Icon,
  title,
  value,
  delta,
  children,
}: {
  icon: LucideIcon;
  title: string;
  value: string;
  delta: number;
  children: React.ReactNode;
}) => (
  <div className="flex min-h-[300px] flex-col p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-[12px] font-medium text-[#8B8B91]">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#22C55E] text-white">
            <Icon className="h-3 w-3" strokeWidth={1.6} />
          </span>
          {title}
        </p>
        <p className="mt-5 text-[25px] font-semibold text-white">{value}</p>
        <DeltaLine delta={delta} compact />
      </div>
      <IconButton label="Mais opções" icon={MoreHorizontal} />
    </div>
    <div className="mt-4 min-h-[100px] flex-1">{children}</div>
    <Link to="/admin/painel" className="mt-3 text-[12px] font-medium text-[#22C55E] hover:text-[#4ADE80]">
      Ver relatório
    </Link>
  </div>
);

const ControlButton = ({
  label,
  icon: Icon,
  chevron = false,
}: {
  label: string;
  icon?: LucideIcon;
  chevron?: boolean;
}) => (
  <button type="button" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-white/[0.11] bg-transparent px-3 text-[11px] font-medium text-[#A1A1A7] transition hover:border-white/[0.20] hover:text-white">
    {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />}
    {label}
    {chevron && <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />}
  </button>
);

const IconButton = ({ label, icon: Icon }: { label: string; icon: LucideIcon }) => (
  <button type="button" title={label} aria-label={label} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.11] bg-transparent text-[#77777E] transition hover:border-white/[0.20] hover:text-white">
    <Icon className="h-4 w-4" strokeWidth={1.5} />
  </button>
);

const ReportSummary = ({ title, value, delta, description }: { title: string; value: string; delta: number; description: string }) => (
  <div className="p-5 sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[12px] font-medium text-[#A1A1A7]">{title}</p>
        <p className="mt-5 text-[26px] font-semibold text-white">{value}</p>
        <DeltaLine delta={delta} compact />
        <p className="mt-5 max-w-md text-[11px] leading-5 text-[#66666D]">{description}</p>
      </div>
      <IconButton label="Mais opções" icon={MoreHorizontal} />
    </div>
  </div>
);

const RevenueTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value?: number }>; label?: number }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/[0.10] bg-[#101010] px-3 py-2 shadow-xl">
      <p className="text-[10px] text-[#77777E]">{typeof label === "number" ? `Dia ${label + 1}` : "Receita"}</p>
      <p className="mt-1 text-[12px] font-semibold text-white">{formatBRL(Number(payload[0]?.value ?? 0))}</p>
    </div>
  );
};

export default AdminPainelPage;
