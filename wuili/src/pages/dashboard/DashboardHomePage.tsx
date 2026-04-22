import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Package, ShoppingCart, DollarSign,
  ChevronRight, ArrowUpRight, ArrowDownRight, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "next-themes";

// ── Types ─────────────────────────────────────────────────────────────────────

type Publication = {
  id: string;
  title: string;
  thumbnail: string | null;
  price: number | null;
  status: string;
};

// ── Mock / chart data ─────────────────────────────────────────────────────────

const REVENUE_MINI = [
  { m: "Jul", v: 4200 },
  { m: "Ago", v: 5100 },
  { m: "Set", v: 3900 },
  { m: "Out", v: 6300 },
  { m: "Nov", v: 9238 },
];

const SALES_DAILY = [
  { d: "Seg", v: 3200, p: 2800 }, { d: "Ter", v: 4100, p: 3500 },
  { d: "Qua", v: 3600, p: 4000 }, { d: "Qui", v: 5200, p: 3800 },
  { d: "Sex", v: 4800, p: 5100 }, { d: "Sáb", v: 6900, p: 5800 },
  { d: "Dom", v: 7400, p: 6200 },
];
const SALES_WEEKLY = [
  { d: "S1", v: 18000, p: 15000 }, { d: "S2", v: 22000, p: 19000 },
  { d: "S3", v: 19500, p: 21000 }, { d: "S4", v: 28000, p: 24000 },
];
const SALES_MONTHLY = [
  { d: "Jan", v: 62000, p: 55000 }, { d: "Fev", v: 58000, p: 61000 },
  { d: "Mar", v: 75000, p: 68000 }, { d: "Abr", v: 81000, p: 72000 },
];

const RECENT_ORDERS = [
  { id: "ORD-1024", customer: "Ana Paula Ferreira", product: "Suporte Celular Magnético", amount: 89.90,  time: "10:42", status: "delivered" },
  { id: "ORD-1023", customer: "Carlos Lima",         product: "Fone Bluetooth TWS Pro",   amount: 149.90, time: "09:58", status: "pending"   },
  { id: "ORD-1022", customer: "Mariana Costa",       product: "Massageador Portátil",      amount: 129.00, time: "09:30", status: "delivered" },
  { id: "ORD-1021", customer: "Roberto Mendes",      product: "Câmera WiFi 1080p",         amount: 189.90, time: "08:55", status: "shipped"   },
  { id: "ORD-1020", customer: "Juliana Souza",       product: "Relógio Smartwatch GPS",    amount: 249.90, time: "08:20", status: "delivered" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", paid: "Pago", shipped: "Enviado",
  delivered: "Entregue", cancelled: "Cancelado",
};
const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  paid:      "bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
  shipped:   "bg-[#F0F0F0] text-[#525252] border border-[#E5E5E5] dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
  delivered: "bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  cancelled: "bg-red-50 text-red-500 border border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30",
};

