import { useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";
import { Plus, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";
import { useTheme } from "next-themes";

// ── Mock data ──────────────────────────────────────────────────────────────────

const EARNING_DATA = [
  { m: "Jan", v: 3200 },
  { m: "Fev", v: 4100 },
  { m: "Mar", v: 3800 },
  { m: "Abr", v: 8802 },
  { m: "Mai", v: 6500 },
  { m: "Jun", v: 7200 },
  { m: "Jul", v: 9800 },
];

const CASHFLOW_DATA = [
  { m: "Jan", income: 18, expense: 12, savings: 6 },
  { m: "Fev", income: 22, expense: 15, savings: 8 },
  { m: "Mar", income: 19, expense: 13, savings: 7 },
  { m: "Abr", income: 25, expense: 18, savings: 9 },
  { m: "Mai", income: 21, expense: 14, savings: 8 },
  { m: "Jun", income: 28, expense: 20, savings: 10 },
  { m: "Jul", income: 24, expense: 16, savings: 9 },
  { m: "Ago", income: 30, expense: 22, savings: 11 },
  { m: "Set", income: 26, expense: 18, savings: 9 },
  { m: "Out", income: 85, expense: 55, savings: 30 },
  { m: "Nov", income: 20, expense: 14, savings: 8 },
];

const SPENDING_BREAKDOWN = [
  { label: "Custo de Produto", value: 8800, pct: 73 },
  { label: "Taxas de Plataforma", value: 1300, pct: 27 },
];

const UPCOMING_BILLS = [
  {
    name: "Mercado Livre",
    subtitle: "Taxa de venda mensal",
    dateLabel: "28 Jun",
    date: "Jun 28",
    bg: "#FFE600",
    initials: "ML",
    textColor: "#0A0A0A",
  },
  {
    name: "Shopee",
    subtitle: "Comissão de plataforma",
    dateLabel: "30 Jun",
    date: "Jun 30",
    bg: "#EE4D2D",
    initials: "SP",
    textColor: "#fff",
  },
  {
    name: "CJ Dropshipping",
    subtitle: "Pedidos pendentes",
    dateLabel: "4 Jul",
    date: "Jul 4",
    bg: "#0A0A0A",
    initials: "CJ",
    textColor: "#fff",
  },
];

const RECENT_TRANSACTIONS = [
  { activity: "Venda — Mercado Livre",    icon: "ML", iconBg: "#FFE600", iconColor: "#0A0A0A", date: "Qua 10:29 AM", amount: "+R$ 525,00",   status: "Sucesso"      },
  { activity: "Repasse — Shopee",         icon: "SP", iconBg: "#EE4D2D", iconColor: "#fff",    date: "Ter 14:15 PM", amount: "+R$ 1.240,00",  status: "Sucesso"      },
  { activity: "Custo — CJ Dropshipping",  icon: "CJ", iconBg: "#0A0A0A", iconColor: "#fff",    date: "Seg 09:00 AM", amount: "−R$ 312,50",   status: "Processando"  },
  { activity: "Taxa — Mercado Livre",     icon: "ML", iconBg: "#FFE600", iconColor: "#0A0A0A", date: "Dom 18:45 PM", amount: "−R$ 89,00",    status: "Sucesso"      },
  { activity: "Venda — Shopee",           icon: "SP", iconBg: "#EE4D2D", iconColor: "#fff",    date: "Sáb 11:20 AM", amount: "+R$ 870,00",   status: "Sucesso"      },
];

// ── Custom tooltip ─────────────────────────────────────────────────────────────

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
          {p.name}: <span className="font-medium text-[#0A0A0A]">{p.value}%</span>
        </p>
      ))}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const SaldosPage = () => {
  const { resolvedTheme } = useTheme();
  const [cashflowTab, setCashflowTab] = useState<"income" | "expense" | "savings">("income");
  const [period, setPeriod] = useState("Este Mês");

  const CFKey = cashflowTab;
  const highlightIndex = 9; // Out
  const isDark = resolvedTheme === "dark";
  const chartTick = isDark ? "#A1A1AA" : "#B0B0B0";
  const chartMain = isDark ? "#FFFFFF" : "#0A0A0A";
  const chartMutedBar = isDark ? "#3F3F46" : "#E8E8E8";

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
            <button className="flex items-center gap-1.5 rounded-lg border border-[#E0E0E0] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-[13px] font-medium text-[#0A0A0A] dark:text-white hover:bg-[#F5F5F5] dark:hover:bg-zinc-800 transition-colors">
              {period}
              <ChevronDown size={13} className="text-[#A0A0A0] dark:text-zinc-400" />
            </button>
          </div>

          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-[34px] font-bold tracking-tight text-[#0A0A0A] dark:text-white">R$ 20.520,32</span>
            <span className="flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[12px] font-semibold text-[#16A34A]">
              <TrendingUp size={11} />+1,5%
            </span>
          </div>
          <p className="text-[12.5px] text-[#A0A0A0] dark:text-zinc-400 mb-5">Comparado ao mês anterior</p>

          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={EARNING_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="earningGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={chartMain} stopOpacity={isDark ? 0.22 : 0.12} />
                  <stop offset="95%" stopColor={chartMain} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chartTick }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v/1000).toFixed(0)}k`} />
              <RTooltip content={<EarningTooltip />} cursor={{ stroke: "#E0E0E0", strokeWidth: 1 }} />
              <Area
                type="monotone"
                dataKey="v"
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
        <div className="rounded-2xl border border-[#E8E8E8] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white mb-4">Visão de Gastos</h2>

          <div className="flex items-baseline gap-3 mb-1">
            <span className="text-[30px] font-bold tracking-tight text-[#0A0A0A] dark:text-white">R$ 8.800,00</span>
            <span className="flex items-center gap-1 rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[12px] font-semibold text-[#DC2626]">
              <TrendingDown size={11} />−1,5%
            </span>
          </div>
          <p className="text-[12.5px] text-[#A0A0A0] dark:text-zinc-400 mb-5">Total de custos neste mês</p>

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
              <span>R$ 8.800,00</span>
              <span>R$ 1.300,00</span>
            </div>

            {/* Progress bar */}
            <div className="relative h-3 rounded-full overflow-hidden bg-[#F0F0F0] dark:bg-zinc-800">
              <div className="absolute left-0 top-0 h-full rounded-full bg-[#0A0A0A]" style={{ width: "73%" }} />
            </div>

            {/* Bottom values */}
            <div className="flex justify-between text-[12px] font-medium">
              <span className="text-[#0A0A0A] dark:text-white">R$ 8.800,00</span>
              <span className="text-[#A0A0A0] dark:text-zinc-400">R$ 800,00</span>
            </div>
          </div>

          {/* Breakdown list */}
          <div className="mt-5 space-y-2.5">
            {SPENDING_BREAKDOWN.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#0A0A0A]" />
                  <span className="text-[12.5px] text-[#737373] dark:text-zinc-300">{item.label}</span>
                </div>
                <span className="text-[12.5px] font-semibold text-[#0A0A0A] dark:text-white">
                  R$ {item.value.toLocaleString("pt-BR")}
                </span>
              </div>
            ))}
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

          <span className="text-[34px] font-bold tracking-tight text-[#0A0A0A] dark:text-white">R$ 342.233,44</span>

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
            <BarChart data={CASHFLOW_DATA} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barSize={18}>
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: chartTick }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chartTick }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
              <RTooltip content={<CashflowTooltip />} cursor={{ fill: "transparent" }} />
              <Bar dataKey={CFKey} radius={[6, 6, 6, 6]} name={cashflowTab === "income" ? "Receita" : cashflowTab === "expense" ? "Custo" : "Lucro"}>
                {CASHFLOW_DATA.map((_, i) => (
                  <Cell key={i} fill={i === highlightIndex ? chartMain : chartMutedBar} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Upcoming Bills */}
        <div className="rounded-2xl border border-[#E8E8E8] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-[#0A0A0A] dark:text-white">Próximos Pagamentos</h2>
            <button className="flex h-6 w-6 items-center justify-center rounded-full border border-[#E0E0E0] dark:border-zinc-700 text-[#A0A0A0] dark:text-zinc-400 hover:bg-[#F5F5F5] dark:hover:bg-zinc-800">
              <Plus size={12} />
            </button>
          </div>

          <div className="space-y-4">
            {UPCOMING_BILLS.map((bill) => (
              <div key={bill.name} className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold"
                  style={{ backgroundColor: bill.bg, color: bill.textColor }}
                >
                  {bill.initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-semibold text-[#0A0A0A] dark:text-white leading-tight">{bill.name}</p>
                  <p className="text-[12px] text-[#A0A0A0] dark:text-zinc-400 truncate">{bill.subtitle}</p>
                </div>

                {/* Date */}
                <span className="shrink-0 text-[12.5px] font-medium text-[#737373] dark:text-zinc-300">{bill.date}</span>
              </div>
            ))}
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

        {/* Table header */}
        <div className="grid grid-cols-[1fr_180px_160px_120px] gap-4 border-b border-[#F0F0F0] dark:border-zinc-800 pb-3 mb-1">
          {["Atividade", "Data", "Valor", "Status"].map((h) => (
            <span key={h} className="text-[11.5px] font-semibold uppercase tracking-wide text-[#B0B0B0] dark:text-zinc-500">{h}</span>
          ))}
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#F5F5F5] dark:divide-zinc-800">
          {RECENT_TRANSACTIONS.map((tx, i) => (
            <div key={i} className="grid grid-cols-[1fr_180px_160px_120px] gap-4 items-center py-3.5">
              {/* Activity */}
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                  style={{ backgroundColor: tx.iconBg, color: tx.iconColor }}
                >
                  {tx.icon}
                </div>
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
