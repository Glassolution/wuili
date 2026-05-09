import { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { Plus, TrendingUp, TrendingDown, ChevronDown, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialData } from "@/hooks/useFinancialData";
import {
  getFinancialSummary,
  getCashflowDataForPeriod,
  filterOrdersByPeriod,
  getPeriodBounds,
  type Period,
} from "@/lib/financial";

// ── Formatter ──────────────────────────────────────────────────────────────────

const fmt = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

// ── Platform display config ────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { label: string; icon: string; iconBg: string; iconColor: string }> = {
  mercadolivre: { label: "Mercado Livre", icon: "ML", iconBg: "#FFE600", iconColor: "#0A0A0A" },
  shopee:       { label: "Shopee",        icon: "SP", iconBg: "#EE4D2D", iconColor: "#fff"    },
  amazon:       { label: "Amazon",        icon: "AZ", iconBg: "#FF9900", iconColor: "#fff"    },
  magalu:       { label: "Magalu",        icon: "MG", iconBg: "#0086FF", iconColor: "#fff"    },
  aliexpress:   { label: "AliExpress",    icon: "AE", iconBg: "#FF4747", iconColor: "#fff"    },
};

const DEFAULT_PLATFORM = { label: "Plataforma", icon: "??", iconBg: "#E5E5E5", iconColor: "#0A0A0A" };

function getPlatformConfig(platform: string | null) {
  if (!platform) return DEFAULT_PLATFORM;
  return PLATFORM_CONFIG[platform.toLowerCase()] ?? DEFAULT_PLATFORM;
}

// ── Status mapping ─────────────────────────────────────────────────────────────

function mapOrderStatus(status: string): { label: string; variant: "success" | "warning" | "error" } {
  switch (status.toLowerCase()) {
    case "paid":
    case "approved":
    case "completed":
    case "delivered":
      return { label: "Sucesso", variant: "success" };
    case "pending":
    case "processing":
    case "in_process":
      return { label: "Processando", variant: "warning" };
    case "refunded":
      return { label: "Reembolsado", variant: "error" };
    case "cancelled":
    case "canceled":
    case "failed":
      return { label: "Cancelado", variant: "error" };
    default:
      return { label: "Pendente", variant: "warning" };
  }
}

// ── Date formatter ─────────────────────────────────────────────────────────────

function formatTransactionDate(dateStr: string | null): string {
  const d = dateStr ? new Date(dateStr) : null;
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Period options ─────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: "Hoje",       value: "daily"   },
  { label: "Esta Semana", value: "weekly"  },
  { label: "Este Mês",   value: "monthly" },
];

// ── Custom tooltips ────────────────────────────────────────────────────────────

const EarningTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 shadow-lg text-sm">
      <p className="font-semibold text-[#0A0A0A]">{label} 2025</p>
      <p className="text-[#0A0A0A] font-medium">R$ {payload[0].value.toLocaleString("pt-BR")}</p>
    </div>
  );
};

const CashflowTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white px-3.5 py-2.5 shadow-lg text-sm">
      <p className="font-semibold text-[#0A0A0A] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-[#737373]">
          {p.name}: <span className="font-medium text-[#0A0A0A]">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const SaldosPage = () => {
  const { resolvedTheme } = useTheme();
  const [cashflowTab, setCashflowTab] = useState<"income" | "expense" | "savings">("income");
  const [period, setPeriod] = useState<Period>("monthly");
  const [periodOpen, setPeriodOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!periodOpen) return;
    const handler = (e: MouseEvent) => {
      if (periodRef.current && !periodRef.current.contains(e.target as Node)) {
        setPeriodOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [periodOpen]);

  const { pendingOrders, orders, isLoading, error } = useFinancialData();

  // ── Filter orders by selected period ────────────────────────────────────────
  const { start, end, prevStart, prevEnd } = useMemo(() => getPeriodBounds(period), [period]);

  const periodOrders = useMemo(
    () => filterOrdersByPeriod(orders, start, end),
    [orders, start, end]
  );
  const prevPeriodOrders = useMemo(
    () => filterOrdersByPeriod(orders, prevStart, prevEnd),
    [orders, prevStart, prevEnd]
  );

  const EMPTY_SUMMARY = { revenue: 0, costs: 0, fees: 0, profit: 0, margin: 0 };
  const summary     = useMemo(() => periodOrders.length > 0     ? getFinancialSummary(periodOrders)     : EMPTY_SUMMARY, [periodOrders]);
  const prevSummary = useMemo(() => prevPeriodOrders.length > 0 ? getFinancialSummary(prevPeriodOrders) : EMPTY_SUMMARY, [prevPeriodOrders]);

  const cashflowData = useMemo(
    () => getCashflowDataForPeriod(orders, period),
    [orders, period]
  );

  // Revenue change vs previous period
  const revenueChange =
    summary.revenue > 0 && prevSummary.revenue > 0
      ? ((summary.revenue - prevSummary.revenue) / prevSummary.revenue) * 100
      : 0;

  // Spending breakdown
  const totalSpending = summary.costs + summary.fees;
  const costsPct = totalSpending > 0 ? Math.round((summary.costs / totalSpending) * 100) : 73;

  const periodLabel = PERIOD_OPTIONS.find(o => o.value === period)?.label ?? "Este Mês";
  const comparisonLabel =
    period === "daily"   ? "Comparado a ontem" :
    period === "weekly"  ? "Comparado à semana anterior" :
                           "Comparado ao mês anterior";
  const costsSubLabel =
    period === "daily"   ? "Total de custos hoje" :
    period === "weekly"  ? "Total de custos esta semana" :
                           "Total de custos neste mês";

  const CFKey = cashflowTab;
  const highlightIndex = cashflowData.length > 0 ? cashflowData.length - 1 : 0;
  const isDark = resolvedTheme === "dark";
  const chartTick = isDark ? "#A1A1AA" : "#B0B0B0";
  const chartMain = isDark ? "#FFFFFF" : "#0A0A0A";
  const chartMutedBar = isDark ? "#3F3F46" : "#E8E8E8";

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-background p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white mb-1">
            Erro ao carregar dados financeiros
          </p>
          <p className="text-[13px] text-[#A0A0A0] dark:text-zinc-400">
            Tente recarregar a página. Se o problema persistir, entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-background p-6 space-y-5">

      {/* ── TOP ROW: Earning + Spending ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

        {/* Earning Overview */}
        <div className="rounded-2xl border border-[#E8E8E8] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Visão de Receita</h2>
              <button className="flex h-5 w-5 items-center justify-center rounded-full border border-[#E0E0E0] dark:border-zinc-700 text-[#A0A0A0] dark:text-zinc-400 hover:bg-[#F5F5F5] dark:hover:bg-zinc-800">
                <Plus size={11} />
              </button>
            </div>
            <div className="relative" ref={periodRef}>
              <button
                onClick={() => setPeriodOpen(v => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-[#0A0A0A] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-zinc-800 transition-colors"
              >
                {periodLabel}
                <ChevronDown size={13} className={`text-[#A0A0A0] dark:text-zinc-400 transition-transform ${periodOpen ? "rotate-180" : ""}`} />
              </button>
              {periodOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-20 min-w-[140px] rounded-xl border border-[#E5E5E5] dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 overflow-hidden">
                  {PERIOD_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => { setPeriod(opt.value); setPeriodOpen(false); }}
                      className="flex w-full items-center justify-between px-3.5 py-2 text-[13px] font-medium text-[#0A0A0A] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-zinc-800 transition-colors"
                    >
                      {opt.label}
                      {period === opt.value && <Check size={12} className="text-[#0A0A0A] dark:text-white" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-baseline gap-3 mb-1">
            {isLoading ? (
              <Skeleton className="h-9 w-44" />
            ) : (
              <span className="text-[34px] font-bold tracking-tight text-[#0A0A0A] dark:text-white">
                {fmt(summary.revenue)}
              </span>
            )}
            {isLoading ? (
              <Skeleton className="h-5 w-16 rounded-full" />
            ) : (
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                revenueChange >= 0
                  ? "bg-[#DCFCE7] text-[#16A34A]"
                  : "bg-[#FEE2E2] text-[#DC2626]"
              }`}>
                {revenueChange >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                {revenueChange >= 0 ? "+" : ""}{revenueChange.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-[#A0A0A0] dark:text-zinc-400 mb-5">{comparisonLabel}</p>

          <ResponsiveContainer width="100%" height={160}>
            {cashflowData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-[13px] text-[#A0A0A0] dark:text-zinc-400">
                  Sem dados financeiros ainda
                </p>
              </div>
            ) : (
              <AreaChart data={cashflowData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="earningGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={chartMain} stopOpacity={isDark ? 0.22 : 0.12} />
                    <stop offset="95%" stopColor={chartMain} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartTick }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                <RTooltip content={<EarningTooltip />} cursor={{ stroke: "#E0E0E0", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke={chartMain}
                  strokeWidth={2}
                  fill="url(#earningGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: chartMain, stroke: isDark ? "#18181B" : "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Spending Overview */}
        <div className="rounded-2xl border border-[#E8E8E8] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white mb-4">Visão de Gastos</h2>

          <div className="flex items-baseline gap-3 mb-1">
            {isLoading ? (
              <Skeleton className="h-9 w-36" />
            ) : (
              <span className="text-[30px] font-bold tracking-tight text-[#0A0A0A] dark:text-white">
                {fmt(summary.costs)}
              </span>
            )}
          </div>
          <p className="text-[12.5px] text-[#A0A0A0] dark:text-zinc-400 mb-5">{costsSubLabel}</p>

          <h3 className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white mb-3">Detalhamento de Gastos</h3>

          <div className="space-y-4">
            {/* Labels */}
            <div className="flex justify-between text-[12.5px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#0A0A0A]" />
                <span className="font-semibold text-[#0A0A0A] dark:text-white">Custo de Produto</span>
              </div>
              <span className="text-[#A0A0A0] dark:text-zinc-400">Taxas</span>
            </div>

            {/* Values */}
            <div className="flex justify-between text-[12.5px] text-[#737373] dark:text-zinc-300">
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <span>{fmt(summary.costs)}</span>
                  <span>{fmt(summary.fees)}</span>
                </>
              )}
            </div>

            {/* Progress bar */}
            <div className="relative h-3 rounded-full overflow-hidden bg-[#F0F0F0] dark:bg-zinc-800">
              <div className="absolute left-0 top-0 h-full rounded-full bg-[#0A0A0A]" style={{ width: `${costsPct}%` }} />
            </div>

            {/* Bottom values */}
            <div className="flex justify-between text-[12px] font-medium">
              {isLoading ? (
                <>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <span className="text-[#0A0A0A] dark:text-white">{fmt(summary.costs)}</span>
                  <span className="text-[#A0A0A0] dark:text-zinc-400">{fmt(summary.fees)}</span>
                </>
              )}
            </div>
          </div>

          {/* Breakdown list */}
          <div className="mt-5 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A]" />
                <span className="text-[12.5px] text-[#737373] dark:text-zinc-300">Custo de Produto</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span className="text-[12.5px] font-semibold text-[#0A0A0A] dark:text-white">
                  {fmt(summary.costs)}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A]" />
                <span className="text-[12.5px] text-[#737373] dark:text-zinc-300">Taxas de Plataforma</span>
              </div>
              {isLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <span className="text-[12.5px] font-semibold text-[#0A0A0A] dark:text-white">
                  {fmt(summary.fees)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: Cash Flow + Upcoming Bills ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

        {/* Cash Flow */}
        <div className="rounded-2xl border border-[#E8E8E8] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Fluxo de Caixa</h2>
            <button className="flex h-5 w-5 items-center justify-center rounded-full border border-[#E0E0E0] dark:border-zinc-700 text-[#A0A0A0] dark:text-zinc-400 hover:bg-[#F5F5F5] dark:hover:bg-zinc-800">
              <Plus size={11} />
            </button>
          </div>

          {isLoading ? (
            <Skeleton className="h-9 w-44 mb-3" />
          ) : (
            <span className="text-[34px] font-bold tracking-tight text-[#0A0A0A] dark:text-white">
              {fmt(summary.profit)}
            </span>
          )}

          {/* Tabs */}
          <div className="mt-3 mb-5 flex gap-1">
            {(["income", "expense", "savings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCashflowTab(tab)}
                className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-all ${
                  cashflowTab === tab
                    ? "bg-[#0A0A0A] text-white dark:bg-white dark:text-black"
                    : "text-[#A0A0A0] dark:text-zinc-400 hover:text-[#0A0A0A] dark:hover:text-white"
                }`}
              >
                {tab === "income" ? "Receita" : tab === "expense" ? "Custo" : "Lucro"}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={180}>
            {cashflowData.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-[13px] text-[#A0A0A0] dark:text-zinc-400">
                  Sem dados financeiros ainda
                </p>
              </div>
            ) : (
              <BarChart data={cashflowData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={18}>
                <XAxis dataKey="m" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartTick }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                <RTooltip content={<CashflowTooltip />} cursor={{ fill: "transparent" }} />
                <Bar dataKey={CFKey} radius={[6, 6, 6, 6]} name={cashflowTab === "income" ? "Receita" : cashflowTab === "expense" ? "Custo" : "Lucro"}>
                  {cashflowData.map((_, i) => (
                    <Cell key={i} fill={i === highlightIndex ? chartMain : chartMutedBar} />
                  ))}
                </Bar>
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Upcoming Bills / Pending Orders */}
        <div className="rounded-2xl border border-[#E8E8E8] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Próximos Pagamentos</h2>
            <button className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E0E0E0] dark:border-zinc-700 text-[#A0A0A0] dark:text-zinc-400 hover:bg-[#F5F5F5] dark:hover:bg-zinc-800">
              <Plus size={12} />
            </button>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </>
            ) : pendingOrders.length === 0 ? (
              <p className="text-[13px] text-[#A0A0A0] dark:text-zinc-400 text-center py-4">
                Nenhum pagamento pendente
              </p>
            ) : (
              pendingOrders.slice(0, 5).map((order) => {
                const date = new Date(order.created_at);
                const dateLabel = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
                const initials = order.id.slice(0, 2).toUpperCase();
                return (
                  <div key={order.id} className="flex items-center gap-3">
                    {/* Icon */}
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold bg-[#0A0A0A] text-white"
                    >
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-semibold text-[#0A0A0A] dark:text-white leading-tight truncate">
                        Pedido #{order.id.slice(0, 8)}
                      </p>
                      <p className="text-[12px] text-[#A0A0A0] dark:text-zinc-400 truncate">
                        {fmt(order.total ?? 0)}
                      </p>
                    </div>

                    {/* Date */}
                    <span className="shrink-0 text-[12.5px] font-medium text-[#737373] dark:text-zinc-300">
                      {dateLabel}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 border-t border-[#F0F0F0] dark:border-zinc-800 pt-4">
            <button className="w-full text-center text-[13px] font-semibold text-[#0A0A0A] dark:text-white hover:text-[#444] dark:hover:text-zinc-300 transition-colors">
              Ver tudo
            </button>
          </div>
        </div>
      </div>

      {/* ── BOTTOM: Recent Transactions ─────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E8E8E8] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Transações Recentes</h2>
          <button className="text-[13px] font-semibold text-[#0A0A0A] dark:text-white hover:text-[#444] dark:hover:text-zinc-300 transition-colors">
            Ver tudo
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white mb-1">
              Nenhuma transação encontrada
            </p>
            <p className="text-[13px] text-[#A0A0A0] dark:text-zinc-400 max-w-xs">
              Suas vendas, custos e repasses aparecerão aqui quando houver movimentações reais.
            </p>
          </div>
        ) : (
          <>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_180px_160px_120px] gap-4 border-b border-[#F0F0F0] dark:border-zinc-800 pb-3 mb-1">
              {["Atividade", "Data", "Valor", "Status"].map((h) => (
                <span key={h} className="text-[11.5px] font-semibold uppercase tracking-wide text-[#B0B0B0] dark:text-zinc-500">{h}</span>
              ))}
            </div>

            {/* Rows — show the 10 most recent orders */}
            <div className="divide-y divide-[#F5F5F5] dark:divide-zinc-800">
              {orders.slice(0, 10).map((order) => {
                const platform = getPlatformConfig(order.platform);
                const { label: statusLabel, variant: statusVariant } = mapOrderStatus(order.status);
                const dateStr = formatTransactionDate(order.ordered_at ?? order.created_at);
                const title = order.product_title
                  ? `Venda — ${platform.label}`
                  : `Pedido — ${platform.label}`;
                const isPositive = !["refunded", "cancelled", "canceled", "failed"].includes(
                  order.status.toLowerCase()
                );
                const amountStr = `${isPositive ? "+" : "−"}${fmt(order.total)}`;

                return (
                  <div key={order.id} className="grid grid-cols-[1fr_180px_160px_120px] gap-4 items-center py-3.5">
                    {/* Activity */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                        style={{ backgroundColor: platform.iconBg, color: platform.iconColor }}
                      >
                        {platform.icon}
                      </div>
                      <span className="truncate text-[13.5px] font-medium text-[#0A0A0A] dark:text-white">
                        {title}
                      </span>
                    </div>

                    {/* Date */}
                    <span className="text-[13px] text-[#737373] dark:text-zinc-300">{dateStr}</span>

                    {/* Amount */}
                    <span className={`text-[13.5px] font-semibold ${isPositive ? "text-[#16A34A]" : "text-[#0A0A0A] dark:text-white"}`}>
                      {amountStr}
                    </span>

                    {/* Status */}
                    <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                      statusVariant === "success"
                        ? "bg-[#DCFCE7] text-[#16A34A]"
                        : statusVariant === "error"
                        ? "bg-[#FEE2E2] text-[#DC2626]"
                        : "bg-[#FEF3C7] text-[#D97706]"
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${
                        statusVariant === "success"
                          ? "bg-[#16A34A]"
                          : statusVariant === "error"
                          ? "bg-[#DC2626]"
                          : "bg-[#D97706]"
                      }`} />
                      {statusLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

    </div>
  );
};

export default SaldosPage;
