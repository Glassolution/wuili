import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
} from "recharts";
import {
  ShoppingCart, DollarSign, TrendingUp, BarChart2,
  Search, SlidersHorizontal, Package, AlertCircle,
  ArrowUpRight, ArrowDownRight, MessageCircle,
  ChevronUp, ChevronDown, ChevronsUpDown, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTheme } from "next-themes";

// ── Types ─────────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  user_id: string;
  external_order_id: string | null;
  platform: string;
  product_title: string;
  product_image: string | null;
  buyer_name: string | null;
  sale_price: number;
  cost_price: number | null;
  profit: number | null;
  status: string;
  tracking_code: string | null;
  ordered_at: string | null;
  created_at: string;
  supplier?: string;
};

type TabFilter = "all" | "pending" | "paid" | "shipped" | "delivered" | "cancelled";
type SortKey = "sale_price" | "profit" | "ordered_at" | null;
type SortDir = "asc" | "desc";

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_ORDERS: Order[] = [
  {
    id: "1", user_id: "", external_order_id: "ML-00123", platform: "mercadolivre",
    product_title: "Suporte Celular Magnético para Carro Universal",
    product_image: null, buyer_name: "Ana Paula Ferreira",
    sale_price: 89.90, cost_price: 22.50, profit: 67.40,
    status: "delivered", tracking_code: "BR123456789XX",
    ordered_at: "2026-04-18T10:30:00Z", created_at: "2026-04-18T10:30:00Z",
    supplier: "CJ Dropshipping",
  },
  {
    id: "2", user_id: "", external_order_id: "ML-00124", platform: "mercadolivre",
    product_title: "Fone Bluetooth Sem Fio Esportivo TWS Pro",
    product_image: null, buyer_name: "Carlos Eduardo Lima",
    sale_price: 149.90, cost_price: 45.00, profit: 104.90,
    status: "shipped", tracking_code: "BR987654321YY",
    ordered_at: "2026-04-17T14:15:00Z", created_at: "2026-04-17T14:15:00Z",
    supplier: "CJ Dropshipping",
  },
  {
    id: "3", user_id: "", external_order_id: "SHP-00050", platform: "shopee",
    product_title: "Massageador Elétrico Pescoço e Ombros Portátil",
    product_image: null, buyer_name: "Mariana Costa",
    sale_price: 129.00, cost_price: 38.00, profit: 91.00,
    status: "paid", tracking_code: null,
    ordered_at: "2026-04-17T09:00:00Z", created_at: "2026-04-17T09:00:00Z",
    supplier: "ShenZhen Trade",
  },
  {
    id: "4", user_id: "", external_order_id: "ML-00125", platform: "mercadolivre",
    product_title: "Luminária LED USB Mesa Articulável Dimmer",
    product_image: null, buyer_name: "Roberto Mendes",
    sale_price: 74.90, cost_price: 18.00, profit: 56.90,
    status: "pending", tracking_code: null,
    ordered_at: "2026-04-16T18:45:00Z", created_at: "2026-04-16T18:45:00Z",
    supplier: "Global Source",
  },
  {
    id: "5", user_id: "", external_order_id: "ML-00126", platform: "mercadolivre",
    product_title: "Câmera de Segurança WiFi 1080p com Visão Noturna",
    product_image: null, buyer_name: "Juliana Souza",
    sale_price: 189.90, cost_price: 62.00, profit: 127.90,
    status: "delivered", tracking_code: "BR112233445ZZ",
    ordered_at: "2026-04-15T11:20:00Z", created_at: "2026-04-15T11:20:00Z",
    supplier: "CJ Dropshipping",
  },
  {
    id: "6", user_id: "", external_order_id: "SHP-00051", platform: "shopee",
    product_title: "Organizador Gaveta Modular Ajustável Kit 6 peças",
    product_image: null, buyer_name: "Fernando Alves",
    sale_price: 59.90, cost_price: 15.50, profit: 44.40,
    status: "cancelled", tracking_code: null,
    ordered_at: "2026-04-14T16:00:00Z", created_at: "2026-04-14T16:00:00Z",
    supplier: "Alibaba Supply",
  },
  {
    id: "7", user_id: "", external_order_id: "ML-00127", platform: "mercadolivre",
    product_title: "Relógio Smartwatch Fitness Monitor Cardíaco GPS",
    product_image: null, buyer_name: "Patrícia Oliveira",
    sale_price: 249.90, cost_price: 88.00, profit: 161.90,
    status: "shipped", tracking_code: "BR556677889WW",
    ordered_at: "2026-04-13T08:30:00Z", created_at: "2026-04-13T08:30:00Z",
    supplier: "FastDrop Co.",
  },
  {
    id: "8", user_id: "", external_order_id: "SHP-00052", platform: "shopee",
    product_title: "Jogo Tapete Antiderrapante Banheiro Kit 3 peças",
    product_image: null, buyer_name: "Diego Santos",
    sale_price: 49.90, cost_price: 12.00, profit: 37.90,
    status: "delivered", tracking_code: "BR990011223VV",
    ordered_at: "2026-04-12T13:10:00Z", created_at: "2026-04-12T13:10:00Z",
    supplier: "Global Source",
  },
];

