import { useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CircleDollarSign,
  CreditCard,
  Loader2,
  Lock,
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
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  }
  if (["pending", "waiting", "in_process"].includes(normalized)) {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  }
  if (["cancelled", "canceled", "refunded"].includes(normalized)) {
    return "bg-red-50 text-red-700 ring-1 ring-red-100";
  }
  return "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200";
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

  const metrics = dashboard.metrics ?? emptyPayload.metrics;
  const maxMonthlyRevenue = useMemo(
    () => Math.max(...dashboard.monthlyRevenue.map((month) => month.value), 1),
    [dashboard.monthlyRevenue]
  );

  if (loading || loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F6F6]">
        <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F6F6] p-6">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white">
            <Lock size={20} strokeWidth={1.75} />
          </div>
          <h1 className="mt-5 text-[22px] font-semibold text-neutral-900">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-neutral-500">
            Este dashboard é exclusivo para usuários com role admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell active="dashboard" userId={user.id}>
      {/* Header */}
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[40px] font-bold leading-[1.05] tracking-[-0.02em] text-neutral-900 md:text-[52px]">
            Dashboard
          </h1>
          <p className="mt-3 text-[14px] text-neutral-500">Visão operacional da Velo</p>
        </div>

        <div className="flex h-11 items-center gap-1 rounded-full bg-white p-1 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04]">
          {["Visão Geral", "Histórico", "Analytics"].map((tab, index) => (
            <button
              key={tab}
              type="button"
              className={cn(
                "h-9 rounded-full px-5 text-[12.5px] font-medium transition-all duration-200",
                index === 0
                  ? "bg-neutral-900 text-white shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {isError ? (
        <div className="mt-8 rounded-[28px] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04]">
          <p className="text-[17px] font-semibold text-neutral-900">Não foi possível carregar o dashboard.</p>
          <p className="mt-2 text-[13.5px] text-neutral-500">
            Verifique as permissões de leitura das tabelas profiles, subscriptions e orders.
          </p>
        </div>
      ) : loadingDashboard ? (
        <div className="mt-16 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          {/* Metrics */}
          <section id="receita" className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={Users}
              label="Total de usuários"
              value={String(metrics.total_users)}
              hint="Cadastrados na plataforma"
              growth={metrics.growth_rate}
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
          </section>

          {/* Revenue + chart */}
          <section className="mt-5 grid gap-5 rounded-[28px] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04] md:p-9 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-[13.5px] font-medium text-neutral-500">Faturamento bruto total</p>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold",
                    metrics.growth_rate >= 0
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                      : "bg-red-50 text-red-700 ring-1 ring-red-100"
                  )}
                >
                  {metrics.growth_rate >= 0 ? "↑" : "↓"} {Math.abs(metrics.growth_rate).toFixed(0)}% este mês
                </span>
              </div>
              <p className="mt-6 break-words text-[48px] font-bold leading-[1.02] tracking-[-0.04em] text-neutral-900 md:text-[68px] xl:text-[80px]">
                {formatBRL(metrics.gross_revenue)}
              </p>
              <div id="planos" className="mt-7 flex flex-wrap gap-3">
                <OverviewPill icon={CircleDollarSign} label="Receita ativa" value={formatBRL(metrics.mrr)} />
                <OverviewPill icon={CreditCard} label="Pagantes" value={String(metrics.paid_users)} />
                <OverviewPill icon={Users} label="Base total" value={String(metrics.total_users)} />
              </div>
            </div>

            <div className="rounded-[22px] bg-[#FAFAFA] p-6 ring-1 ring-black/[0.04]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-semibold text-neutral-900">Evolução mensal</p>
                  <p className="mt-1 text-[11.5px] text-neutral-500">Últimos 6 meses</p>
                </div>
                <BarChart3 size={18} className="text-neutral-400" strokeWidth={1.75} />
              </div>
              <div className="mt-6 flex h-[160px] items-end gap-3">
                {dashboard.monthlyRevenue.map((month) => (
                  <div key={month.key} className="flex flex-1 flex-col items-center gap-3">
                    <div className="flex h-[120px] w-full items-end rounded-full bg-neutral-100 px-1.5">
                      <div
                        className="w-full rounded-full bg-neutral-900 transition-all duration-300"
                        style={{ height: `${Math.max((month.value / maxMonthlyRevenue) * 100, month.value > 0 ? 8 : 0)}%` }}
                        title={formatBRL(month.value)}
                      />
                    </div>
                    <span className="text-[10.5px] font-medium capitalize text-neutral-500">{month.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Transactions */}
          <section className="mt-5 overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04]">
            <div className="flex items-center justify-between px-7 py-6">
              <div>
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-neutral-900">Últimas transações</h2>
                <p className="mt-1 text-[12.5px] text-neutral-500">Assinaturas e pagamentos mais recentes.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-y border-neutral-100 bg-neutral-50/60 text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                    <th className="px-7 py-3.5">Usuário</th>
                    <th className="px-5 py-3.5">Plano</th>
                    <th className="px-5 py-3.5">Data</th>
                    <th className="px-5 py-3.5">Horário</th>
                    <th className="px-5 py-3.5">ID do pagamento</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-7 py-3.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-16 text-center text-[14px] text-neutral-400">
                        Nenhuma transação encontrada.
                      </td>
                    </tr>
                  ) : (
                    dashboard.transactions.map((transaction) => (
                      <TransactionRow key={transaction.id} transaction={transaction} />
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
  growth,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint: string;
  positive?: boolean;
  growth?: number;
}) => (
  <div className="rounded-[28px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ring-1 ring-black/[0.04] transition-shadow duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
    <div className="flex items-start justify-between">
      <span className="text-[12.5px] font-medium text-neutral-500">{label}</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-100 text-neutral-700">
        <Icon size={15} strokeWidth={1.75} />
      </span>
    </div>
    <div className="mt-6 flex items-baseline gap-2.5">
      <p className={cn("text-[38px] font-bold leading-none tracking-[-0.03em]", positive ? "text-emerald-600" : "text-neutral-900")}>
        {value}
      </p>
      {typeof growth === "number" && (
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
          ↑ {Math.abs(growth).toFixed(0)}%
        </span>
      )}
    </div>
    <p className="mt-3 text-[12px] text-neutral-500">{hint}</p>
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
  <div className="inline-flex items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-black/[0.05]">
    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-neutral-900 text-white">
      <Icon size={14} strokeWidth={1.75} />
    </span>
    <span>
      <span className="block text-[10.5px] font-medium uppercase tracking-wider text-neutral-400">{label}</span>
      <span className="block text-[13px] font-semibold text-neutral-900">{value}</span>
    </span>
  </div>
);

const TransactionRow = ({ transaction }: { transaction: AdminTransaction }) => (
  <tr className="border-b border-neutral-100 text-[13px] text-neutral-700 transition hover:bg-neutral-50/60 last:border-0">
    <td className="px-7 py-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">
          {transaction.avatar_url ? (
            <img src={transaction.avatar_url} alt={transaction.user_name ?? "Usuário"} className="h-full w-full object-cover" />
          ) : (
            getInitials(transaction.user_name, transaction.email)
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-neutral-900">{transaction.user_name || transaction.email || "Usuário"}</p>
          <p className="mt-0.5 truncate text-[11.5px] text-neutral-400">{transaction.email || transaction.user_id}</p>
        </div>
      </div>
    </td>
    <td className="px-5 py-5 font-medium text-neutral-700">{formatPlan(transaction.plan)}</td>
    <td className="px-5 py-5 text-neutral-600">{formatDate(transaction.created_at)}</td>
    <td className="px-5 py-5 text-neutral-600">{formatTime(transaction.created_at)}</td>
    <td className="px-5 py-5">
      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-600">
        {truncatePaymentId(transaction.mp_payment_id, transaction.id)}
      </span>
    </td>
    <td className="px-5 py-5">
      <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold", getStatusStyle(transaction.status))}>
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current opacity-70" />
        {formatStatus(transaction.status)}
      </span>
    </td>
    <td className="px-7 py-5 text-right text-[14px] font-semibold text-neutral-900">
      {formatBRL(transaction.amount)}
    </td>
  </tr>
);

export default AdminDashboardPage;
