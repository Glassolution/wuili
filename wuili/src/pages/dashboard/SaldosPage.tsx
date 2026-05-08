import { useState, useMemo, useEffect, useRef } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { Plus, TrendingUp, TrendingDown, ChevronDown, Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Skeleton } from "@/components/ui/skeleton";
import PlatformLogo from "@/components/dashboard/PlatformLogo";
import { useIsMobile } from "@/hooks/use-mobile";
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

// ── Static data (kept as-is) ───────────────────────────────────────────────────

const RECENT_TRANSACTIONS = [
  { activity: "Venda — Mercado Livre",    platform: "Mercado Livre",   date: "Qua 10:29 AM", amount: "+R$ 525,00",   status: "Sucesso"      },
  { activity: "Repasse — Shopee",         platform: "Shopee",          date: "Ter 14:15 PM", amount: "+R$ 1.240,00",  status: "Sucesso"      },
  { activity: "Custo — CJ Dropshipping",  platform: "CJ Dropshipping", date: "Seg 09:00 AM", amount: "−R$ 312,50",   status: "Processando"  },
  { activity: "Taxa — Mercado Livre",     platform: "Mercado Livre",   date: "Dom 18:45 PM", amount: "−R$ 89,00",    status: "Sucesso"      },
  { activity: "Venda — Shopee",           platform: "Shopee",          date: "Sáb 11:20 AM", amount: "+R$ 870,00",   status: "Sucesso"      },
];