const CHART_REVENUE = [
  { day: "Seg", value: 312 },
  { day: "Ter", value: 480 },
  { day: "Qua", value: 390 },
  { day: "Qui", value: 610 },
  { day: "Sex", value: 520 },
  { day: "Sáb", value: 740 },
  { day: "Dom", value: 430 },
];

const CHART_ORDERS = [
  { day: "Seg", qty: 3 },
  { day: "Ter", qty: 5 },
  { day: "Qua", qty: 4 },
  { day: "Qui", qty: 7 },
  { day: "Sex", qty: 6 },
  { day: "Sáb", qty: 9 },
  { day: "Dom", qty: 4 },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", paid: "Pago", shipped: "Enviado",
  delivered: "Entregue", cancelled: "Cancelado",
};

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-[#F5F5F5] text-[#525252] border border-[#E5E5E5] dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700",
  paid:      "bg-[#FAFAFA] text-[#262626] border border-[#D4D4D4] font-semibold dark:bg-zinc-800 dark:text-white dark:border-zinc-700",
  shipped:   "bg-[#F0F0F0] text-[#404040] border border-[#D9D9D9] dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
  delivered: "bg-[#0A0A0A] text-white border border-[#0A0A0A] dark:bg-white dark:text-black dark:border-white",
  cancelled: "bg-white text-[#A3A3A3] border border-[#E5E5E5] dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-700",
};

const PLATFORM_LABEL: Record<string, string> = {
  mercadolivre: "Mercado Livre",
  shopee: "Shopee",
};

