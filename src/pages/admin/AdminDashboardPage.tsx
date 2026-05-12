import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Filter,
  LifeBuoy,
  Loader2,
  Lock,
  Plus,
  ReceiptText,
  RefreshCcw,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

type AdminDashboardPayload = {
  metrics: AdminMetrics;
  monthlyRevenue: MonthlyRevenue[];
  transactions: AdminTransaction[];
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
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" })
        .format(date)
        .replace(".", ""),
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

  const paidSubscriptions = (paidGrossSubsRes.data ?? []) as SubscriptionRow[];
  const monthlyRevenue = buildMonthlyRevenue(paidSubscriptions);
  const grossRevenue = paidSubscriptions.reduce((sum, subscription) => sum + Number(subscription.amount ?? 0), 0);
  const mrr = ((activeSubsRes.data ?? []) as Array<{ amount: number | null }>).reduce(
    (sum, subscription) => sum + Number(subscription.amount ?? 0),
    0
  );

  const transactions = ((transactionsRes.data ?? []) as SubscriptionRow[]).map((subscription) => {
    const profile = profilesByUser.get(subscription.user_id);
    return {
      id: subscription.id,
      user_id: subscription.user_id,
      user_name: profile?.full_name ?? profile?.display_name ?? profile?.email ?? null,
      email: profile?.email ?? null,
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
      paid_users: paidUsersRes.count ?? 0,
      mrr,
      total_orders: totalOrdersRes.count ?? 0,
      gross_revenue: grossRevenue,
      growth_rate: calculateGrowth(monthlyRevenue),
    },
    monthlyRevenue,
    transactions,
  };
}

const adminRoleChecks = (userId: string) => [
  { _role: "admin" },
  { role: "admin" },
  { _user_id: userId, _role: "admin" },
  { user_id: userId, role: "admin" },
];

async function checkAdminAccess(userId: string) {
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

const formatTime = (value: string | null) => {
  if (!value) return "--:--";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
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
  if (["active", "approved", "authorized", "paid"].includes(normalized)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  }
  if (["pending", "waiting", "in_process"].includes(normalized)) {
    return "bg-amber-50 text-amber-700 border-amber-100";
  }
  return "bg-neutral-100 text-neutral-500 border-neutral-200";
};

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

const truncatePaymentId = (paymentId?: string | null, fallback?: string) => {
  const source = paymentId || fallback || "";
  if (!source) return "Sem ID";
  if (source.length <= 12) return source;
  return `${source.slice(0, 6)}...${source.slice(-4)}`;
};

const AdminDashboardPage = () => {
  const { user, loading } = useAuth();

  const { data: isAdmin = false, isLoading: loadingRole } = useQuery({
    queryKey: ["admin-dashboard-access", user?.id],
    enabled: !!user?.id,
    queryFn: () => checkAdminAccess(user!.id),
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
  const maxMonthlyRevenue = useMemo(
    () => Math.max(...monthlyRevenue.map((month) => month.value), 1),
    [monthlyRevenue]
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
  const recentUsers = useMemo(() => {
    const seen = new Set<string>();
    return transactions.filter((transaction) => {
      if (seen.has(transaction.user_id)) return false;
      seen.add(transaction.user_id);
      return true;
    }).slice(0, 5);
  }, [transactions]);
  const activeSubscriptions = useMemo(
    () => transactions.filter((transaction) => ["active", "approved", "authorized", "paid"].includes(transaction.status?.toLowerCase?.() ?? "")).slice(0, 5),
    [transactions]
  );
  const latestRevenue = monthlyRevenue.at(-1)?.value ?? 0;
  const previousRevenue = monthlyRevenue.at(-2)?.value ?? 0;
  const hasGrowthComparison = previousRevenue > 0;
  const topTransactions = useMemo(
    () => [...transactions].sort((a, b) => Number(b.amount ?? 0) - Number(a.amount ?? 0)).slice(0, 4),
    [transactions]
  );
  const topTransactionTotal = useMemo(
    () => topTransactions.reduce((sum, transaction) => sum + Number(transaction.amount ?? 0), 0),
    [topTransactions]
  );
  const bestTransaction = topTransactions[0] ?? null;
  const revenueShare = metrics.gross_revenue > 0 ? Math.round((metrics.mrr / metrics.gross_revenue) * 100) : 0;
  const monthRangeLabel = monthlyRevenue.length > 0
    ? `${monthlyRevenue[0]?.label ?? ""} - ${monthlyRevenue.at(-1)?.label ?? ""}`
    : "Sem período";

  if (loading || loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <Loader2 className="h-8 w-8 animate-spin text-[#111111]" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5] p-6 text-[#111111]">
        <div className="w-full max-w-md rounded-[28px] border border-black/[0.05] bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111111] text-white">
            <Lock size={21} />
          </div>
          <h1 className="mt-5 text-[24px] font-bold">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-black/50">
            Este dashboard é exclusivo para usuários com role admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell active="dashboard" userId={user.id}>
      {isError ? (
        <div className="mt-8 rounded-[28px] border border-black/[0.05] bg-white p-8 text-[#111111] shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <p className="text-[18px] font-bold">Não foi possível carregar o dashboard admin.</p>
          <p className="mt-2 text-[14px] text-black/50">
            Verifique as permissões de leitura das tabelas profiles, subscriptions e orders.
          </p>
        </div>
      ) : loadingDashboard ? (
        <div className="mt-16 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#111111]" />
        </div>
      ) : (
        <div className="mx-auto max-w-[1560px] pb-14">
          <header className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="flex h-12 w-12 items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5"
                aria-label="Adicionar relatório"
              >
                <Plus size={22} strokeWidth={1.7} />
              </button>
              {(recentUsers.length ? recentUsers.slice(0, 3) : transactions.slice(0, 3)).map((transaction) => (
                <PersonPill key={transaction.id} transaction={transaction} />
              ))}
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-black/[0.08] bg-[#111111] text-[14px] font-bold text-white shadow-[0_10px_30px_rgba(0,0,0,0.10)]">
                VL
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden rounded-full border border-black/[0.06] bg-white/80 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.04)] sm:flex">
                {["Visão geral", "Histórico", "Analytics"].map((tab, index) => (
                  <a
                    key={tab}
                    href={index === 0 ? "#overview" : index === 1 ? "#historico" : "#analytics"}
                    className={cn(
                      "rounded-full px-5 py-2.5 text-[13px] font-semibold transition",
                      index === 0 ? "bg-[#111111] text-white" : "text-black/45 hover:bg-[#F5F5F3] hover:text-[#111111]"
                    )}
                  >
                    {tab}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#111111]">
                <span className="relative h-6 w-11 rounded-full bg-[#111111]">
                  <span className="absolute right-1 top-1 h-4 w-4 rounded-full bg-white" />
                </span>
                Tempo real
              </div>
            </div>
          </header>

          <section id="overview" className="relative mt-10 overflow-hidden rounded-[42px] border border-black/[0.04] bg-[#FAFAF8]/75 px-5 py-8 shadow-[0_30px_90px_rgba(0,0,0,0.05)] backdrop-blur-xl md:px-10 md:py-11">
            <div className="pointer-events-none absolute -left-16 top-8 h-40 w-40 rounded-full bg-white/80 blur-2xl" />
            <div className="pointer-events-none absolute right-12 top-8 hidden h-44 w-44 rounded-full bg-black/[0.035] blur-3xl xl:block" />

            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1fr)_520px]">
              <div>
                <p className="text-[54px] font-semibold leading-none tracking-[-0.08em] text-black/[0.16] md:text-[86px] xl:text-[112px]">
                  New report
                </p>
                <div className="mt-9 flex flex-wrap items-end gap-4">
                  <div>
                    <p className="text-[26px] font-semibold tracking-[-0.05em] text-[#111111] md:text-[34px]">Revenue</p>
                    <p id="receita" className="mt-3 break-words text-[56px] font-semibold leading-[0.95] tracking-[-0.08em] text-[#111111] md:text-[86px] xl:text-[104px]">
                      {formatBRL(metrics.gross_revenue)}
                    </p>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-emerald-600 px-4 py-2 text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(5,150,105,0.18)]">
                      {hasGrowthComparison ? `${metrics.growth_rate >= 0 ? "+" : ""}${metrics.growth_rate.toFixed(1)}%` : "Sem comparação"}
                    </span>
                    <span className="rounded-full bg-[#111111] px-4 py-2 text-[13px] font-bold text-white">
                      {formatBRL(latestRevenue)}
                    </span>
                  </div>
                </div>
                <p className="mt-5 text-[15px] font-medium text-black/48">
                  {hasGrowthComparison ? `vs período anterior ${formatBRL(previousRevenue)} · ${monthRangeLabel}` : `Sem comparação disponível · ${monthRangeLabel}`}
                </p>

                <DistributionStrip transactions={topTransactions} total={topTransactionTotal} />
              </div>

              <div className="grid content-start gap-4 sm:grid-cols-3 xl:grid-cols-2">
                <FloatingStat
                  className="xl:translate-y-10"
                  eyebrow="Top sales"
                  value={String(metrics.total_orders)}
                  label={bestTransaction?.user_name || bestTransaction?.email || "Sem vendas"}
                  transaction={bestTransaction}
                />
                <FloatingStat
                  dark
                  eyebrow="Best deal"
                  value={bestTransaction ? formatBRL(bestTransaction.amount) : formatBRL(0)}
                  label={bestTransaction ? formatPlan(bestTransaction.plan) : "Sem dados"}
                  transaction={bestTransaction}
                />
                <FloatingStat
                  className="xl:col-span-2 xl:ml-20"
                  eyebrow="MRR"
                  value={formatBRL(metrics.mrr)}
                  label={`${revenueShare}% do faturamento bruto`}
                />
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)_440px]">
            <EditorialCard className="bg-[#ECEBE7]" title="Receita por plano" action="Filters">
              {planRevenue.length === 0 ? (
                <EmptyState message="Nenhuma receita por plano ainda." />
              ) : (
                <div className="mt-5 space-y-3">
                  {planRevenue.map((plan) => {
                    const pct = metrics.gross_revenue > 0 ? Math.round((plan.amount / metrics.gross_revenue) * 100) : 0;
                    return (
                      <div key={plan.plan} className="flex items-center gap-4 rounded-[20px] bg-white px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,0.035)]">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F5F5F3] text-[13px] font-bold text-[#111111]">
                          {plan.plan.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px] font-semibold text-[#111111]">{plan.plan}</p>
                          <p className="text-[12px] font-medium text-black/38">{plan.count} assinatura(s)</p>
                        </div>
                        <p className="text-right text-[16px] font-semibold tracking-[-0.03em] text-[#111111]">{formatBRL(plan.amount)}</p>
                        <span className="rounded-full bg-[#F1F1EF] px-3 py-1 text-[12px] font-semibold text-[#111111]">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </EditorialCard>

            <EditorialCard id="analytics" className="bg-[#E9E8E4]" title="Revenue by month" action="Filters">
              <div className="mt-6 flex min-h-[270px] items-end justify-center gap-4 overflow-hidden rounded-[28px] bg-[#F5F5F3] px-5 pb-7 pt-10">
                {monthlyRevenue.length === 0 ? (
                  <EmptyState message="Sem dados suficientes para o gráfico." />
                ) : (
                  monthlyRevenue.map((month, index) => (
                    <div key={month.key} className="flex h-[220px] flex-1 flex-col items-center justify-end gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black/45 shadow-[0_8px_18px_rgba(0,0,0,0.035)]">
                        {formatBRL(month.value)}
                      </span>
                      <div
                        className={cn(
                          "w-full max-w-[70px] rounded-t-[26px] transition duration-300 hover:scale-[1.03]",
                          index % 2 === 0 ? "bg-[#111111]" : "bg-white"
                        )}
                        style={{ height: `${Math.max((month.value / maxMonthlyRevenue) * 170, month.value > 0 ? 24 : 8)}px` }}
                      />
                      <span className="text-[12px] font-semibold capitalize text-black/38">{month.label}</span>
                    </div>
                  ))
                )}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <MicroMetric label="Usuários" value={String(metrics.total_users)} />
                <MicroMetric label="Pagos" value={String(metrics.paid_users)} positive />
                <MicroMetric label="Pedidos" value={String(metrics.total_orders)} />
              </div>
            </EditorialCard>

            <div className="space-y-5">
              <EditorialCard className="bg-white" title="Ranking" action="Revenue">
                <div className="mt-5 grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3 text-[13px]">
                  <p className="font-semibold text-black/40">Sales</p>
                  <p className="font-semibold text-black/40">Revenue</p>
                  <p className="font-semibold text-black/40">Plan</p>
                  {(topTransactions.length ? topTransactions : transactions.slice(0, 4)).map((transaction) => (
                    <DealRow key={transaction.id} transaction={transaction} />
                  ))}
                  {transactions.length === 0 && (
                    <div className="col-span-3">
                      <EmptyState message="Nenhuma transação encontrada." />
                    </div>
                  )}
                </div>
              </EditorialCard>

              <EditorialCard className="bg-white" title="Operação" action="Live">
                <div className="mt-5 grid gap-3">
                  <OperationRow icon={ReceiptText} label="Pedidos" value={String(metrics.total_orders)} detail="Pedidos registrados" />
                  <OperationRow icon={RefreshCcw} label="Reembolsos" value={String(operationalCounts?.refunds ?? 0)} detail="Pendentes" />
                  <OperationRow icon={LifeBuoy} label="Suporte" value={String(operationalCounts?.tickets ?? 0)} detail="Tickets abertos" />
                </div>
              </EditorialCard>
            </div>
          </section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <section className="overflow-hidden rounded-[34px] border border-black/[0.05] bg-white shadow-[0_20px_80px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-5 border-b border-black/[0.05] px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-black/32">Histórico real</p>
                  <h2 id="historico" className="mt-1 text-[26px] font-semibold tracking-[-0.05em] text-[#111111]">Payments feed</h2>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[#F5F5F3] px-4 py-2 text-[13px] font-semibold text-black/50">
                  <Activity size={15} />
                  {transactions.length} registros
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="text-left text-[12px] font-semibold text-black/35">
                      <th className="px-6 py-4">Usuário</th>
                      <th className="px-6 py-4">Plano</th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Horário</th>
                      <th className="px-6 py-4">Pagamento</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-14 text-center text-[14px] text-black/42">
                          Nenhuma transação encontrada.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((transaction, index) => (
                        <TransactionRow key={transaction.id} transaction={transaction} index={index} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <div className="space-y-5">
              <EditorialCard className="bg-[#111111] text-white" title="Platform value" action="MRR">
                <div className="mt-5 rounded-[28px] bg-white/[0.08] p-5">
                  <p className="text-[13px] font-semibold text-white/45">Receita mensal</p>
                  <p className="mt-2 text-[42px] font-semibold tracking-[-0.07em] text-white">{formatBRL(metrics.mrr)}</p>
                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(Math.max(revenueShare, metrics.mrr > 0 ? 8 : 0), 100)}%` }} />
                  </div>
                  <p className="mt-3 text-[12px] text-white/45">{revenueShare}% do faturamento bruto total</p>
                </div>
              </EditorialCard>

              <EditorialCard className="bg-white" title="Assinaturas ativas" action="Planos">
                {activeSubscriptions.length === 0 ? (
                  <EmptyState message="Nenhuma assinatura ativa encontrada." />
                ) : (
                  <div className="mt-5 space-y-3">
                    {activeSubscriptions.map((transaction) => (
                      <CompactSubscriptionRow key={transaction.id} transaction={transaction} />
                    ))}
                  </div>
                )}
              </EditorialCard>
            </div>
          </section>
        </div>
      )}
    </AdminShell>
  );
};

const PersonPill = ({ transaction }: { transaction: AdminTransaction }) => (
  <span className="inline-flex h-12 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 pr-4 text-[14px] font-semibold text-[#111111] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
    <Avatar transaction={transaction} size="sm" />
    <span className="max-w-[120px] truncate">{transaction.user_name || transaction.email || "Usuário"}</span>
  </span>
);

const FloatingStat = ({
  eyebrow,
  value,
  label,
  transaction,
  dark = false,
  className,
}: {
  eyebrow: string;
  value: string;
  label: string;
  transaction?: AdminTransaction | null;
  dark?: boolean;
  className?: string;
}) => (
  <article
    className={cn(
      "min-h-[142px] rounded-[24px] border p-5 shadow-[0_18px_45px_rgba(0,0,0,0.08)] transition duration-300 hover:-translate-y-1",
      dark ? "border-white/[0.08] bg-[#111111] text-white" : "border-black/[0.06] bg-white text-[#111111]",
      className
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className={cn("text-[14px] font-semibold", dark ? "text-white/42" : "text-black/38")}>{eyebrow}</p>
        <p className="mt-3 text-[28px] font-semibold tracking-[-0.06em]">{value}</p>
      </div>
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-full", dark ? "bg-white text-[#111111]" : "bg-[#F4F4F2] text-[#111111]")}>
        <ArrowRight size={16} />
      </span>
    </div>
    <div className="mt-4 flex items-center gap-2">
      {transaction && <Avatar transaction={transaction} size="xs" />}
      <p className={cn("truncate text-[14px] font-semibold", dark ? "text-white/80" : "text-black/60")}>{label}</p>
    </div>
  </article>
);

const DistributionStrip = ({ transactions, total }: { transactions: AdminTransaction[]; total: number }) => (
  <div className="mt-9 overflow-hidden rounded-full bg-white p-1 shadow-[0_18px_50px_rgba(0,0,0,0.055)]">
    {transactions.length === 0 ? (
      <div className="flex h-12 items-center justify-center rounded-full bg-[#F5F5F3] text-[13px] font-semibold text-black/38">
        Sem transações para distribuir
      </div>
    ) : (
      <div className="flex min-h-12 gap-1">
        {transactions.map((transaction, index) => {
          const pct = total > 0 ? Math.max((transaction.amount / total) * 100, 16) : 25;
          return (
            <div
              key={transaction.id}
              className={cn(
                "flex min-w-[120px] items-center justify-between gap-3 rounded-full px-4 text-[13px] font-semibold",
                index % 2 === 0 ? "bg-[#F5F5F3] text-[#111111]" : "bg-white text-[#111111] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"
              )}
              style={{ width: `${pct}%` }}
            >
              <span className="truncate">{formatBRL(transaction.amount)}</span>
              <span className="text-black/35">{Math.round(total > 0 ? (transaction.amount / total) * 100 : 0)}%</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const EditorialCard = ({
  id,
  title,
  action,
  className,
  children,
}: {
  id?: string;
  title: string;
  action: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <section
    id={id}
    className={cn(
      "rounded-[34px] border border-black/[0.05] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.04)] transition duration-300 hover:-translate-y-0.5 md:p-6",
      className
    )}
  >
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-[#111111] shadow-[0_8px_22px_rgba(0,0,0,0.04)]">
          <BarChart3 size={18} />
        </span>
        <h2 className="text-[20px] font-semibold tracking-[-0.05em]">{title}</h2>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-4 py-2 text-[13px] font-semibold text-black/58">
        {action}
        <Filter size={14} />
      </span>
    </div>
    {children}
  </section>
);

const MicroMetric = ({ label, value, positive = false }: { label: string; value: string; positive?: boolean }) => (
  <div className="rounded-[22px] bg-white px-4 py-4 shadow-[0_12px_30px_rgba(0,0,0,0.035)]">
    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/32">{label}</p>
    <p className={cn("mt-2 text-[28px] font-semibold tracking-[-0.06em]", positive ? "text-emerald-600" : "text-[#111111]")}>{value}</p>
  </div>
);

const DealRow = ({ transaction }: { transaction: AdminTransaction }) => (
  <>
    <div className="flex min-w-0 items-center gap-2 py-2">
      <Avatar transaction={transaction} size="xs" />
      <span className="truncate font-semibold text-[#111111]">{transaction.user_name || transaction.email || "Usuário"}</span>
    </div>
    <p className="py-2 text-right text-[15px] font-semibold tracking-[-0.03em] text-[#111111]">{formatBRL(transaction.amount)}</p>
    <p className="py-2 text-right">
      <span className="rounded-full bg-[#F4F4F2] px-3 py-1 text-[12px] font-bold text-black/55">{formatPlan(transaction.plan)}</span>
    </p>
  </>
);

const EmptyState = ({ message }: { message: string }) => (
  <div className="flex min-h-[140px] items-center justify-center rounded-[22px] border border-dashed border-black/[0.08] bg-[#FAFAFA] px-5 text-center text-[13px] text-black/40">
    {message}
  </div>
);

const OperationRow = ({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string; detail: string }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F7F7F5] p-4">
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#111111]">
        <Icon size={17} />
      </span>
      <div>
        <p className="text-[14px] font-semibold text-[#111111]">{label}</p>
        <p className="mt-0.5 text-[12px] text-black/40">{detail}</p>
      </div>
    </div>
    <span className="text-[22px] font-semibold tracking-[-0.04em] text-[#111111]">{value}</span>
  </div>
);

const CompactSubscriptionRow = ({ transaction }: { transaction: AdminTransaction }) => (
  <div className="rounded-2xl bg-[#F7F7F5] p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[#111111]">{transaction.user_name || transaction.email || "Usuário"}</p>
        <p className="mt-0.5 text-[12px] text-black/40">{formatPlan(transaction.plan)} · {formatDate(transaction.created_at)}</p>
      </div>
      <span className="text-[14px] font-semibold text-emerald-600">{formatBRL(transaction.amount)}</span>
    </div>
  </div>
);

const Avatar = ({ transaction, size = "md" }: { transaction: AdminTransaction; size?: "xs" | "sm" | "md" }) => (
  <div
    className={cn(
      "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#111111] font-bold text-white",
      size === "xs" && "h-7 w-7 text-[10px]",
      size === "sm" && "h-8 w-8 text-[10px]",
      size === "md" && "h-10 w-10 text-[12px]"
    )}
  >
    {transaction.avatar_url ? (
      <img src={transaction.avatar_url} alt={transaction.user_name ?? "Usuário"} className="h-full w-full object-cover" />
    ) : (
      getInitials(transaction.user_name, transaction.email)
    )}
  </div>
);

const TransactionRow = ({ transaction, index }: { transaction: AdminTransaction; index: number }) => (
  <tr className={cn("text-[13px] text-black/60", index % 2 === 0 ? "bg-white" : "bg-[#FCFCFB]")}>
    <td className="px-5 py-4">
      <div className="flex items-center gap-3">
        <Avatar transaction={transaction} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#111111]">{transaction.user_name || transaction.email || "Usuário"}</p>
          <p className="mt-0.5 truncate text-[11px] text-black/35">{transaction.email || transaction.user_id}</p>
        </div>
      </div>
    </td>
    <td className="px-5 py-4 font-semibold text-black/65">{formatPlan(transaction.plan)}</td>
    <td className="px-5 py-4">{formatDate(transaction.created_at)}</td>
    <td className="px-5 py-4">{formatTime(transaction.created_at)}</td>
    <td className="px-5 py-4">
      <span className="rounded-full bg-[#F7F7F5] px-3 py-1 text-[11px] font-semibold text-black/45">
        {truncatePaymentId(transaction.mp_payment_id, transaction.id)}
      </span>
    </td>
    <td className="px-5 py-4">
      <span className={cn("rounded-full border px-3 py-1 text-[11px] font-bold", getStatusStyle(transaction.status))}>
        {formatStatus(transaction.status)}
      </span>
    </td>
    <td className="px-5 py-4 text-right text-[15px] font-bold text-emerald-600">
      {formatBRL(transaction.amount)}
    </td>
  </tr>
);

export default AdminDashboardPage;