const PlatformLogoBadge = ({ platform, size = 32 }: { platform: string; size?: number }) => (
  <div className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#E5E5E5] bg-white p-1 dark:border-white/10 dark:bg-white">
    <PlatformLogo platform={platform} size={size} />
  </div>
);

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
  const isMobile = useIsMobile();
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

  const { pendingOrders, orders, isLoading } = useFinancialData();

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
  const highlightIndex = cashflowData.length > 0 ? cashflowData.length - 1 : 9;
  const isDark = resolvedTheme === "dark";
  const chartTick = isDark ? "#A1A1AA" : "#B0B0B0";
  const chartMain = isDark ? "#FFFFFF" : "#0A0A0A";
  const chartMutedBar = isDark ? "#3F3F46" : "#E8E8E8";
  const earningChartHeight = isMobile ? 128 : 160;
  const cashflowChartHeight = isMobile ? 142 : 180;
  const cashflowBarSize = isMobile ? 14 : 18;

  return (
    <div className="min-h-full space-y-4 bg-[#FAFAFA] dark:bg-background md:space-y-5 md:p-6">

      {/* ── TOP ROW: Earning + Spending ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:gap-5">

        {/* Earning Overview */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 md:p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Visão de Receita</h2>
              <button className="hidden h-5 w-5 items-center justify-center rounded-full border border-[#E0E0E0] text-[#A0A0A0] hover:bg-[#F5F5F5] dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:flex">
                <Plus size={11} />
              </button>
            </div>
            <div className="relative" ref={periodRef}>
              <button
                onClick={() => setPeriodOpen(v => !v)}
                className="flex min-h-9 items-center gap-1.5 rounded-xl border border-[#E0E0E0] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 sm:text-[13px]"
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

          <div className="mb-1 flex flex-wrap items-baseline gap-2 sm:gap-3">
            {isLoading ? (
              <Skeleton className="h-8 w-40 sm:h-9 sm:w-44" />
            ) : (
              <span className="text-[28px] font-bold leading-none tracking-tight text-[#0A0A0A] dark:text-white sm:text-[34px]">
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
          <p className="mb-4 text-[12.5px] text-[#A0A0A0] dark:text-zinc-400 sm:mb-5">{comparisonLabel}</p>

          <ResponsiveContainer width="100%" height={earningChartHeight}>
            <AreaChart data={cashflowData} margin={{ top: 4, right: isMobile ? 0 : 4, left: isMobile ? -34 : -20, bottom: 0 }}>
              <defs>
                <linearGradient id="earningGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartMain} stopOpacity={isDark ? 0.22 : 0.12} />
                  <stop offset="95%" stopColor={chartMain} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis dataKey="m" tick={{ fontSize: isMobile ? 10 : 11, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis hide={isMobile} tick={{ fontSize: 10, fill: chartTick }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
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
          </ResponsiveContainer>
        </div>

        {/* Spending Overview */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 md:p-6">
          <h2 className="mb-3 text-[15px] font-semibold text-[#0A0A0A] dark:text-white sm:mb-4">Visão de Gastos</h2>

          <div className="mb-1 flex flex-wrap items-baseline gap-2 sm:gap-3">
            {isLoading ? (
              <Skeleton className="h-8 w-36 sm:h-9" />
            ) : (
              <span className="text-[26px] font-bold leading-none tracking-tight text-[#0A0A0A] dark:text-white sm:text-[30px]">
                {fmt(summary.costs)}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[12px] font-semibold text-[#DC2626]">
              <TrendingDown size={11} />−1,5%
            </span>
          </div>
          <p className="mb-4 text-[12.5px] text-[#A0A0A0] dark:text-zinc-400 sm:mb-5">{costsSubLabel}</p>

          <h3 className="mb-3 text-[13px] font-semibold text-[#0A0A0A] dark:text-white">Detalhamento de Gastos</h3>

          <div className="space-y-3.5 sm:space-y-4">
            {/* Labels */}
            <div className="flex justify-between gap-3 text-[12.5px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#0A0A0A] dark:bg-white" />
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
              <div className="absolute left-0 top-0 h-full rounded-full bg-[#0A0A0A] dark:bg-white" style={{ width: `${costsPct}%` }} />
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
          <div className="mt-4 space-y-2.5 sm:mt-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A] dark:bg-white" />
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
                <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A] dark:bg-white" />
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_360px] lg:gap-5">

        {/* Cash Flow */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 md:p-6">
          <div className="mb-3 flex items-center gap-2 sm:mb-4">
            <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Fluxo de Caixa</h2>
            <button className="hidden h-5 w-5 items-center justify-center rounded-full border border-[#E0E0E0] text-[#A0A0A0] hover:bg-[#F5F5F5] dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:flex">
              <Plus size={11} />
            </button>
          </div>

          {isLoading ? (
            <Skeleton className="mb-3 h-8 w-40 sm:h-9 sm:w-44" />
          ) : (
            <span className="text-[28px] font-bold leading-none tracking-tight text-[#0A0A0A] dark:text-white sm:text-[34px]">
              {fmt(summary.profit)}
            </span>
          )}

          {/* Tabs */}
          <div className="mb-4 mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-[#F5F5F5] p-1 dark:bg-zinc-800/80 sm:mb-5 sm:mt-3 sm:inline-flex sm:bg-transparent sm:p-0">
            {(["income", "expense", "savings"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setCashflowTab(tab)}
                className={`rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-all sm:rounded-full sm:px-4 sm:py-1.5 ${
                  cashflowTab === tab
                    ? "bg-[#0A0A0A] text-white shadow-sm dark:bg-white dark:text-black"
                    : "text-[#A0A0A0] dark:text-zinc-400 hover:text-[#0A0A0A] dark:hover:text-white"
                }`}
              >
                {tab === "income" ? "Receita" : tab === "expense" ? "Custo" : "Lucro"}
              </button>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={cashflowChartHeight}>
            <BarChart data={cashflowData} margin={{ top: 4, right: isMobile ? 0 : 4, left: isMobile ? -34 : -28, bottom: 0 }} barSize={cashflowBarSize}>
              <XAxis dataKey="m" tick={{ fontSize: isMobile ? 10 : 11, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis hide={isMobile} tick={{ fontSize: 10, fill: chartTick }} axisLine={false} tickLine={false} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
              <RTooltip content={<CashflowTooltip />} cursor={{ fill: "transparent" }} />
              <Bar dataKey={CFKey} radius={[6, 6, 6, 6]} name={cashflowTab === "income" ? "Receita" : cashflowTab === "expense" ? "Custo" : "Lucro"}>
                {cashflowData.map((_, i) => (
                  <Cell key={i} fill={i === highlightIndex ? chartMain : chartMutedBar} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Bills / Pending Orders */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between sm:mb-5">
            <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Próximos Pagamentos</h2>
            <button className="flex h-8 w-8 items-center justify-center rounded-full border border-[#E0E0E0] text-[#A0A0A0] hover:bg-[#F5F5F5] dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 sm:h-6 sm:w-6">
              <Plus size={12} />
            </button>
          </div>

          <div className="space-y-3 sm:space-y-4">
            {isLoading ? (
              <>
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
                <Skeleton className="h-12 w-full rounded-xl" />
              </>
            ) : pendingOrders.length === 0 ? (
              <p className="rounded-2xl bg-[#F7F7F7] py-6 text-center text-[13px] text-[#A0A0A0] dark:bg-zinc-800/60 dark:text-zinc-400 sm:bg-transparent sm:py-4">
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
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A0A0A] text-[11px] font-bold text-white dark:bg-white dark:text-black"
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

          <div className="mt-4 border-t border-[#F0F0F0] pt-3 dark:border-zinc-800 sm:mt-6 sm:pt-4">
            <button className="min-h-10 w-full rounded-xl text-center text-[13px] font-semibold text-[#0A0A0A] transition-colors hover:bg-[#F7F7F7] hover:text-[#444] dark:text-white dark:hover:bg-zinc-800 dark:hover:text-zinc-300 sm:min-h-0 sm:rounded-none sm:hover:bg-transparent">
              Ver tudo
            </button>
          </div>
        </div>
      </div>

      {/* ── BOTTOM: Recent Transactions ─────────────────────────────────── */}
      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 md:p-6">
        <div className="mb-4 flex items-center justify-between sm:mb-5">
          <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Transações Recentes</h2>
          <button className="rounded-xl px-2 py-1.5 text-[13px] font-semibold text-[#0A0A0A] transition-colors hover:bg-[#F7F7F7] hover:text-[#444] dark:text-white dark:hover:bg-zinc-800 dark:hover:text-zinc-300">
            Ver tudo
          </button>
        </div>

        <div className="space-y-2.5 md:hidden">
          {RECENT_TRANSACTIONS.map((tx, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl border border-[#F0F0F0] bg-[#FAFAFA] p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
              <PlatformLogoBadge platform={tx.platform} size={34} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-[#0A0A0A] dark:text-white">{tx.activity}</p>
                <p className="mt-0.5 truncate text-[12px] text-[#737373] dark:text-zinc-400">{tx.date}</p>
              </div>

              <div className="shrink-0 text-right">
                <p className={`text-[13px] font-bold ${tx.amount.startsWith("+") ? "text-[#16A34A]" : "text-[#0A0A0A] dark:text-white"}`}>
                  {tx.amount}
                </p>
                <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                  tx.status === "Sucesso"
                    ? "bg-[#DCFCE7] text-[#16A34A]"
                    : "bg-[#FEF3C7] text-[#D97706]"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${tx.status === "Sucesso" ? "bg-[#16A34A]" : "bg-[#D97706]"}`} />
                  {tx.status}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Table header */}
        <div className="mb-1 hidden grid-cols-[1fr_180px_160px_120px] gap-4 border-b border-[#F0F0F0] pb-3 dark:border-zinc-800 md:grid">
          {["Atividade", "Data", "Valor", "Status"].map((h) => (
            <span key={h} className="text-[11.5px] font-semibold uppercase tracking-wide text-[#B0B0B0] dark:text-zinc-500">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="hidden divide-y divide-[#F5F5F5] dark:divide-zinc-800 md:block">
          {RECENT_TRANSACTIONS.map((tx, i) => (
            <div key={i} className="grid grid-cols-[1fr_180px_160px_120px] gap-4 items-center py-3.5">
              {/* Activity */}
              <div className="flex items-center gap-3 min-w-0">
                <PlatformLogoBadge platform={tx.platform} size={28} />
                <span className="truncate text-[13.5px] font-medium text-[#0A0A0A] dark:text-white">{tx.activity}</span>
              </div>

              {/* Date */}
              <span className="text-[13px] text-[#737373] dark:text-zinc-300">{tx.date}</span>

              {/* Amount */}
              <span className={`text-[13.5px] font-semibold ${tx.amount.startsWith("+") ? "text-[#16A34A]" : "text-[#0A0A0A] dark:text-white"}`}>
                {tx.amount}
              </span>

              {/* Status */}
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${
                tx.status === "Sucesso"
                  ? "bg-[#DCFCE7] text-[#16A34A]"
                  : "bg-[#FEF3C7] text-[#D97706]"
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${tx.status === "Sucesso" ? "bg-[#16A34A]" : "bg-[#D97706]"}`} />
                {tx.status}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default SaldosPage;
