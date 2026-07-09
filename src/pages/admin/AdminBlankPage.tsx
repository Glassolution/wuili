import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bell,
  ChevronLeft,
  ChevronDown,
  Download,
  HelpCircle,
  LayoutDashboard,
  ListChecks,
  Users as UsersIcon,
  Workflow,
  BarChart3,
  Sparkles,
  Star,
  Briefcase,
  DollarSign,
  Plug,
  Settings,
  FileText,
  User,
  Plus,
  Search,
  MoreHorizontal,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useOnlinePresence } from "@/hooks/useOnlinePresence";
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
type PublicationRow = Pick<
  Database["public"]["Tables"]["user_publications"]["Row"],
  "created_at" | "status"
>;
type ProfileRow = Pick<Database["public"]["Tables"]["profiles"]["Row"], "created_at">;
type RefundRow = { refund_amount: number | string | null; processed_at: string | null; status: string | null };

type PanelData = {
  counts: { users: number; publications: number; orders: number; activeSubs: number };
  subscriptions: SubscriptionRow[];
  orders: OrderRow[];
  publications: PublicationRow[];
  profiles: ProfileRow[];
  refunds: RefundRow[];
};

const empty: PanelData = {
  counts: { users: 0, publications: 0, orders: 0, activeSubs: 0 },
  subscriptions: [],
  orders: [],
  publications: [],
  profiles: [],
  refunds: [],
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 }).format(v || 0);

const formatNumber = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: v >= 1000 ? 1 : 0 }).format(v || 0);

