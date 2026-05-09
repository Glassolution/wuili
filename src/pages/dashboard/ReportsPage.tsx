import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Link } from "react-router-dom";

// ── Types ─────────────────────────────────────────────────────────────────────

type Order = {
  id: string;
  platform: string | null;
  product_title: string | null;
  sale_price: number;
  cost_price: number | null;
  profit: number | null;
  status: string;
  ordered_at: string | null;
  created_at: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVE_STATUSES = ["paid", "delivered", "shipped", "approved", "completed"];
const MONTH_LABELS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const PIE_COLORS = [
  "hsl(0,0%,10%)", "hsl(0,0%,35%)", "hsl(0,0%,55%)",
  "hsl(0,0%,72%)", "hsl(0,0%,24%)", "hsl(0,0%,46%)", "hsl(0,0%,64%)",
];

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const tooltipStyle = {
  background: "white",
  border: "1px solid hsl(216,30%,91%)",
  borderRadius: "12px",
  boxShadow: "0 8px 24px rgba(10,37,64,0.1)",
};

// ── Page ──────────────────────────────────────────────────────────────────────

const ReportsPage = () => {
  const { user } = useAuth();
  const planLimits = usePlanLimits();

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["reports-orders", user?.id],
    enabled: !!user && !planLimits.loading && planLimits.hasAdvancedReports,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, platform, product_title, sale_price, cost_price, profit, status, ordered_at, created_at")
        .eq("user_id", user!.id)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  // Only active orders for financial metrics
  const active = useMemo(
    () => orders.filter(o => ACTIVE_STATUSES.includes(o.status)),
    [orders]
  );

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const totalRevenue = active.reduce((s, o) => s + (o.sale_price ?? 0), 0);
  const totalCost    = active.reduce((s, o) => s + (o.cost_price ?? 0), 0);
  const totalProfit  = active.reduce((s, o) => s + (o.profit ?? (o.sale_price - (o.cost_price ?? 0))), 0);
  const totalOrders  = active.length;
  const avgTicket    = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const kpis = [
    { label: "Ticket médio",  value: fmt(avgTicket)    },
    { label: "Total pedidos", value: String(totalOrders) },
    { label: "Receita total", value: fmt(totalRevenue) },
    { label: "Lucro total",   value: fmt(totalProfit)  },
  ];

  // ── Revenue vs Profit by month ────────────────────────────────────────────
  const revenueData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const map = new Map<string, { faturamento: number; lucro: number }>(
      MONTH_LABELS.map(m => [m, { faturamento: 0, lucro: 0 }])
    );
    for (const o of active) {
      const d = new Date(o.ordered_at ?? o.created_at);
      if (d.getFullYear() !== year) continue;
      const label = MONTH_LABELS[d.getMonth()];
      const cur = map.get(label)!;
      cur.faturamento += o.sale_price ?? 0;
      cur.lucro       += o.profit ?? (o.sale_price - (o.cost_price ?? 0));
    }
    return MONTH_LABELS.map(m => ({ month: m, ...map.get(m)! }));
  }, [active]);

  // ── Orders by platform ────────────────────────────────────────────────────
  const platformData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of active) {
      const p = o.platform ?? "outros";
      map[p] = (map[p] ?? 0) + 1;
    }
    return Object.entries(map).map(([platform, count]) => ({
      day: platform === "mercadolivre" ? "Mercado Livre" : platform,
      ml: count,
    }));
  }, [active]);

  // ── Top 5 products ────────────────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of active) {
      const name = o.product_title ?? "Sem título";
      counts[name] = (counts[name] ?? 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const max = sorted[0]?.[1] ?? 1;
    return sorted.map(([name, sales]) => ({ name, sales, max }));
  }, [active]);

  // ── Platform distribution (%) ─────────────────────────────────────────────
  const pieData = useMemo(() => {
    if (totalOrders === 0) return [];
    const map: Record<string, number> = {};
    for (const o of active) {
      const p = o.platform ?? "outros";
      map[p] = (map[p] ?? 0) + 1;
    }
    return Object.entries(map).map(([platform, count]) => ({
      name: platform === "mercadolivre" ? "Mercado Livre" : platform,
      value: Math.round((count / totalOrders) * 100),
    }));
  }, [active, totalOrders]);

  // ── Empty state ───────────────────────────────────────────────────────────
  const isEmpty = !isLoading && active.length === 0;

  if (!planLimits.loading && !planLimits.hasAdvancedReports) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white dark:bg-white dark:text-black">
                Disponível no plano Pro
              </span>
              <h2 className="mt-4 text-[22px] font-bold tracking-[-0.02em] text-foreground">
                Relatórios avançados bloqueados
              </h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-muted-foreground">
                O plano gratuito não inclui relatórios completos. Faça upgrade para acompanhar faturamento, lucro, pedidos por plataforma e produtos mais vendidos.
              </p>
            </div>
            <Link
              to="/dashboard/planos"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-black px-5 text-[13px] font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100"
            >
              Fazer upgrade
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 opacity-60 pointer-events-none lg:grid-cols-4">
          {["Ticket médio", "Total pedidos", "Receita total", "Lucro total"].map((label) => (
            <div key={label} className="card-wuili p-5">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-black">R$ --</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card-wuili p-5">
            <p className="text-xs text-muted-foreground font-medium">{k.label}</p>
            {isLoading
              ? <div className="mt-2 h-7 w-28 animate-pulse rounded bg-muted" />
              : <p className="text-2xl font-black mt-1">{k.value}</p>}
          </div>
        ))}
      </div>

      {isEmpty && (
        <div className="card-wuili flex flex-col items-center justify-center gap-2 py-20 text-center">
          <p className="text-[15px] font-semibold text-foreground">Você ainda não possui pedidos.</p>
          <p className="text-[13px] text-muted-foreground">Os relatórios serão gerados automaticamente quando houver vendas.</p>
        </div>
      )}

      {!isEmpty && (
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Revenue vs Profit */}
          <div className="card-wuili p-6">
            <h3 className="text-sm font-bold mb-4">Faturamento vs Lucro</h3>
            {isLoading
              ? <Skeleton className="h-60 w-full rounded-xl" />
              : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="gFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(0,0%,85%)" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="hsl(0,0%,85%)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gLuc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="hsl(0,0%,50%)" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="hsl(0,0%,50%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,91%)" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `R${(v/1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
                    <Legend />
                    <Area type="monotone" dataKey="faturamento" stroke="hsl(0,0%,85%)" fill="url(#gFat)" strokeWidth={2} />
                    <Area type="monotone" dataKey="lucro"       stroke="hsl(0,0%,50%)" fill="url(#gLuc)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Orders by platform */}
          <div className="card-wuili p-6">
            <h3 className="text-sm font-bold mb-4">Pedidos por plataforma</h3>
            {isLoading
              ? <Skeleton className="h-60 w-full rounded-xl" />
              : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={platformData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,30%,91%)" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="ml" name="Pedidos" fill="hsl(0,0%,85%)" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
          </div>

          {/* Top 5 products */}
          <div className="card-wuili p-6">
            <h3 className="text-sm font-bold mb-4">Top 5 produtos mais vendidos</h3>
            {isLoading
              ? <Skeleton className="h-40 w-full rounded-xl" />
              : topProducts.length === 0
              ? <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
              : (
                <div className="space-y-4">
                  {topProducts.map((p, i) => (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate max-w-[70%]">{i + 1}. {p.name}</span>
                        <span className="text-sm font-bold text-foreground">{p.sales} vendas</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-black rounded-full transition-all dark:bg-white"
                          style={{ width: `${(p.sales / p.max) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>

          {/* Distribution pie */}
          <div className="card-wuili p-6">
            <h3 className="text-sm font-bold mb-4">Distribuição por plataforma</h3>
            {isLoading
              ? <Skeleton className="h-60 w-full rounded-xl" />
              : pieData.length === 0
              ? <p className="text-sm text-muted-foreground">Sem dados suficientes.</p>
              : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={pieData} cx="50%" cy="50%"
                      innerRadius={60} outerRadius={90}
                      paddingAngle={4} dataKey="value"
                      label={({ name, value }) => `${name} ${value}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              )}
          </div>

        </div>
      )}
    </div>
  );
};

export default ReportsPage;
