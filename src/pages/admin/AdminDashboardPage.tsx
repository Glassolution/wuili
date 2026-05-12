import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  CircleDollarSign,
  CreditCard,
  LifeBuoy,
  Loader2,
  Lock,
  ReceiptText,
  RefreshCcw,
  TrendingUp,
  UserCheck,
  Users,
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
      <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-black/35">Painel administrativo</p>
          <h1 className="mt-3 font-sans text-[48px] font-semibold tracking-[-0.06em] text-[#111111] md:text-[64px]">
            Admin
          </h1>
          <p className="mt-3 text-[15px] text-black/50">Visão operacional da Velo</p>
        </div>

        <div className="flex rounded-full border border-black/[0.06] bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          {["Visão Geral", "Histórico", "Analytics"].map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "h-10 rounded-full px-5 text-[13px] font-semibold transition md:px-7",
                index === 0 ? "bg-[#111111] text-white" : "text-black/45 hover:bg-[#F4F4F2] hover:text-[#111111]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

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
        <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              icon={Users}
              label="Total de usuários"
              value={String(metrics.total_users)}
              hint="Cadastrados na plataforma"
            />
            <MetricCard
              icon={UserCheck}
              label="Planos pagos"
              value={String(metrics.paid_users)}
              hint="Assinaturas ativas"
            />
            <MetricCard
              icon={TrendingUp}
              label="MRR"
              value={formatBRL(metrics.mrr)}
              hint="Receita mensal recorrente"
              positive
            />
            <MetricCard
              icon={BarChart3}
              label="Pedidos"
              value={String(metrics.total_orders)}
              hint="Pedidos registrados"
            />
            <MetricCard
              icon={CircleDollarSign}
              label="Faturamento bruto"
              value={formatBRL(metrics.gross_revenue)}
              hint="Total confirmado"
              positive
            />
          </section>

          <section id="receita" className="mt-5 rounded-[32px] border border-black/[0.05] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] md:p-7">
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-stretch">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[15px] font-semibold text-black/55">Revenue</p>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-bold text-emerald-700">
                    {hasGrowthComparison ? `${metrics.growth_rate >= 0 ? "+" : ""}${metrics.growth_rate.toFixed(0)}%` : "Sem comparação disponível"}
                  </span>
                </div>
                <p className="mt-7 break-words font-sans text-[58px] font-semibold tracking-[-0.07em] text-[#111111] md:text-[86px] xl:text-[104px]">
                  {formatBRL(metrics.gross_revenue)}
                </p>
                <p className="mt-2 text-[14px] text-black/42">
                  {hasGrowthComparison ? `vs período anterior ${formatBRL(previousRevenue)}` : "Sem histórico suficiente para comparar crescimento."}
                </p>

                <div id="planos" className="mt-8 flex flex-wrap gap-3">
                  <OverviewPill icon={CircleDollarSign} label="Receita ativa" value={formatBRL(metrics.mrr)} />
                  <OverviewPill icon={CreditCard} label="Pagantes" value={String(metrics.paid_users)} />
                  <OverviewPill icon={Users} label="Base total" value={String(metrics.total_users)} />
                </div>
              </div>

              <div className="rounded-[28px] border border-black/[0.05] bg-[#F7F7F5] p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-bold text-[#111111]">Performance mensal</p>
                    <p className="mt-1 text-[12px] text-black/38">Últimos 6 meses</p>
                  </div>
                  <BarChart3 size={19} className="text-black/35" />
                </div>
                <div className="mt-7 flex h-[180px] items-end gap-3">
                  {monthlyRevenue.map((month) => (
                    <div key={month.key} className="flex flex-1 flex-col items-center gap-3">
                      <div className="flex h-[136px] w-full items-end rounded-full bg-white px-1.5">
                        <div
                          className="w-full rounded-full bg-[#111111] transition-all"
                          style={{ height: `${Math.max((month.value / maxMonthlyRevenue) * 100, month.value > 0 ? 8 : 0)}%` }}
                          title={formatBRL(month.value)}
                        />
                      </div>
                      <span className="text-[11px] font-semibold capitalize text-black/45">{month.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
            <div className="grid gap-5 lg:grid-cols-2">
              <PanelCard title="Receita por plano" subtitle="Baseada nas transações reais">
                {planRevenue.length === 0 ? (
                  <EmptyState message="Nenhuma receita por plano ainda." />
                ) : (
                  <div className="space-y-3">
                    {planRevenue.map((plan) => {
                      const pct = metrics.gross_revenue > 0 ? Math.round((plan.amount / metrics.gross_revenue) * 100) : 0;
                      return (
                        <div key={plan.plan} className="rounded-2xl bg-[#F7F7F5] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[14px] font-semibold text-[#111111]">{plan.plan}</span>
                            <span className="text-[14px] font-semibold text-[#111111]">{formatBRL(plan.amount)}</span>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                            <div className="h-full rounded-full bg-[#111111]" style={{ width: `${Math.max(pct, plan.amount > 0 ? 4 : 0)}%` }} />
                          </div>
                          <p className="mt-2 text-[12px] text-black/42">{plan.count} assinatura(s) · {pct}% do total</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </PanelCard>

              <PanelCard title="Operação" subtitle="Reembolsos, suporte e pedidos">
                <div className="grid gap-3">
                  <OperationRow icon={ReceiptText} label="Pedidos" value={String(metrics.total_orders)} detail="Pedidos registrados" />
                  <OperationRow icon={RefreshCcw} label="Reembolsos pendentes" value={String(operationalCounts?.refunds ?? 0)} detail="Solicitações em aberto" />
                  <OperationRow icon={LifeBuoy} label="Tickets de suporte" value={String(operationalCounts?.tickets ?? 0)} detail="Conversas abertas" />
                </div>
              </PanelCard>
            </div>

            <PanelCard title="Usuários recentes" subtitle="Últimos clientes em transações">
              {recentUsers.length === 0 ? (
                <EmptyState message="Nenhum usuário recente encontrado." />
              ) : (
                <div className="space-y-3">
                  {recentUsers.map((transaction) => (
                    <CompactUserRow key={transaction.user_id} transaction={transaction} />
                  ))}
                </div>
              )}
            </PanelCard>
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
            <section className="overflow-hidden rounded-[28px] border border-black/[0.05] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between border-b border-black/[0.05] px-5 py-5">
                <div>
                  <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[#111111]">Histórico</h2>
                  <p className="mt-1 text-[12px] text-black/40">Assinaturas e pagamentos mais recentes.</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="bg-[#F7F7F5] text-left text-[12px] font-semibold text-black/45">
                      <th className="px-5 py-4">Usuário</th>
                      <th className="px-5 py-4">Plano</th>
                      <th className="px-5 py-4">Data</th>
                      <th className="px-5 py-4">Horário</th>
                      <th className="px-5 py-4">ID do pagamento</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-5 py-14 text-center text-[14px] text-black/42">
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

            <PanelCard title="Assinaturas ativas" subtitle="Planos em estado ativo">
              {activeSubscriptions.length === 0 ? (
                <EmptyState message="Nenhuma assinatura ativa encontrada." />
              ) : (
                <div className="space-y-3">
                  {activeSubscriptions.map((transaction) => (
                    <CompactSubscriptionRow key={transaction.id} transaction={transaction} />
                  ))}
                </div>
              )}
            </PanelCard>
          </section>
        </>
      )}
    </AdminShell>
  );
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  hint,
  positive = false,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  positive?: boolean;
}) => (
  <div className="rounded-[28px] border border-black/[0.05] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/35">{label}</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#F7F7F5] text-[#111111]">
        <Icon size={18} />
      </span>
    </div>
    <p className={cn("mt-7 text-[30px] font-semibold tracking-[-0.05em]", positive ? "text-emerald-600" : "text-[#111111]")}>
      {value}
    </p>
    <p className="mt-2 text-[12px] text-black/42">{hint}</p>
  </div>
);

const OverviewPill = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) => (
  <div className="inline-flex items-center gap-3 rounded-2xl border border-black/[0.05] bg-[#F7F7F5] px-4 py-3">
    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#111111]">
      <Icon size={16} />
    </span>
    <span>
      <span className="block text-[11px] font-semibold text-black/38">{label}</span>
      <span className="block text-[13px] font-bold text-[#111111]">{value}</span>
    </span>
  </div>
);

const PanelCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <section className="rounded-[28px] border border-black/[0.05] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
    <div className="mb-5">
      <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-[#111111]">{title}</h2>
      <p className="mt-1 text-[12px] text-black/40">{subtitle}</p>
    </div>
    {children}
  </section>
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

const CompactUserRow = ({ transaction }: { transaction: AdminTransaction }) => (
  <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F7F7F5] p-3">
    <div className="flex min-w-0 items-center gap-3">
      <Avatar transaction={transaction} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-[#111111]">{transaction.user_name || transaction.email || "Usuário"}</p>
        <p className="truncate text-[12px] text-black/40">{transaction.email || transaction.user_id}</p>
      </div>
    </div>
    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-black/55">{formatPlan(transaction.plan)}</span>
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

const Avatar = ({ transaction }: { transaction: AdminTransaction }) => (
  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#111111] text-[12px] font-bold text-white">
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
