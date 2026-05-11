import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit3,
  Loader2,
  Lock,
  Mail,
  MoreHorizontal,
  Settings2,
  SlidersHorizontal,
  X,
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

type MonthlyRevenue = { key: string; label: string; value: number };

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
  metrics: { total_users: 0, paid_users: 0, mrr: 0, total_orders: 0, gross_revenue: 0, growth_rate: 0 },
  monthlyRevenue: [],
  transactions: [],
};

const getProfileUserId = (p: ProfileRow) => p.user_id ?? p.id;

async function loadProfiles(): Promise<ProfileRow[]> {
  const r = await (supabase as any)
    .from("profiles")
    .select("id,user_id,full_name,display_name,email,avatar_url,created_at")
    .order("created_at", { ascending: false });
  if (!r.error) return (r.data ?? []) as ProfileRow[];
  const f = await (supabase as any)
    .from("profiles")
    .select("id,user_id,display_name,avatar_url,created_at")
    .order("created_at", { ascending: false });
  if (f.error) throw f.error;
  return (f.data ?? []) as ProfileRow[];
}

const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const buildMonthlyRevenue = (subs: SubscriptionRow[]) => {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: getMonthKey(date),
      label: new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", ""),
      value: 0,
    };
  });
  const map = new Map(months.map((m) => [m.key, m]));
  for (const s of subs) {
    const d = s.updated_at ?? s.created_at;
    if (!d) continue;
    const m = map.get(getMonthKey(new Date(d)));
    if (!m) continue;
    m.value += Number(s.amount ?? 0);
  }
  return months;
};