const TABS = [
  { key: "all" as TabFilter,       label: "Todos" },
  { key: "pending" as TabFilter,   label: "Pendente" },
  { key: "paid" as TabFilter,      label: "Pago" },
  { key: "shipped" as TabFilter,   label: "Enviado" },
  { key: "delivered" as TabFilter, label: "Entregue" },
  { key: "cancelled" as TabFilter, label: "Cancelado" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

const StatCard = ({
  icon: Icon, label, value, sub, trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  trend: number;
}) => (
  <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
    <div className="flex items-center justify-between">
      <p className="text-[12px] font-medium text-[#A3A3A3] uppercase tracking-widest dark:text-zinc-400">{label}</p>
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5F5F5] dark:bg-zinc-800">
        <Icon size={14} className="text-[#525252] dark:text-zinc-200" />
      </span>
    </div>
    <p className="mt-3 text-[26px] font-black tracking-tight text-[#0A0A0A] leading-none dark:text-white">{value}</p>
    <div className="mt-2 flex items-center gap-1.5">
      <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${trend >= 0 ? "text-[#404040] dark:text-zinc-200" : "text-[#A3A3A3] dark:text-zinc-400"}`}>
        {trend >= 0
          ? <ArrowUpRight size={12} />
          : <ArrowDownRight size={12} />}
        {Math.abs(trend)}%
      </span>
      <span className="text-[11px] text-[#A3A3A3] dark:text-zinc-400">{sub}</span>
    </div>
  </div>
);

const SortIcon = ({ col, sortKey, dir }: { col: SortKey; sortKey: SortKey; dir: SortDir }) => {
  if (col !== sortKey) return <ChevronsUpDown size={12} className="text-[#C0C0C0] dark:text-zinc-500" />;
  return dir === "asc"
    ? <ChevronUp size={12} className="text-[#0A0A0A] dark:text-white" />
    : <ChevronDown size={12} className="text-[#0A0A0A] dark:text-white" />;
};

const BuyerAvatar = ({ name }: { name: string }) => {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  const hue = name.charCodeAt(0) % 6;
  const colors = [
    "bg-[#1e293b]", "bg-[#334155]", "bg-[#374151]",
    "bg-[#3f3f46]", "bg-[#292524]", "bg-[#1c1917]",
  ];
  return (
    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${colors[hue]} text-[10px] font-bold text-white`}>
      {initials}
    </span>
  );
};

const CustomTooltipRevenue = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 shadow-lg text-[12px] dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-[#A3A3A3] dark:text-zinc-400">{label}</p>
      <p className="font-bold text-[#0A0A0A] dark:text-white">{formatBRL(payload[0].value)}</p>
    </div>
  );
};

const CustomTooltipOrders = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white px-3 py-2 shadow-lg text-[12px] dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-[#A3A3A3] dark:text-zinc-400">{label}</p>
      <p className="font-bold text-[#0A0A0A] dark:text-white">{payload[0].value} pedidos</p>
    </div>
  );
};

const SkeletonRow = () => (
  <tr className="border-b border-[#F0F0F0]">
    {[140, 100, 80, 70, 65, 65, 80, 80, 80, 110].map((w, i) => (
      <td key={i} className="px-4 py-3.5">
        <Skeleton style={{ width: w, height: 13 }} className="rounded" />
      </td>
    ))}
  </tr>
);

// ── Page ──────────────────────────────────────────────────────────────────────