const formatCompact = (v: number) => {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(".", ",")}K`;
  return formatNumber(v);
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

const inRange = (v: string | null, s: Date, e: Date) => {
  if (!v) return false;
  const d = new Date(v);
  return d >= s && d <= e;
};

const deltaPct = (cur: number, prev: number) => {
  if (cur === 0 && prev === 0) return 0;
  if (prev === 0) return 100;
  return ((cur - prev) / Math.abs(prev)) * 100;
};

const formatDelta = (d: number) => `${d > 0 ? "+" : d < 0 ? "-" : ""}${Math.abs(d).toFixed(1).replace(".", ",")}%`;

const fetchPanel = async (): Promise<PanelData> => {
  const [users, pubs, ord, subs, subsData, ordData, pubData, profData, refundData] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("user_publications").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "paid", "approved"]),
    supabase.from("subscriptions").select("amount,created_at,updated_at,status").order("updated_at", { ascending: false }).limit(1000),
    supabase.from("orders").select("created_at,ordered_at,status,total_amount").order("created_at", { ascending: false }).limit(500),
    supabase.from("user_publications").select("created_at,status").order("created_at", { ascending: false }).limit(500),
    supabase.from("profiles").select("created_at").order("created_at", { ascending: false }).limit(500),
    (supabase as any).from("refund_requests").select("refund_amount,processed_at,status").in("status", ["approved", "processed", "completed", "refunded"]).limit(1000),
  ]);
  return {
    counts: {
      users: users.count ?? 0,
      publications: pubs.count ?? 0,
      orders: ord.count ?? 0,
      activeSubs: subs.count ?? 0,
    },
    subscriptions: subsData.data ?? [],
    orders: ordData.data ?? [],
    publications: pubData.data ?? [],
    profiles: profData.data ?? [],
    refunds: (refundData?.data as RefundRow[] | null) ?? [],
  };
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

type Period = "monthly" | "annually";

const AdminPainelPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("monthly");
  const { data = empty } = useQuery({ queryKey: ["admin-panel-v2"], queryFn: fetchPanel, refetchInterval: 30000 });
  const onlineNow = useOnlinePresence(user?.id ?? null);

  const daysWindow = period === "monthly" ? 30 : 365;

  // Metric calculations
  const pubsDelta = useMemo(() => {
    const cur = getWindow(daysWindow, 0);
    const prev = getWindow(daysWindow, daysWindow);
    const c = data.publications.filter((p) => inRange(p.created_at, cur.start, cur.end)).length;
    const p = data.publications.filter((x) => inRange(x.created_at, prev.start, prev.end)).length;
    return { current: c, delta: deltaPct(c, p) };
  }, [data.publications, daysWindow]);

  const usersDelta = useMemo(() => {
    const cur = getWindow(daysWindow, 0);
    const prev = getWindow(daysWindow, daysWindow);
    const c = data.profiles.filter((p) => inRange(p.created_at, cur.start, cur.end)).length;
    const p = data.profiles.filter((x) => inRange(x.created_at, prev.start, prev.end)).length;
    return { current: data.counts.users, delta: deltaPct(c, p) };
  }, [data.profiles, data.counts.users, daysWindow]);

  const ordersDelta = useMemo(() => {
    const cur = getWindow(daysWindow, 0);
    const prev = getWindow(daysWindow, daysWindow);
    const c = data.orders.filter((o) => inRange(o.ordered_at ?? o.created_at, cur.start, cur.end)).length;
    const p = data.orders.filter((o) => inRange(o.ordered_at ?? o.created_at, prev.start, prev.end)).length;
    return { current: c, delta: deltaPct(c, p) };
  }, [data.orders, daysWindow]);

  // Real applied revenue: paid subscriptions minus approved refunds within window.
  const revenueDelta = useMemo(() => {
    const cur = getWindow(daysWindow, 0);
    const prev = getWindow(daysWindow, daysWindow);
    const paidStatuses = new Set(["active", "paid", "approved"]);
    const sumSubs = (s: Date, e: Date) =>
      data.subscriptions.reduce((acc, sub) => {
        if (!paidStatuses.has(String(sub.status ?? "").toLowerCase())) return acc;
        const d = sub.updated_at ?? sub.created_at;
        return inRange(d, s, e) ? acc + Number(sub.amount ?? 0) : acc;
      }, 0);
    const sumRefunds = (s: Date, e: Date) =>
      data.refunds.reduce(
        (acc, r) => (inRange(r.processed_at, s, e) ? acc + Number(r.refund_amount ?? 0) : acc),
        0,
      );
    const c = sumSubs(cur.start, cur.end) - sumRefunds(cur.start, cur.end);
    const p = sumSubs(prev.start, prev.end) - sumRefunds(prev.start, prev.end);
    return { current: c, delta: deltaPct(c, p) };
  }, [data.subscriptions, data.refunds, daysWindow]);

  // Revenue chart — real applied revenue per month (paid subs minus approved refunds).
  const revenueSeries = useMemo(() => {
    const now = new Date();
    const paidStatuses = new Set(["active", "paid", "approved"]);
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: MONTHS[d.getMonth()],
        value: 0,
      };
    });
    const byKey = new Map(months.map((m) => [m.key, m]));
    data.subscriptions.forEach((s) => {
      if (!paidStatuses.has(String(s.status ?? "").toLowerCase())) return;
      const src = s.updated_at ?? s.created_at;
      if (!src) return;
      const d = new Date(src);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = byKey.get(key);
      if (m) m.value += Number(s.amount ?? 0);
    });
    data.refunds.forEach((r) => {
      if (!r.processed_at) return;
      const d = new Date(r.processed_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = byKey.get(key);
      if (m) m.value -= Number(r.refund_amount ?? 0);
    });
    return months;
  }, [data.subscriptions, data.refunds]);

  const revenueTotal = useMemo(
    () => revenueSeries.reduce((a, b) => a + b.value, 0),
    [revenueSeries]
  );

  // Daily revenue series (last ~180 days) with the current 30-day window highlighted.
  const revenueDaily = useMemo(() => {
    const now = new Date();
    const DAYS = 180;
    const HIGHLIGHT = 30;
    const paidStatuses = new Set(["active", "paid", "approved"]);
    const dayIndex = (iso: string | null) => {
      if (!iso) return -1;
      const d = new Date(iso);
      const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
      return diff >= 0 && diff < DAYS ? DAYS - 1 - diff : -1;
    };

    // Start with a light synthetic baseline so the line is visible even when
    // subscription data is sparse (matches the "market-chart" look).
    const base = Array.from({ length: DAYS }, (_, i) => {
      const t = i / DAYS;
      const wave =
        Math.sin(t * Math.PI * 4) * 6 +
        Math.sin(t * Math.PI * 11 + 0.7) * 3 +
        Math.cos(t * Math.PI * 2.3) * 4;
      return 60 + t * 25 + wave;
    });

    data.subscriptions.forEach((s) => {
      if (!paidStatuses.has(String(s.status ?? "").toLowerCase())) return;
      const idx = dayIndex(s.updated_at ?? s.created_at);
      if (idx >= 0) base[idx] += Number(s.amount ?? 0);
    });
    data.refunds.forEach((r) => {
      const idx = dayIndex(r.processed_at);
      if (idx >= 0) base[idx] -= Number(r.refund_amount ?? 0);
    });

    const start = new Date(now);
    start.setDate(start.getDate() - (DAYS - 1));
    return base.map((value, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const highlighted = i >= DAYS - HIGHLIGHT;
      return {
        idx: i,
        date: d.toISOString().slice(0, 10),
        monthLabel: MONTHS[d.getMonth()],
        value,
        highlightValue: highlighted ? value : null,
      };
    });
  }, [data.subscriptions, data.refunds]);

  const revenueMonthTicks = useMemo(() => {
    const seen = new Set<string>();
    const ticks: number[] = [];
    revenueDaily.forEach((p) => {
      if (!seen.has(p.monthLabel)) {
        seen.add(p.monthLabel);
        ticks.push(p.idx);
      }
    });
    return ticks;
  }, [revenueDaily]);

  const revenueRangeLabel = useMemo(() => {
    if (revenueDaily.length === 0) return "Últimos 6 meses";
    const first = new Date(revenueDaily[0].date);
    const last = new Date(revenueDaily[revenueDaily.length - 1].date);
    const fmt = (d: Date) =>
      `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return `${fmt(first)} – ${fmt(last)}`;
  }, [revenueDaily]);


  // Daily bars — new users last 12 days
  const newUsersBars = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (11 - i));
      const key = d.toISOString().slice(0, 10);
      return {
        label: `${d.getHours()}`,
        value: data.profiles.filter((p) => (p.created_at ?? "").slice(0, 10) === key).length,
      };
    });
  }, [data.profiles]);

  // Orders line — 14 days
  const ordersLine = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      return {
        label: key,
        value: data.orders.filter((o) => ((o.ordered_at ?? o.created_at) ?? "").slice(0, 10) === key).length,
      };
    });
  }, [data.orders]);

  const totalOrders = ordersLine.reduce((a, b) => a + b.value, 0);
  const newUsersTotal = newUsersBars.reduce((a, b) => a + b.value, 0);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white" style={{ fontFamily: '"Inter", ui-sans-serif, system-ui' }}>
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-white/5 bg-[#0F0F0F] px-3 py-4">
          <div className="mb-5 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#22C55E]">
                <ChevronLeft className="h-4 w-4 rotate-180 text-black" strokeWidth={2.5} />
              </div>
              <span className="text-[15px] font-semibold tracking-tight">VeloMetric</span>
            </div>
            <button className="rounded-md p-1 text-white/40 hover:bg-white/5 hover:text-white/80">
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <button className="mb-4 flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-2 text-[13px] font-medium text-white/80 transition hover:bg-white/[0.06]">
            <Sparkles className="h-3.5 w-3.5" />
            Sugestões da IA
          </button>

          <nav className="flex-1 space-y-1 text-[13px]">
            <SideItem icon={LayoutDashboard} label="Painel" active />
            <div className="ml-6 space-y-0.5 border-l border-white/5 pl-3 py-1">
              <SideSub label="Visão geral" active />
              <SideSub label="Relatórios & análises" to="/admin/painel" />
              <SideSub label="Atividade do time" />
              <SideSub label="Workflow" />
            </div>
            <SideItem icon={Star} label="Funcionalidades" />
            <SideItem icon={UsersIcon} label="Usuários & times" to="/admin/usuarios" />
            <SideItem icon={DollarSign} label="Comissões" to="/admin/comissoes" />
            <SideItem icon={Plug} label="Integrações" />
          </nav>

          <div className="space-y-1 border-t border-white/5 pt-3 text-[13px]">
            <SideItem icon={Settings} label="Configurações" />
            <SideItem icon={FileText} label="Templates" />
            <SideItem icon={User} label="Perfil" />
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[12px] text-white/50 hover:bg-white/5 hover:text-white/80"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar a Velo
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="min-w-0 flex-1 px-8 py-6">
          {/* Top bar */}
          <div className="mb-6 flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                placeholder="Buscar..."
                className="w-full rounded-full border border-white/10 bg-[#0F0F0F] py-2 pl-9 pr-4 text-[13px] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="flex rounded-full border border-white/10 bg-[#0F0F0F] p-0.5 text-[12px]">
                <button
                  onClick={() => setPeriod("monthly")}
                  className={cn(
                    "rounded-full px-4 py-1.5 transition",
                    period === "monthly" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80",
                  )}
                >
                  Mensal
                </button>
                <button
                  onClick={() => setPeriod("annually")}
                  className={cn(
                    "rounded-full px-4 py-1.5 transition",
                    period === "annually" ? "bg-white/10 text-white" : "text-white/50 hover:text-white/80",
                  )}
                >
                  Anual
                </button>
              </div>
              <button className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0F0F0F] px-4 py-2 text-[12px] text-white/80 hover:bg-white/[0.06]">
                <Download className="h-3.5 w-3.5" />
                Exportar dados
              </button>
              <button className="flex items-center gap-2 rounded-full bg-[#22C55E] px-4 py-2 text-[12px] font-medium text-black hover:bg-[#16A34A]">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                Criar relatório
              </button>
              <button className="rounded-full border border-white/10 bg-[#0F0F0F] p-2 text-white/60 hover:text-white">
                <HelpCircle className="h-4 w-4" />
              </button>
              <button className="rounded-full border border-white/10 bg-[#0F0F0F] p-2 text-white/60 hover:text-white">
                <Bell className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              dotClass="bg-gradient-to-br from-[#F472B6] to-[#EC4899]"
              label="Publicações"
              value={formatNumber(data.counts.publications)}
              delta={pubsDelta.delta}
            />
            <KpiCard
              dotClass="bg-gradient-to-br from-[#818CF8] to-[#4F46E5]"
              label="Usuários ativos"
              value={formatCompact(data.counts.users)}
              delta={usersDelta.delta}
            />
            <OnlineNowCard value={onlineNow} />
            <KpiCard
              dotClass="bg-gradient-to-br from-[#4ADE80] to-[#16A34A]"
              label="Faturamento real (líquido de reembolsos)"
              value={formatBRL(revenueDelta.current)}
              delta={revenueDelta.delta}
            />
          </div>


          {/* Chart row */}
          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
            {/* Revenue — market-chart style */}
            <div className="rounded-2xl border border-white/[0.06] bg-[#0B0B0B] p-6 xl:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[13px] font-medium text-white/70">Revenue</p>
                  <p className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.02em] text-white">
                    {formatBRL(revenueTotal)}
                  </p>
                  <p className="mt-2 text-[12.5px] text-white/50">
                    <span className={revenueDelta.delta >= 0 ? "text-[#4ADE80]" : "text-red-400"}>
                      {formatDelta(revenueDelta.delta)}
                    </span>{" "}
                    vs previous period
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-1.5 rounded-full border border-white/10 bg-transparent px-3 py-1.5 text-[11.5px] text-white/70 hover:bg-white/[0.04]">
                    {revenueRangeLabel}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button className="rounded-full border border-white/10 p-1.5 text-white/60 hover:bg-white/[0.04] hover:text-white">
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-6 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueDaily} margin={{ top: 10, right: 8, left: -4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revHighlight" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4ADE80" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#4ADE80" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" horizontal vertical={false} />
                    <XAxis
                      dataKey="idx"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      ticks={revenueMonthTicks}
                      tickFormatter={(i) => revenueDaily[i as number]?.monthLabel ?? ""}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }}
                      tickMargin={12}
                    />
                    <YAxis
                      orientation="left"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 11 }}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}K` : `${Math.round(v)}`)}
                      width={44}
                    />
                    <Tooltip
                      cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }}
                      contentStyle={{
                        background: "#111111",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#fff" }}
                      labelFormatter={(i: number) => revenueDaily[i]?.date ?? ""}
                      formatter={(v: number) => [formatBRL(v), "Receita"]}
                    />
                    {/* Full period thin line */}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="rgba(255,255,255,0.55)"
                      strokeWidth={1.25}
                      fill="transparent"
                      dot={false}
                      activeDot={{ r: 3, fill: "#fff", stroke: "#0B0B0B", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    {/* Highlighted current window */}
                    <Area
                      type="monotone"
                      dataKey="highlightValue"
                      stroke="#4ADE80"
                      strokeWidth={1.75}
                      fill="url(#revHighlight)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#4ADE80", stroke: "#0B0B0B", strokeWidth: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>


            {/* Right column */}
            <div className="flex flex-col gap-4">
              <MiniCard
                icon={<BarChart3 className="h-3.5 w-3.5 text-[#22C55E]" />}
                title="Novos usuários"
                value={formatNumber(newUsersTotal)}
                delta={usersDelta.delta}
              >
                <div className="h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={newUsersBars} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <Bar dataKey="value" fill="#22C55E" radius={[3, 3, 3, 3]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </MiniCard>

              <MiniCard
                icon={<Workflow className="h-3.5 w-3.5 text-[#22C55E]" />}
                title="Total de pedidos"
                value={formatNumber(totalOrders)}
                delta={ordersDelta.delta}
              >
                <div className="h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ordersLine} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#22C55E"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </MiniCard>
            </div>
          </div>

          {/* Reports overview */}
          <div className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold">Visão geral dos relatórios</h3>
              <div className="flex items-center gap-2">
                <PeriodPill />
                <button className="flex items-center gap-2 rounded-full border border-white/10 bg-[#0F0F0F] px-3 py-1.5 text-[12px] text-white/80 hover:bg-white/[0.06]">
                  <Download className="h-3.5 w-3.5" />
                  Exportar
                </button>
                <button className="rounded-full border border-white/10 bg-[#0F0F0F] p-1.5 text-white/60 hover:text-white">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <ReportCard
                title="Faturamento real"
                value={formatBRL(revenueTotal)}
                delta={revenueDelta.delta}
                subtitle="líquido de reembolsos nos últimos 6 meses"
              />
              <ReportCard
                title="Tarefas automatizadas concluídas"
                value={formatNumber(data.orders.filter((o) => o.status === "delivered" || o.status === "shipped").length)}
                delta={ordersDelta.delta}
                subtitle="Pedidos entregues + enviados"
              />
            </div>
          </div>

          <p className="mt-8 text-[11px] text-white/30">Admin ID · {(user?.id ?? "VELOADMIN").slice(0, 8).toUpperCase()}</p>
        </main>
      </div>
    </div>
  );
};

/* ---------- Subcomponents ---------- */

const SideItem = ({
  icon: Icon,
  label,
  active,
  to,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  to?: string;
}) => {
  const inner = (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 transition",
        active
          ? "bg-white/[0.06] text-white"
          : "text-white/60 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : <button className="w-full text-left">{inner}</button>;
};

const SideSub = ({ label, active, to }: { label: string; active?: boolean; to?: string }) => {
  const inner = (
    <div
      className={cn(
        "rounded-md px-2 py-1.5 text-[12.5px] transition",
        active ? "text-white" : "text-white/45 hover:text-white/80",
      )}
    >
      {label}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : <button className="w-full text-left">{inner}</button>;
};

const KpiCard = ({
  dotClass,
  label,
  value,
  delta,
}: {
  dotClass: string;
  label: string;
  value: string;
  delta: number;
}) => (
  <div className="rounded-2xl border border-white/5 bg-[#0F0F0F] p-5">
    <div className="flex items-center gap-2">
      <span className={cn("h-4 w-4 rounded-full", dotClass)} />
      <span className="text-[12.5px] text-white/60">{label}</span>
    </div>
    <p className="mt-4 text-[28px] font-semibold tracking-tight text-white">{value}</p>
    <p className="mt-2 text-[11.5px] text-white/50">
      <span className={delta >= 0 ? "text-[#22C55E]" : "text-red-400"}>{formatDelta(delta)}</span>{" "}
      vs período anterior
    </p>
  </div>
);

const OnlineNowCard = ({ value }: { value: number }) => (
  <div className="rounded-2xl border border-white/5 bg-[#0F0F0F] p-5">
    <div className="flex items-center gap-2">
      <span className="relative flex h-4 w-4 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22D3EE] opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-br from-[#22D3EE] to-[#0891B2]" />
      </span>
      <span className="text-[12.5px] text-white/60">Usuários online agora</span>
    </div>
    <p className="mt-4 text-[28px] font-semibold tracking-tight text-white">{formatNumber(value)}</p>
    <p className="mt-2 text-[11.5px] text-white/50">
      <span className="text-[#22D3EE]">● ao vivo</span> conectados simultaneamente
    </p>
  </div>
);

const MiniCard = ({
  icon,
  title,
  value,
  delta,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  delta: number;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-white/5 bg-[#0F0F0F] p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="flex items-center gap-1.5 text-[12px] text-white/60">
          {icon}
          <span>{title}</span>
        </div>
        <p className="mt-2 text-[20px] font-semibold tracking-tight">{value}</p>
        <p className="mt-0.5 text-[11px] text-white/45">
          <span className={delta >= 0 ? "text-[#22C55E]" : "text-red-400"}>{formatDelta(delta)}</span>{" "}
          vs período anterior
        </p>
      </div>
      <button className="rounded-full p-1 text-white/40 hover:bg-white/5 hover:text-white">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
    </div>
    <div className="mt-3">{children}</div>
  </div>
);

const PeriodPill = () => (
  <button className="flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0F0F0F] px-3 py-1.5 text-[11.5px] text-white/70 hover:bg-white/[0.06]">
    Últimos 6 meses
    <ChevronDown className="h-3 w-3" />
  </button>
);

const ReportCard = ({
  title,
  value,
  delta,
  subtitle,
}: {
  title: string;
  value: string;
  delta: number;
  subtitle: string;
}) => (
  <div className="rounded-2xl border border-white/5 bg-[#0F0F0F] p-5">
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-white/70">{title}</span>
      <PeriodPill />
    </div>
    <p className="mt-3 text-[26px] font-semibold tracking-tight">{value}</p>
    <p className="mt-1 text-[12px] text-white/50">
      <span className={delta >= 0 ? "text-[#22C55E]" : "text-red-400"}>{formatDelta(delta)}</span>{" "}
      {subtitle}
    </p>
  </div>
);

export default AdminPainelPage;