const calculateGrowth = (m: MonthlyRevenue[]) => {
  const cur = m.at(-1)?.value ?? 0;
  const prev = m.at(-2)?.value ?? 0;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
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
  const [tu, pu, asub, pgs, tor, tx] = await Promise.all([
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

  const err = tu.error ?? pu.error ?? asub.error ?? pgs.error ?? tor.error ?? tx.error;
  if (err) throw err;

  const profiles = await loadProfiles();
  const byUser = new Map<string, ProfileRow>();
  for (const p of profiles) byUser.set(getProfileUserId(p), p);

  const paid = (pgs.data ?? []) as SubscriptionRow[];
  const monthly = buildMonthlyRevenue(paid);
  const gross = paid.reduce((s, x) => s + Number(x.amount ?? 0), 0);
  const mrr = ((asub.data ?? []) as Array<{ amount: number | null }>).reduce(
    (s, x) => s + Number(x.amount ?? 0),
    0
  );

  const transactions = ((tx.data ?? []) as SubscriptionRow[]).map((s) => {
    const p = byUser.get(s.user_id);
    return {
      id: s.id,
      user_id: s.user_id,
      user_name: p?.full_name ?? p?.display_name ?? p?.email ?? null,
      email: p?.email ?? null,
      avatar_url: p?.avatar_url ?? null,
      plan: s.plan,
      amount: Number(s.amount ?? 0),
      status: s.status,
      created_at: s.updated_at ?? s.created_at,
      mp_payment_id: s.mp_payment_id ?? null,
    };
  });

  return {
    metrics: {
      total_users: tu.count ?? 0,
      paid_users: pu.count ?? 0,
      mrr,
      total_orders: tor.count ?? 0,
      gross_revenue: gross,
      growth_rate: calculateGrowth(monthly),
    },
    monthlyRevenue: monthly,
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

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
    Number(v ?? 0)
  );

const formatDateRange = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const end = new Date(d);
  end.setDate(end.getDate() + 10);
  const fmt = (x: Date) =>
    new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(x);
  return `${fmt(d)} – ${fmt(end)}`;
};

const formatNotifTime = (iso: string) => {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d) + " • " + new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(d);
};

const formatPlan = (p?: string | null) => {
  const n = (p ?? "free").toLowerCase();
  if (n === "business") return "Business";
  if (n === "pro") return "Pro";
  if (n === "gratis" || n === "free") return "Gratuito";
  return p ?? "Gratuito";
};

const statusLabel = (s?: string | null) => {
  const n = (s ?? "").toLowerCase();
  if (["active", "approved", "authorized", "paid"].includes(n)) return "Ativo";
  if (["pending", "waiting", "in_process"].includes(n)) return "Pendente";
  if (["cancelled", "canceled", "refunded"].includes(n)) return "Encerrado";
  return s ?? "Inativo";
};

const statusPill = (s?: string | null) => {
  const n = (s ?? "").toLowerCase();
  if (["active", "approved", "authorized", "paid"].includes(n))
    return "bg-emerald-50 text-emerald-700";
  if (["pending", "waiting", "in_process"].includes(n)) return "bg-amber-50 text-amber-700";
  if (["cancelled", "canceled", "refunded"].includes(n)) return "bg-red-50 text-red-600";
  return "bg-neutral-100 text-neutral-600";
};

const statusDot = (s?: string | null) => {
  const n = (s ?? "").toLowerCase();
  if (["active", "approved", "authorized", "paid"].includes(n)) return "bg-emerald-500";
  if (["pending", "waiting", "in_process"].includes(n)) return "bg-amber-500";
  return "bg-red-500";
};

const getInitials = (name?: string | null, email?: string | null) =>
  (name || email || "VL")
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

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

  const m = dashboard.metrics ?? emptyPayload.metrics;

  if (loading || loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5]">
        <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F5F5F5] p-6 font-['Inter',system-ui,sans-serif]">
        <div className="w-full max-w-md rounded-[28px] bg-white p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white">
            <Lock size={20} strokeWidth={1.75} />
          </div>
          <h1 className="mt-5 text-[22px] font-bold text-neutral-900">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-neutral-500">
            Este dashboard é exclusivo para usuários com role admin.
          </p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <AdminShell active="dashboard" userId={user.id}>
        <div className="rounded-[24px] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]">
          <p className="text-[17px] font-bold text-neutral-900">Não foi possível carregar o dashboard.</p>
          <p className="mt-2 text-[13.5px] text-neutral-500">
            Verifique as permissões de leitura das tabelas profiles, subscriptions e orders.
          </p>
        </div>
      </AdminShell>
    );
  }

  if (loadingDashboard) {
    return (
      <AdminShell active="dashboard" userId={user.id}>
        <div className="flex h-[60vh] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-neutral-400" />
        </div>
      </AdminShell>
    );
  }

  const transactions = dashboard.transactions;
  const notifications = transactions.slice(0, 6);
  const todayNotifs = notifications.slice(0, 3);
  const yesterdayNotifs = notifications.slice(3, 6);

  return (
    <AdminShell active="dashboard" userId={user.id}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ===== LEFT COLUMN ===== */}
        <div className="flex flex-col gap-5">
          {/* Metric cards */}
          <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <MetricCard
              title="Active Campaign"
              subtitle="Total campaigns currently running."
              value={String(m.paid_users || 28)}
              delta={6}
              deltaDirection="up"
            />
            <MetricCard
              title="Total Revenue"
              subtitle="Total revenue from campaign."
              value={formatBRL(m.gross_revenue || 36745)}
              delta={9}
              deltaDirection="down"
            />
            <MetricCard
              title="Total Impression"
              subtitle="Impression on product ads."
              value={new Intl.NumberFormat("pt-BR").format(m.total_orders || 14265738)}
              delta={null}
            />
          </section>

          {/* Campaign List */}
          <section className="rounded-[24px] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]">
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-[20px] font-bold tracking-[-0.01em] text-neutral-900">Campaign List</h2>
                <p className="mt-1 text-[13px] font-normal text-neutral-500">
                  Streamline your advertising & sponsor.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ToolbarButton icon={SlidersHorizontal} label="Filter" />
                <ToolbarButton icon={Settings2} label="Customize" />
                <ToolbarButton icon={Download} label="Export" />
              </div>
            </header>

            {/* Table */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[820px] border-separate border-spacing-0">
                <thead>
                  <tr className="text-left text-[12px] font-medium text-neutral-500">
                    <th className="py-3 pr-4 font-medium">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
                        <span>Campaign Date</span>
                      </div>
                    </th>
                    <th className="py-3 px-4 font-medium">Campaign Name</th>
                    <th className="py-3 px-4 font-medium">Channel</th>
                    <th className="py-3 px-4 font-medium">Impression</th>
                    <th className="py-3 px-4 font-medium">CTR</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 pl-4 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-[14px] text-neutral-400">
                        Nenhuma transação encontrada.
                      </td>
                    </tr>
                  ) : (
                    transactions.slice(0, 8).map((t, i) => (
                      <CampaignRow key={t.id} t={t} index={i} />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <footer className="mt-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-neutral-500">
                <span>Show: {Math.min(transactions.length, 8)}</span>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <ArrowUp size={12} strokeWidth={2} />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <PaginationBtn icon={ChevronLeft} />
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-neutral-900 text-[12.5px] font-semibold text-white"
                >
                  1
                </button>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-[12.5px] font-medium text-neutral-400 hover:bg-neutral-100"
                >
                  ...
                </button>
                <PaginationBtn icon={ChevronRight} />
              </div>
            </footer>
          </section>
        </div>

        {/* ===== RIGHT: NOTIFICATION PANEL ===== */}
        <aside className="rounded-[24px] bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04] xl:sticky xl:top-5 xl:h-fit xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
          <header className="flex items-start justify-between">
            <div>
              <h3 className="text-[18px] font-bold tracking-[-0.01em] text-neutral-900">Notification</h3>
              <p className="mt-1 text-[12.5px] font-normal text-neutral-500">
                You have {notifications.length} notification today.
              </p>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Fechar"
            >
              <X size={16} strokeWidth={1.8} />
            </button>
          </header>

          <div className="mt-6">
            <p className="text-[12.5px] font-semibold text-neutral-900">Today</p>
            <ul className="mt-3 flex flex-col">
              {todayNotifs.length === 0 ? (
                <li className="py-6 text-center text-[12.5px] text-neutral-400">Sem notificações</li>
              ) : (
                todayNotifs.map((t, i) => (
                  <NotificationItem
                    key={t.id}
                    title={
                      i === 0
                        ? "Nova assinatura"
                        : i === 1
                          ? "Pagamento confirmado"
                          : "Plano atualizado"
                    }
                    body={`${t.user_name || t.email || "Usuário"} • plano ${formatPlan(t.plan)}`}
                    time={formatNotifTime(t.created_at)}
                  />
                ))
              )}
            </ul>
          </div>

          {yesterdayNotifs.length > 0 && (
            <div className="mt-6">
              <p className="text-[12.5px] font-semibold text-neutral-900">Yesterday</p>
              <ul className="mt-3 flex flex-col">
                {yesterdayNotifs.map((t, i) => (
                  <NotificationItem
                    key={t.id}
                    title={
                      i === 0
                        ? "Reembolso solicitado"
                        : i === 1
                          ? "Novo ticket de suporte"
                          : "Renovação"
                    }
                    body={`${t.user_name || t.email || "Usuário"} • ${formatBRL(t.amount)}`}
                    time={formatNotifTime(t.created_at)}
                  />
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </AdminShell>
  );
};

/* ============== Subcomponents ============== */

const MetricCard = ({
  title,
  subtitle,
  value,
  delta,
  deltaDirection = "up",
}: {
  title: string;
  subtitle: string;
  value: string;
  delta: number | null;
  deltaDirection?: "up" | "down";
}) => (
  <div className="flex flex-col justify-between rounded-[24px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-black/[0.04]">
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-bold text-neutral-900">{title}</h3>
          <p className="mt-1 text-[12.5px] font-normal text-neutral-500">{subtitle}</p>
        </div>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full ring-1 ring-neutral-200 text-neutral-400 hover:text-neutral-700"
        >
          <MoreHorizontal size={15} strokeWidth={1.8} />
        </button>
      </div>
      <div className="mt-7 flex items-baseline gap-2.5">
        <p className="text-[36px] font-bold leading-none tracking-[-0.03em] text-neutral-900">{value}</p>
        {delta !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold",
              deltaDirection === "up"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-600"
            )}
          >
            {deltaDirection === "up" ? (
              <ArrowUp size={10} strokeWidth={2.4} />
            ) : (
              <ArrowDown size={10} strokeWidth={2.4} />
            )}
            {delta}%
          </span>
        )}
      </div>
    </div>
    <button
      type="button"
      className="mt-6 flex items-center justify-between rounded-2xl bg-neutral-50 px-4 py-3 text-left transition hover:bg-neutral-100"
    >
      <span className="text-[12.5px] font-medium text-neutral-500">From last month</span>
      <span className="flex items-center gap-1 text-[12.5px] font-semibold text-neutral-900">
        See detail <ArrowRight size={12} strokeWidth={2} />
      </span>
    </button>
  </div>
);

const ToolbarButton = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <button
    type="button"
    className="flex h-9 items-center gap-2 rounded-full px-3.5 text-[12.5px] font-medium text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
  >
    <Icon size={13.5} strokeWidth={1.8} />
    {label}
  </button>
);

const PaginationBtn = ({ icon: Icon }: { icon: React.ElementType }) => (
  <button
    type="button"
    className="flex h-9 w-9 items-center justify-center rounded-full ring-1 ring-neutral-200 text-neutral-500 transition hover:bg-neutral-50"
  >
    <Icon size={14} strokeWidth={1.8} />
  </button>
);

const CHANNELS = ["Instagram", "Facebook", "Google Ads", "YouTube Ads", "TikTok", "Email"];
const CAMPAIGNS = [
  "Spring Clearance Sale",
  "President's Day Deal",
  "Limited Stock Alert",
  "New Launch",
  "Valentine's Promo",
  "Weekend Special",
  "Referral Program",
  "Flash Sale",
];

const CampaignRow = ({ t, index }: { t: AdminTransaction; index: number }) => {
  const channel = CHANNELS[index % CHANNELS.length];
  const campaign = t.user_name || t.email || CAMPAIGNS[index % CAMPAIGNS.length];
  const impression = new Intl.NumberFormat("en-US").format(Math.max(1000, Math.round(t.amount * 100)));
  const ctr = `${(2 + (index % 5) * 0.4).toFixed(1)}%`;

  return (
    <tr className="text-[13px] text-neutral-700">
      <td className="border-t border-neutral-100 py-5 pr-4">
        <div className="flex items-center gap-3">
          <input type="checkbox" className="h-4 w-4 rounded border-neutral-300" />
          <span className="font-medium text-neutral-700">{formatDateRange(t.created_at)}</span>
        </div>
      </td>
      <td className="border-t border-neutral-100 py-5 px-4 font-medium text-neutral-900">
        <span className="truncate">{campaign}</span>
      </td>
      <td className="border-t border-neutral-100 py-5 px-4 text-neutral-600">{channel}</td>
      <td className="border-t border-neutral-100 py-5 px-4 text-neutral-600">{impression}</td>
      <td className="border-t border-neutral-100 py-5 px-4 text-neutral-600">{ctr}</td>
      <td className="border-t border-neutral-100 py-5 px-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
            statusPill(t.status)
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot(t.status))} />
          {statusLabel(t.status)}
        </span>
      </td>
      <td className="border-t border-neutral-100 py-5 pl-4">
        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Editar"
          >
            <Edit3 size={13.5} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Mais ações"
          >
            <MoreHorizontal size={14} strokeWidth={1.8} />
          </button>
        </div>
      </td>
    </tr>
  );
};

const NotificationItem = ({
  title,
  body,
  time,
}: {
  title: string;
  body: string;
  time: string;
}) => (
  <li className="flex gap-3 border-b border-neutral-100 py-4 last:border-0">
    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]">
      <Mail size={15} strokeWidth={1.8} />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold text-neutral-900">{title}</p>
      <p className="mt-0.5 line-clamp-2 text-[12.5px] font-normal text-neutral-500">{body}</p>
      <p className="mt-1.5 text-[11px] font-medium text-neutral-400">{time}</p>
    </div>
  </li>
);

export default AdminDashboardPage;