const CustomerAvatar = ({ name }: { name: string }) => {
  const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const bgs = ["bg-[#1e293b]", "bg-[#292524]", "bg-[#3f3f46]", "bg-[#374151]", "bg-[#1c1917]"];
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${bgs[name.charCodeAt(0) % 5]} text-[10px] font-bold text-white`}>
      {initials}
    </span>
  );
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 shadow-lg text-[12px]">
      <p className="mb-1.5 font-medium text-[#737373]">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.stroke }} />
          <p className="font-semibold text-[#0A0A0A]">
            {p.dataKey === "v" ? "Este período" : "Anterior"}: {fmt(p.value)}
          </p>
        </div>
      ))}
    </div>
  );
};

// reference line index for the chart (e.g. Friday = index 4 on daily)
const DAILY_REFLINE   = "Sex";
const WEEKLY_REFLINE  = "S3";
const MONTHLY_REFLINE = "Mar";

// ── Page ──────────────────────────────────────────────────────────────────────

type Period   = "Diário" | "Semanal" | "Mensal";
type OTab     = "Hoje"   | "Esta semana";

export default function DashboardHomePage() {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [period,    setPeriod]    = useState<Period>("Semanal");
  const [ordersTab, setOrdersTab] = useState<OTab>("Hoje");
  const isDark = resolvedTheme === "dark";

  // ── Fetch published products ──────────────────────────────────────────────
  const { data: publications, isLoading: loadingPubs } = useQuery({
    queryKey: ["dashboard-publications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_publications" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select("id, title, thumbnail, price, status")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as Publication[];
    },
  });

  // ── Fetch real stats ──────────────────────────────────────────────────────
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [ordersRes, pubsRes, revenueRes] = await Promise.all([
        // Total orders count
        supabase
          .from("orders" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),
        // Total active publications count
        supabase
          .from("user_publications" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .eq("status", "active"),
        // Total revenue (sum sale_price)
        supabase
          .from("orders" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
          .select("sale_price")
          .eq("user_id", user!.id),
      ]);
      const totalOrders = ordersRes.count ?? 0;
      const totalPubs   = pubsRes.count ?? 0;
      const revenue     = ((revenueRes.data ?? []) as { sale_price: number }[])
        .reduce((s, o) => s + (o.sale_price ?? 0), 0);
      return { totalOrders, totalPubs, revenue };
    },
  });

  const totalOrders = statsData?.totalOrders ?? 0;
  const totalPubs   = statsData?.totalPubs   ?? 0;
  const revenue     = statsData?.revenue     ?? 0;

  const chartData =
    period === "Diário" ? SALES_DAILY :
    period === "Mensal" ? SALES_MONTHLY : SALES_WEEKLY;
  const chartGrid = isDark ? "#313131" : "#F5F5F5";
  const chartTick = isDark ? "#A1A1AA" : "#C0C0C0";
  const miniBarActive = isDark ? "#FFFFFF" : "#0A0A0A";
  const miniBarInactive = isDark ? "#52525B" : "#E5E5E5";

  const hasPublications = !!publications && publications.length > 0;

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-[22px] font-black tracking-tight text-[#0A0A0A] dark:text-white">Dashboard</h1>
        <p className="mt-0.5 text-[13px] text-[#A3A3A3] dark:text-zinc-400">Visão geral da sua operação.</p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Receita — mini bar chart */}
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <p className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white">Receita</p>
            <Link to="/dashboard/relatorios" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F5F5F5] text-[#737373] transition hover:bg-[#EBEBEB] dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700">
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="mt-3 flex items-end gap-5">
            {/* Value + label */}
            <div className="shrink-0">
              <p className="text-[11px] font-medium text-[#A3A3A3] dark:text-zinc-400" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                <span className="text-[#A3A3A3] dark:text-zinc-400">$</span>
              </p>
              {loadingStats
                ? <div className="mt-1 h-9 w-32 animate-pulse rounded-lg bg-[#F0F0F0]" />
                : <p className="text-[38px] font-light leading-none tracking-tight text-[#0A0A0A] dark:text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                    {fmt(revenue)}
                  </p>}
              <p className="mt-1.5 max-w-[150px] text-[11px] leading-[1.4] text-[#A3A3A3] dark:text-zinc-400">
                Receita total acumulada das suas vendas
              </p>
            </div>

            {/* Mini bar chart */}
            <div className="flex-1">
              <ResponsiveContainer width="100%" height={72}>
                <BarChart data={REVENUE_MINI} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barSize={16} barCategoryGap="30%">
                  <Bar dataKey="v" radius={[5, 5, 0, 0]} isAnimationActive={false}>
                    {REVENUE_MINI.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === REVENUE_MINI.length - 1 ? miniBarActive : miniBarInactive}
                      />
                    ))}
                  </Bar>
                  <XAxis
                    dataKey="m"
                    tick={{ fontSize: 10, fill: chartTick }}
                    axisLine={false}
                    tickLine={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Total Produtos */}
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0A0A]">
              <Package size={18} className="text-white" strokeWidth={1.75} />
            </span>
          </div>
          <p className="mt-3 text-[13px] font-medium text-[#737373] dark:text-zinc-400" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            Total de Produtos
          </p>
          {loadingStats
            ? <div className="mt-2 h-10 w-20 animate-pulse rounded-lg bg-[#F0F0F0]" />
            : <p className="mt-2 text-[40px] font-light leading-none tracking-tight text-[#0A0A0A] dark:text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                {totalPubs.toLocaleString("pt-BR")}
              </p>}
          <div className="mt-2 flex items-center gap-1.5">
            <span className="flex items-center gap-0.5 text-[12px] font-bold text-emerald-500">
              <ArrowUpRight size={13} strokeWidth={2.5} />
              publicados
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-[#C0C0C0] dark:text-zinc-500">
              ativos agora
            </span>
          </div>
        </div>

        {/* Total Pedidos */}
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-start justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A0A0A]">
              <ShoppingCart size={18} className="text-white" strokeWidth={1.75} />
            </span>
          </div>
          <p className="mt-3 text-[13px] font-medium text-[#737373] dark:text-zinc-400" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            Total de Pedidos
          </p>
          {loadingStats
            ? <div className="mt-2 h-10 w-20 animate-pulse rounded-lg bg-[#F0F0F0]" />
            : <p className="mt-2 text-[40px] font-light leading-none tracking-tight text-[#0A0A0A] dark:text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                {totalOrders.toLocaleString("pt-BR")}
              </p>}
          <div className="mt-2 flex items-center gap-1.5">
            <span className="flex items-center gap-0.5 text-[12px] font-bold text-[#0A0A0A] dark:text-white">
              <ShoppingCart size={11} strokeWidth={2.5} />
              total
            </span>
            <span className="text-[11px] font-medium uppercase tracking-widest text-[#C0C0C0] dark:text-zinc-500">
              acumulado
            </span>
          </div>
        </div>
      </div>

      {/* ── Middle row ─────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">

        {/* Published products */}
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm flex flex-col dark:border-zinc-800 dark:bg-zinc-900">
          {/* Header */}
          <div className="mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0A0A0A] mb-3">
              <AlertTriangle size={17} className="text-white" strokeWidth={2.2} />
            </span>
            <p className="text-[15px] font-bold text-[#0A0A0A] dark:text-white leading-tight">Produtos Publicados</p>
            <p className="text-[11.5px] text-[#A3A3A3] dark:text-zinc-400 mt-0.5">análise de desempenho</p>
          </div>

          <div className="flex-1 space-y-1">
            {loadingPubs
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl p-2.5">
                    <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3 w-3/4 rounded" />
                      <Skeleton className="h-2.5 w-1/2 rounded" />
                    </div>
                  </div>
                ))
              : hasPublications
              ? publications!.map((pub) => (
                  <Link
                    key={pub.id}
                    to="/dashboard/publicacoes"
                    className="flex items-center gap-3.5 rounded-xl p-2.5 transition hover:bg-[#F7F7F7] dark:hover:bg-zinc-800 group"
                  >
                    <span className="relative flex h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#F0F0F0] bg-[#F7F7F7]">
                      {pub.thumbnail
                        ? <img src={pub.thumbnail} alt={pub.title} className="h-full w-full object-cover" loading="lazy" />
                        : <Package size={16} className="m-auto text-[#C0C0C0]" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-[#0A0A0A] dark:text-white">{pub.title}</p>
                      <p className="text-[11.5px] text-[#A3A3A3] dark:text-zinc-400">
                        {pub.price != null ? fmt(pub.price) : "—"} · ativo
                      </p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-[#D4D4D4] group-hover:text-[#A3A3A3] transition-colors" />
                  </Link>
                ))
              : (
                [
                  { id: "p1", title: "Suporte Celular Magnético",  price: 89.90,  img: "https://images.unsplash.com/photo-1556656793-08538906a9f8?w=80&h=80&fit=crop&auto=format" },
                  { id: "p2", title: "Fone Bluetooth TWS Pro",     price: 149.90, img: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=80&h=80&fit=crop&auto=format" },
                  { id: "p3", title: "Massageador Elétrico",       price: 129.00, img: "https://images.unsplash.com/photo-1519864658-d6a83ee7edc0?w=80&h=80&fit=crop&auto=format" },
                  { id: "p4", title: "Luminária LED USB",          price: 74.90,  img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format" },
                ].map((p) => (
                  <Link
                    key={p.id}
                    to="/dashboard/publicacoes"
                    className="flex items-center gap-3.5 rounded-xl p-2.5 transition hover:bg-[#F7F7F7] dark:hover:bg-zinc-800 group"
                  >
                    <span className="flex h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#F0F0F0] bg-[#F7F7F7]">
                      <img src={p.img} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-[#0A0A0A] dark:text-white">{p.title}</p>
                      <p className="text-[11.5px] text-[#A3A3A3] dark:text-zinc-400">{fmt(p.price)} · ativo</p>
                    </div>
                    <ChevronRight size={14} className="shrink-0 text-[#D4D4D4] group-hover:text-[#A3A3A3] transition-colors" />
                  </Link>
                ))
              )
            }
          </div>

          <Link
            to="/dashboard/publicacoes"
          className="mt-4 flex items-center justify-center gap-1 rounded-xl border border-[#F0F0F0] dark:border-zinc-800 py-2.5 text-[12.5px] font-medium text-[#A3A3A3] dark:text-zinc-400 transition hover:border-[#D4D4D4] dark:hover:border-zinc-700 hover:text-[#0A0A0A] dark:hover:text-white"
          >
            Ver todas as publicações <ChevronRight size={12} />
          </Link>
        </div>

        {/* Sales vs Time */}
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[15px] font-bold text-[#0A0A0A] dark:text-white">Vendas ao longo do tempo</p>
            {/* Text-only toggle — no pill container */}
            <div className="flex items-center gap-5">
              {(["Diário", "Semanal", "Mensal"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={[
                    "text-[13px] transition-all",
                    period === p
                      ? "font-bold text-[#0A0A0A] dark:text-white"
                      : "font-medium text-[#B0B0B0] dark:text-zinc-500 hover:text-[#737373] dark:hover:text-zinc-300",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mb-4 flex items-center gap-5">
            <span className="flex items-center gap-2 text-[11.5px] text-[#737373] dark:text-zinc-400">
              <span className="inline-block h-[3px] w-6 rounded-full bg-indigo-500" />
              Este período
            </span>
            <span className="flex items-center gap-2 text-[11.5px] text-[#737373] dark:text-zinc-400">
              <span className="inline-block h-[3px] w-6 rounded-full bg-amber-400" />
              Período anterior
            </span>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gCurrent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#6366F1" stopOpacity={0.22} />
                  <stop offset="90%" stopColor="#6366F1" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="gPrev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#F59E0B" stopOpacity={0.15} />
                  <stop offset="90%" stopColor="#F59E0B" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis
                dataKey="d"
                tick={{ fontSize: 11, fill: chartTick }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: chartTick }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <RTooltip content={<ChartTooltip />} cursor={false} />
              {/* Dashed vertical reference line at current period */}
              <ReferenceLine
                x={period === "Diário" ? DAILY_REFLINE : period === "Semanal" ? WEEKLY_REFLINE : MONTHLY_REFLINE}
                stroke={isDark ? "#FFFFFF" : "#0A0A0A"}
                strokeDasharray="4 4"
                strokeWidth={1.5}
              />
              {/* Previous period — amber line */}
              <Area
                type="monotone"
                dataKey="p"
                stroke="#F59E0B"
                strokeWidth={2}
                fill="url(#gPrev)"
                dot={false}
                activeDot={{ r: 5, fill: "#F59E0B", stroke: isDark ? "#111111" : "#fff", strokeWidth: 2 }}
              />
              {/* Current period — indigo line */}
              <Area
                type="monotone"
                dataKey="v"
                stroke="#6366F1"
                strokeWidth={2.5}
                fill="url(#gCurrent)"
                dot={false}
                activeDot={{ r: 5, fill: "#6366F1", stroke: isDark ? "#111111" : "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent orders ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E5E5E5] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-[#F5F5F5] dark:border-zinc-800 px-5 py-4">
          <p className="text-[15px] font-bold text-[#0A0A0A] dark:text-white">Pedidos Recentes</p>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-xl border border-[#E5E5E5] bg-[#F7F7F7] dark:border-zinc-700 dark:bg-zinc-800 p-0.5">
              {(["Hoje", "Esta semana"] as OTab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setOrdersTab(t)}
                  className={[
                    "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all",
                    ordersTab === t
                      ? "bg-white text-[#0A0A0A] shadow-sm font-semibold dark:bg-zinc-700 dark:text-white"
                      : "text-[#A3A3A3] dark:text-zinc-400 hover:text-[#525252] dark:hover:text-zinc-200",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
            <Link to="/dashboard/pedidos" className="rounded-xl border border-[#E5E5E5] dark:border-zinc-700 px-3 py-1.5 text-[12px] font-medium text-[#737373] dark:text-zinc-300 transition hover:border-[#D4D4D4] dark:hover:border-zinc-600 hover:text-[#0A0A0A] dark:hover:text-white">
              Ver todos
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            <thead>
              <tr className="border-b border-[#F5F5F5] dark:border-zinc-800">
                {["ID do Pedido", "Cliente", "Produto", "Valor", "Horário", "Status", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-widest text-[#C0C0C0] dark:text-zinc-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT_ORDERS.map((order) => (
                <tr key={order.id} className="group border-b border-[#F7F7F7] dark:border-zinc-800 last:border-0 transition-colors hover:bg-[#FAFAFA] dark:hover:bg-zinc-800/50">
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-[12px] text-[#737373] dark:text-zinc-400">#{order.id}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <CustomerAvatar name={order.customer} />
                      <span className="text-[13px] font-medium text-[#0A0A0A] dark:text-white">{order.customer}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] text-[#525252] dark:text-zinc-300">{order.product}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white">{fmt(order.amount)}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="text-[13px] text-[#A3A3A3] dark:text-zinc-400">{order.time}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLE[order.status]}`}>
                      {STATUS_LABEL[order.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <Link to="/dashboard/pedidos" className="flex items-center justify-center opacity-0 transition group-hover:opacity-100">
                      <ChevronRight size={15} className="text-[#C0C0C0] dark:text-zinc-500" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