const OrdersPage = () => {
  const { user } = useAuth();
  const { resolvedTheme } = useTheme();
  const [tab, setTab] = useState<TabFilter>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { data: remoteOrders, isLoading, isError } = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders" as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .select("*")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  // Use remote data if available, fall back to mock
  const all: Order[] = (remoteOrders && remoteOrders.length > 0) ? remoteOrders : MOCK_ORDERS;

  // Metrics
  const totalOrders  = all.length;
  const totalRevenue = all.reduce((s, o) => s + (o.sale_price ?? 0), 0);
  const totalProfit  = all.reduce((s, o) => s + (o.profit ?? 0), 0);
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Filtering
  const filtered = useMemo(() => {
    let rows = tab === "all" ? all : all.filter((o) => o.status === tab);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (o) =>
          o.product_title.toLowerCase().includes(q) ||
          (o.buyer_name ?? "").toLowerCase().includes(q) ||
          (o.tracking_code ?? "").toLowerCase().includes(q) ||
          (o.supplier ?? "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [all, tab, search]);

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = sortKey === "ordered_at"
        ? new Date(a.ordered_at ?? "").getTime()
        : (a[sortKey] as number) ?? 0;
      const bv = sortKey === "ordered_at"
        ? new Date(b.ordered_at ?? "").getTime()
        : (b[sortKey] as number) ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  };

  const tabCount = (key: TabFilter) =>
    key === "all" ? all.length : all.filter((o) => o.status === key).length;

  const handleCopyTracking = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Código copiado!");
  };

  const handleContactSupplier = (order: Order) => {
    toast.info(`Abrindo chat com ${order.supplier ?? "fornecedor"}…`);
  };

  const isMockData = !remoteOrders || remoteOrders.length === 0;
  const isDark = resolvedTheme === "dark";
  const chartGrid = isDark ? "#3a3a3a" : "#F0F0F0";
  const chartTick = isDark ? "#A1A1AA" : "#A3A3A3";
  const chartMain = isDark ? "#FFFFFF" : "#0A0A0A";
  const chartCursorStroke = isDark ? "#6b7280" : "#E5E5E5";
  const chartCursorFill = isDark ? "#27272A" : "#F5F5F5";

  return (
    <div className="space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-black tracking-tight text-[#0A0A0A] dark:text-white">Pedidos</h1>
          <p className="mt-0.5 text-[13px] text-[#A3A3A3] dark:text-zinc-400">
            Acompanhe vendas, custos e envios em tempo real.
            {isMockData && <span className="ml-2 rounded-full border border-[#E5E5E5] bg-[#F5F5F5] px-2 py-0.5 text-[10px] font-semibold text-[#A3A3A3] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">dados de exemplo</span>}
          </p>
        </div>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={DollarSign}   label="Receita Total"    value={formatBRL(totalRevenue)} sub="vs mês anterior" trend={5.54} />
        <StatCard icon={BarChart2}    label="Ticket Médio"     value={formatBRL(avgTicket)}    sub="vs mês anterior" trend={2.10} />
        <StatCard icon={ShoppingCart} label="Total de Pedidos" value={String(totalOrders)}     sub="vs mês anterior" trend={-1.20} />
        <StatCard icon={TrendingUp}   label="Lucro Total"      value={formatBRL(totalProfit)}  sub="vs mês anterior" trend={8.30} />
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Revenue line chart */}
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-bold text-[#0A0A0A] dark:text-white">Receita semanal</p>
              <p className="text-[12px] text-[#A3A3A3] dark:text-zinc-400">Últimos 7 dias</p>
            </div>
            <span className="rounded-lg border border-[#E5E5E5] bg-[#F5F5F5] px-2.5 py-1 text-[11px] font-medium text-[#525252] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Esta semana
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={CHART_REVENUE} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartMain} stopOpacity={isDark ? 0.25 : 0.10} />
                  <stop offset="95%" stopColor={chartMain} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chartTick }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <RTooltip content={<CustomTooltipRevenue />} cursor={{ stroke: chartCursorStroke }} />
              <Area
                type="monotone" dataKey="value"
                stroke={chartMain} strokeWidth={2}
                fill="url(#gradRevenue)" dot={false} activeDot={{ r: 4, fill: chartMain, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Orders bar chart */}
        <div className="rounded-2xl border border-[#E5E5E5] bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[14px] font-bold text-[#0A0A0A] dark:text-white">Volume de pedidos</p>
              <p className="text-[12px] text-[#A3A3A3] dark:text-zinc-400">Últimos 7 dias</p>
            </div>
            <span className="rounded-lg border border-[#E5E5E5] bg-[#F5F5F5] px-2.5 py-1 text-[11px] font-medium text-[#525252] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              Esta semana
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={CHART_ORDERS} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chartTick }} axisLine={false} tickLine={false} allowDecimals={false} />
              <RTooltip content={<CustomTooltipOrders />} cursor={{ fill: chartCursorFill }} />
              <Bar dataKey="qty" fill={chartMain} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Order list ───────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E5E5E5] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F0F0] px-5 py-4 dark:border-zinc-800">
          <p className="text-[15px] font-bold text-[#0A0A0A] dark:text-white">Lista de Pedidos</p>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A3A3A3] dark:text-zinc-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pedido..."
                className="h-8 w-48 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] pl-8 pr-3 text-[12px] text-[#0A0A0A] placeholder:text-[#C0C0C0] outline-none focus:border-[#D4D4D4] focus:bg-white transition dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:bg-zinc-800"
              />
            </div>
            {/* Status filter */}
            <div className="relative">
              <SlidersHorizontal size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3] dark:text-zinc-500" />
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setTab(e.target.value as TabFilter); }}
                className="h-8 appearance-none rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] pl-7 pr-6 text-[12px] text-[#525252] outline-none focus:border-[#D4D4D4] focus:bg-white transition cursor-pointer dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-zinc-500 dark:focus:bg-zinc-800"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendente</option>
                <option value="paid">Pago</option>
                <option value="shipped">Enviado</option>
                <option value="delivered">Entregue</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 overflow-x-auto border-b border-[#F0F0F0] px-5 dark:border-zinc-800" style={{ scrollbarWidth: "none" }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={[
                "relative shrink-0 whitespace-nowrap px-3 py-3 text-[12px] font-medium transition-colors",
                tab === t.key
                  ? "text-[#0A0A0A] after:absolute after:bottom-0 after:inset-x-0 after:h-[2px] after:bg-[#0A0A0A] after:rounded-t dark:text-white dark:after:bg-white"
                  : "text-[#A3A3A3] hover:text-[#525252] dark:text-zinc-500 dark:hover:text-zinc-200",
              ].join(" ")}
            >
              {t.label}
              {tabCount(t.key) > 0 && (
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab === t.key ? "bg-[#F0F0F0] text-[#0A0A0A] dark:bg-zinc-700 dark:text-white" : "bg-[#F5F5F5] text-[#A3A3A3] dark:bg-zinc-800 dark:text-zinc-400"}`}>
                  {tabCount(t.key)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-[12px]">
            <thead>
              <tr className="border-b border-[#F0F0F0] bg-[#FAFAFA] dark:border-zinc-800 dark:bg-zinc-800/60">
                {[
                  { label: "Cliente",     key: null          },
                  { label: "Produto",     key: null          },
                  { label: "Plataforma",  key: null          },
                  { label: "Valor",       key: "sale_price" as SortKey },
                  { label: "Custo",       key: null          },
                  { label: "Lucro",       key: "profit" as SortKey     },
                  { label: "Status",      key: null          },
                  { label: "Fornecedor",  key: null          },
                  { label: "Rastreio",    key: null          },
                  { label: "Data",        key: "ordered_at" as SortKey },
                  { label: "",            key: null          },
                ].map(({ label, key }) => (
                  <th
                    key={label || "actions"}
                    onClick={() => key && toggleSort(key)}
                    className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-widest text-[#A3A3A3] whitespace-nowrap select-none dark:text-zinc-400 ${key ? "cursor-pointer hover:text-[#525252] dark:hover:text-zinc-200" : ""}`}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {key && <SortIcon col={key} sortKey={sortKey} dir={sortDir} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                : isError
                ? (
                  <tr>
                    <td colSpan={11}>
                      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                        <AlertCircle size={28} className="text-[#D4D4D4] dark:text-zinc-500" />
                        <p className="text-[13px] text-[#A3A3A3] dark:text-zinc-400">Erro ao carregar pedidos.</p>
                      </div>
                    </td>
                  </tr>
                )
                : sorted.length === 0
                ? (
                  <tr>
                    <td colSpan={11}>
                      <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <Package size={36} className="text-[#E5E5E5] dark:text-zinc-600" />
                        <p className="text-[14px] font-semibold text-[#0A0A0A] dark:text-white">Nenhum pedido encontrado</p>
                        <p className="text-[12px] text-[#A3A3A3] dark:text-zinc-400">Tente mudar os filtros ou aguarde novas vendas.</p>
                      </div>
                    </td>
                  </tr>
                )
                : sorted.map((order) => {
                  const statusKey = order.status || "pending";
                  const platform  = order.platform || "mercadolivre";

                  return (
                    <tr
                      key={order.id}
                      className="group border-b border-[#F7F7F7] last:border-0 transition-colors hover:bg-[#FAFAFA] dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                    >
                      {/* Cliente */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <BuyerAvatar name={order.buyer_name || "?"} />
                          <span className="max-w-[110px] truncate font-medium text-[#0A0A0A] dark:text-white">
                            {order.buyer_name || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Produto */}
                      <td className="px-4 py-3.5">
                        <p className="max-w-[200px] truncate text-[#262626] dark:text-zinc-200">{order.product_title}</p>
                      </td>

                      {/* Plataforma */}
                      <td className="px-4 py-3.5">
                        <span className="rounded-full border border-[#E5E5E5] bg-[#F5F5F5] px-2.5 py-1 text-[10px] font-semibold text-[#525252] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                          {PLATFORM_LABEL[platform] ?? platform}
                        </span>
                      </td>

                      {/* Valor */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-[#0A0A0A] dark:text-white">{formatBRL(order.sale_price)}</span>
                      </td>

                      {/* Custo */}
                      <td className="px-4 py-3.5 text-[#A3A3A3] dark:text-zinc-400">
                        {order.cost_price != null ? formatBRL(order.cost_price) : "—"}
                      </td>

                      {/* Lucro */}
                      <td className="px-4 py-3.5">
                        {order.profit != null
                          ? <span className={`font-semibold ${order.profit >= 0 ? "text-[#0A0A0A] dark:text-white" : "text-[#A3A3A3] dark:text-zinc-500 line-through"}`}>
                              {formatBRL(order.profit)}
                            </span>
                          : <span className="text-[#C0C0C0] dark:text-zinc-500">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${STATUS_STYLE[statusKey] ?? STATUS_STYLE.pending}`}>
                          {STATUS_LABEL[statusKey] ?? statusKey}
                        </span>
                      </td>

                      {/* Fornecedor */}
                      <td className="px-4 py-3.5 text-[#525252] dark:text-zinc-300">
                        {order.supplier ?? "—"}
                      </td>

                      {/* Rastreio */}
                      <td className="px-4 py-3.5">
                        {order.tracking_code
                          ? (
                            <button
                              onClick={() => handleCopyTracking(order.tracking_code!)}
                              className="flex items-center gap-1 rounded-lg border border-[#E5E5E5] bg-[#F7F7F7] px-2 py-1 font-mono text-[10px] text-[#525252] transition hover:border-[#D4D4D4] hover:bg-[#F0F0F0] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-700"
                            >
                              {order.tracking_code}
                              <Copy size={9} className="shrink-0 text-[#C0C0C0] dark:text-zinc-500" />
                            </button>
                          )
                          : <span className="text-[#D4D4D4] dark:text-zinc-600">—</span>}
                      </td>

                      {/* Data */}
                      <td className="px-4 py-3.5 text-[#A3A3A3] dark:text-zinc-400 whitespace-nowrap">
                        {formatDate(order.ordered_at)}
                      </td>

                      {/* Ações */}
                      <td className="px-4 py-3.5">
                        <button
                          onClick={() => handleContactSupplier(order)}
                          className="flex items-center gap-1.5 rounded-xl border border-[#E5E5E5] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#525252] opacity-0 shadow-sm transition hover:border-[#D4D4D4] hover:bg-[#F5F5F5] hover:text-[#0A0A0A] group-hover:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white"
                        >
                          <MessageCircle size={11} />
                          Fornecedor
                        </button>
                      </td>
                    </tr>
                  );
                })
              }
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {sorted.length > 0 && (
          <div className="border-t border-[#F0F0F0] px-5 py-3 text-[11px] text-[#A3A3A3] dark:border-zinc-800 dark:text-zinc-400">
            Mostrando {sorted.length} de {all.length} pedidos
          </div>
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
