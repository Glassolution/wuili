import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  CircleDollarSign,
  CreditCard,
  Eye,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  Lock,
  MoreVertical,
  Search,
  Settings,
  ShieldCheck,
  UserX,
  TrendingUp,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { VeloLogo } from "@/components/VeloLogo";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AdminMetrics = {
  total_users: number;
  paid_users: number;
  mrr: number;
  total_orders: number;
};

type AdminUserRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string | null;
  subscription_status: string | null;
  created_at: string;
  ml_connected: boolean;
  orders_count: number;
};

type AdminTransaction = {
  id: string;
  user_id: string;
  user_name: string | null;
  email: string | null;
  plan: string;
  amount: number;
  status: string;
  created_at: string;
};

type AdminDashboardPayload = {
  metrics: AdminMetrics;
  users: AdminUserRow[];
  transactions: AdminTransaction[];
};

const emptyPayload: AdminDashboardPayload = {
  metrics: {
    total_users: 0,
    paid_users: 0,
    mrr: 0,
    total_orders: 0,
  },
  users: [],
  transactions: [],
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
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type UserPlanFilter = "all" | "free" | "pro" | "business";
type UserSortKey = "id" | "name" | "email" | "created_at" | "plan" | "ml_connected" | "orders_count";
type SortDirection = "asc" | "desc";

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

async function fetchAdminDashboard(): Promise<AdminDashboardPayload> {
  const [totalUsersRes, paidUsersRes, activeSubsRes, totalOrdersRes] = await Promise.all([
    (supabase as any).from("profiles").select("id", { count: "exact", head: true }),
    (supabase as any).from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
    (supabase as any).from("subscriptions").select("amount").eq("status", "active"),
    (supabase as any).from("orders").select("id", { count: "exact", head: true }),
  ]);

  const metricsError = totalUsersRes.error ?? paidUsersRes.error ?? activeSubsRes.error ?? totalOrdersRes.error;
  if (metricsError) throw metricsError;

  const profiles = await loadProfiles();
  const userIds = profiles.map(getProfileUserId).filter(Boolean);

  const [subsRes, integrationsRes, ordersRes, transactionsRes] = await Promise.all([
    userIds.length
      ? (supabase as any)
          .from("subscriptions")
          .select("id,user_id,plan,amount,status,created_at,updated_at")
          .in("user_id", userIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? (supabase as any)
          .from("user_integrations")
          .select("user_id,platform")
          .in("user_id", userIds)
          .eq("platform", "mercadolivre")
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? (supabase as any)
          .from("orders")
          .select("user_id")
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
    (supabase as any)
      .from("subscriptions")
      .select("id,user_id,plan,amount,status,created_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const listError = subsRes.error ?? integrationsRes.error ?? ordersRes.error ?? transactionsRes.error;
  if (listError) throw listError;

  const subscriptions = (subsRes.data ?? []) as SubscriptionRow[];
  const latestSubByUser = new Map<string, SubscriptionRow>();
  for (const subscription of subscriptions) {
    if (!latestSubByUser.has(subscription.user_id)) {
      latestSubByUser.set(subscription.user_id, subscription);
    }
  }

  const mlConnectedUsers = new Set<string>(
    ((integrationsRes.data ?? []) as Array<{ user_id: string | null }>)
      .map((item) => item.user_id)
      .filter(Boolean) as string[]
  );

  const ordersByUser = new Map<string, number>();
  for (const order of (ordersRes.data ?? []) as Array<{ user_id: string | null }>) {
    if (!order.user_id) continue;
    ordersByUser.set(order.user_id, (ordersByUser.get(order.user_id) ?? 0) + 1);
  }

  const profilesByUser = new Map<string, ProfileRow>();
  for (const profile of profiles) {
    profilesByUser.set(getProfileUserId(profile), profile);
  }

  const users: AdminUserRow[] = profiles.map((profile) => {
    const profileUserId = getProfileUserId(profile);
    const subscription = latestSubByUser.get(profileUserId);

    return {
      user_id: profileUserId,
      name: profile.full_name ?? profile.display_name ?? profile.email ?? null,
      email: profile.email ?? null,
      avatar_url: profile.avatar_url ?? null,
      plan: subscription?.plan ?? null,
      subscription_status: subscription?.status ?? null,
      created_at: profile.created_at,
      ml_connected: mlConnectedUsers.has(profileUserId),
      orders_count: ordersByUser.get(profileUserId) ?? 0,
    };
  });

  const transactions: AdminTransaction[] = ((transactionsRes.data ?? []) as SubscriptionRow[]).map((subscription) => {
    const profile = profilesByUser.get(subscription.user_id);

    return {
      id: subscription.id,
      user_id: subscription.user_id,
      user_name: profile?.full_name ?? profile?.display_name ?? profile?.email ?? null,
      email: profile?.email ?? null,
      plan: subscription.plan,
      amount: Number(subscription.amount ?? 0),
      status: subscription.status,
      created_at: subscription.updated_at ?? subscription.created_at,
    };
  });

  const mrr = ((activeSubsRes.data ?? []) as Array<{ amount: number | null }>).reduce(
    (sum, subscription) => sum + Number(subscription.amount ?? 0),
    0
  );

  return {
    metrics: {
      total_users: totalUsersRes.count ?? 0,
      paid_users: paidUsersRes.count ?? 0,
      mrr,
      total_orders: totalOrdersRes.count ?? 0,
    },
    users,
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
    .eq("user_id", userId)
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

const formatPlan = (plan?: string | null) => {
  const normalized = (plan ?? "free").toLowerCase();
  if (normalized === "business") return "Business";
  if (normalized === "pro") return "Pro";
  if (normalized === "gratis" || normalized === "free") return "Gratuito";
  return plan ?? "Gratuito";
};

const getPlanKey = (plan?: string | null): Exclude<UserPlanFilter, "all"> => {
  const normalized = (plan ?? "free").toLowerCase();
  if (normalized === "business") return "business";
  if (normalized === "pro") return "pro";
  return "free";
};

const userPlanTabs: Array<{ key: UserPlanFilter; label: string }> = [
  { key: "all", label: "Todos" },
  { key: "free", label: "Plano Gratuito" },
  { key: "pro", label: "Plano Pro" },
  { key: "business", label: "Plano Business" },
];

const formatStatus = (status?: string | null) => {
  const normalized = (status ?? "inactive").toLowerCase();
  if (["active", "approved", "authorized", "paid"].includes(normalized)) return "Ativo";
  if (["cancelled", "canceled"].includes(normalized)) return "Cancelado";
  if (normalized === "refunded") return "Reembolsado";
  return status ?? "Inativo";
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

const getUserSortValue = (row: AdminUserRow, key: UserSortKey) => {
  if (key === "id") return row.user_id.slice(0, 8);
  if (key === "name") return row.name ?? "";
  if (key === "email") return row.email ?? "";
  if (key === "created_at") return new Date(row.created_at).getTime();
  if (key === "plan") return formatPlan(row.plan);
  if (key === "ml_connected") return row.ml_connected ? 1 : 0;
  if (key === "orders_count") return row.orders_count ?? 0;
  return "";
};

const adminMenu = [
  { label: "Visão Geral", icon: LayoutDashboard, active: true, to: "/admin/dashboard" },
  { label: "Usuários", icon: Users, to: "#usuarios" },
  { label: "Receita", icon: CircleDollarSign, to: "#receita" },
  { label: "Planos", icon: CreditCard, to: "#planos" },
  { label: "Suporte", icon: LifeBuoy, to: "/admin/suporte" },
  { label: "Configurações", icon: Settings, to: "/dashboard/configuracoes" },
];

const AdminDashboardPage = () => {
  const { user, loading } = useAuth();
  const [userTab, setUserTab] = useState<UserPlanFilter>("all");
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(() => new Set());
  const [sortConfig, setSortConfig] = useState<{ key: UserSortKey; direction: SortDirection }>({
    key: "created_at",
    direction: "desc",
  });
  const [openActionUserId, setOpenActionUserId] = useState<string | null>(null);

  const { data: isAdmin = false, isLoading: loadingRole } = useQuery({
    queryKey: ["admin-dashboard-access", user?.id],
    enabled: !!user?.id,
    queryFn: () => checkAdminAccess(user!.id),
  });

  const { data: dashboard = emptyPayload, isLoading: loadingDashboard, isError } = useQuery({
    queryKey: ["admin-dashboard-data"],
    enabled: !!user?.id && isAdmin,
    queryFn: fetchAdminDashboard,
  });

  const metrics = dashboard.metrics ?? emptyPayload.metrics;

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const list = dashboard.users.filter((item) => {
      const matchesTab = userTab === "all" || getPlanKey(item.plan) === userTab;
      const matchesSearch =
        !query ||
        (item.name ?? "").toLowerCase().includes(query) ||
        (item.email ?? "").toLowerCase().includes(query);

      return matchesTab && matchesSearch;
    });

    const sorted = [...list].sort((a, b) => {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      const valueA = getUserSortValue(a, sortConfig.key);
      const valueB = getUserSortValue(b, sortConfig.key);

      if (typeof valueA === "number" && typeof valueB === "number") {
        return (valueA - valueB) * dir;
      }

      return String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" }) * dir;
    });

    return sorted;
  }, [dashboard.users, sortConfig.direction, sortConfig.key, userSearch, userTab]);

  const totalUserPages = Math.max(Math.ceil(filteredUsers.length / 20), 1);
  const currentUserPage = Math.min(userPage, totalUserPages);
  const paginatedUsers = filteredUsers.slice((currentUserPage - 1) * 20, currentUserPage * 20);
  const allVisibleSelected = paginatedUsers.length > 0 && paginatedUsers.every((item) => selectedUsers.has(item.user_id));

  const updateSort = (key: UserSortKey) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const updateUserTab = (tab: UserPlanFilter) => {
    setUserTab(tab);
    setUserPage(1);
    setSelectedUsers(new Set());
  };

  const updateSearch = (value: string) => {
    setUserSearch(value);
    setUserPage(1);
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedUsers((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        paginatedUsers.forEach((item) => next.delete(item.user_id));
      } else {
        paginatedUsers.forEach((item) => next.add(item.user_id));
      }
      return next;
    });
  };

  const planBreakdown = useMemo(() => {
    const counts = dashboard.users.reduce<Record<string, number>>((acc, item) => {
      const plan = formatPlan(item.plan);
      acc[plan] = (acc[plan] ?? 0) + 1;
      return acc;
    }, {});

    return [
      { label: "Gratuito", value: counts.Gratuito ?? 0 },
      { label: "Pro", value: counts.Pro ?? 0 },
      { label: "Business", value: counts.Business ?? 0 },
    ];
  }, [dashboard.users]);

  if (loading || loadingRole) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="w-full max-w-md rounded-[28px] border border-[#333] bg-[#111] p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-black">
            <Lock size={21} />
          </div>
          <h1 className="mt-5 text-[24px] font-black">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-white/55">
            Este dashboard é exclusivo para usuários com role admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-3 text-white md:p-5">
      <div className="mx-auto grid min-h-[calc(100vh-24px)] max-w-[1500px] gap-5 overflow-hidden rounded-[26px] border border-[#181818] bg-black p-3 md:min-h-[calc(100vh-40px)] md:grid-cols-[260px_minmax(0,1fr)] md:p-4">
        <aside className="flex flex-col rounded-[22px] border border-[#333] bg-[#0a0a0a] p-5">
          <div className="flex items-center justify-between">
            <VeloLogo size="sm" variant="light" />
            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-bold text-black">
              Admin
            </span>
          </div>

          <div className="mt-4 rounded-full bg-[#1a1a1a] px-3 py-1.5 text-[11px] font-semibold text-white/60">
            ID: {user.id.slice(0, 8).toUpperCase()}
          </div>

          <div className="my-8 h-px bg-[#333]" />

          <nav className="flex flex-1 flex-col gap-2">
            {adminMenu.map((item) => {
              const Icon = item.icon;
              const content = (
                <>
                  <Icon size={17} />
                  <span>{item.label}</span>
                </>
              );

              return item.to.startsWith("#") ? (
                <a
                  key={item.label}
                  href={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold transition",
                    item.active
                      ? "bg-white text-black"
                      : "text-white/65 hover:bg-[#1a1a1a] hover:text-white"
                  )}
                >
                  {content}
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold transition",
                    item.active
                      ? "bg-white text-black"
                      : "text-white/65 hover:bg-[#1a1a1a] hover:text-white"
                  )}
                >
                  {content}
                </Link>
              );
            })}
          </nav>

          <Link
            to="/dashboard"
            className="mt-8 flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-semibold text-white/55 transition hover:bg-[#1a1a1a] hover:text-white"
          >
            <ShieldCheck size={17} />
            Voltar à Velo
          </Link>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-[22px] bg-black p-2 md:p-5">
          <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.25em] text-white/35">
                Velo Admin
              </p>
              <h1 className="mt-2 font-sans text-[36px] font-bold tracking-normal text-white md:text-[46px]">
                Dashboard
              </h1>
              <p className="mt-3 max-w-[560px] text-[14px] leading-6 text-white/50">
                Visão operacional com usuários, receita, planos e integrações conectadas.
              </p>
            </div>

            <div className="flex rounded-2xl border border-[#333] bg-[#050505] p-1">
              {["Portfolio", "History", "Analytics"].map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  className={cn(
                    "h-11 rounded-xl px-6 text-[13px] font-semibold transition",
                    index === 0 ? "bg-white text-black" : "text-white/55 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </header>

          {isError ? (
            <div className="mt-8 rounded-[24px] border border-[#333] bg-[#111] p-8 text-white">
              <p className="text-[18px] font-bold">Não foi possível carregar o dashboard admin.</p>
              <p className="mt-2 text-[14px] text-white/50">
                Verifique as permissões de leitura das tabelas profiles, subscriptions, orders e user_integrations.
              </p>
            </div>
          ) : loadingDashboard ? (
            <div className="mt-16 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          ) : (
            <>
              <section id="receita" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                  hint="Pro + Business ativos"
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
                  label="Total de pedidos"
                  value={String(metrics.total_orders)}
                  hint="Pedidos registrados na Velo"
                />
              </section>

              <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div id="usuarios" className="rounded-[24px] border border-[#222] bg-[#111]">
                  <div className="border-b border-[#222] px-5 pt-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-[18px] font-bold">Usuários</h2>
                        <p className="mt-1 text-[12px] text-white/45">
                          Perfis, planos, Mercado Livre e pedidos acumulados.
                        </p>
                      </div>
                      <div className="flex h-11 min-w-[260px] items-center gap-2 rounded-full border border-[#222] bg-black px-4 text-white/45">
                        <Search size={16} />
                        <input
                          value={userSearch}
                          onChange={(event) => updateSearch(event.target.value)}
                          placeholder="Buscar nome ou email..."
                          className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-7">
                      {userPlanTabs.map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => updateUserTab(tab.key)}
                          className={cn(
                            "relative pb-4 text-[14px] font-medium transition",
                            userTab === tab.key ? "text-white" : "text-white/45 hover:text-white/75"
                          )}
                        >
                          {tab.label}
                          {userTab === tab.key && (
                            <span className="absolute bottom-[-1px] left-0 h-[2px] w-full rounded-full bg-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="overflow-x-auto p-4">
                    <table className="w-full min-w-[1120px] border-separate border-spacing-y-3">
                      <thead>
                        <tr className="text-left text-[12px] font-bold text-white/72">
                          <th className="rounded-l-xl bg-[#1a1a1a] px-4 py-4">
                            <AdminCheckbox checked={allVisibleSelected} onChange={toggleAllVisible} />
                          </th>
                          <SortableHeader label="ID" sortKey="id" current={sortConfig} onSort={updateSort} />
                          <SortableHeader label="Usuário" sortKey="name" current={sortConfig} onSort={updateSort} />
                          <SortableHeader label="Email" sortKey="email" current={sortConfig} onSort={updateSort} />
                          <SortableHeader label="Data cadastro" sortKey="created_at" current={sortConfig} onSort={updateSort} />
                          <SortableHeader label="Plano" sortKey="plan" current={sortConfig} onSort={updateSort} />
                          <SortableHeader label="ML Conectado" sortKey="ml_connected" current={sortConfig} onSort={updateSort} />
                          <SortableHeader label="Pedidos" sortKey="orders_count" current={sortConfig} onSort={updateSort} />
                          <th className="rounded-r-xl bg-[#1a1a1a] px-4 py-4 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedUsers.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="rounded-2xl border border-[#222] bg-black px-5 py-12 text-center text-[14px] text-white/45">
                              Nenhum usuário encontrado.
                            </td>
                          </tr>
                        ) : (
                          paginatedUsers.map((row) => (
                            <UserTableRow
                              key={row.user_id}
                              row={row}
                              selected={selectedUsers.has(row.user_id)}
                              onToggle={() => toggleUser(row.user_id)}
                              actionsOpen={openActionUserId === row.user_id}
                              onToggleActions={() => setOpenActionUserId((current) => current === row.user_id ? null : row.user_id)}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-[#222] px-5 py-4 text-[13px] text-white/50 md:flex-row md:items-center md:justify-between">
                    <span>
                      Mostrando {paginatedUsers.length} de {filteredUsers.length} usuários
                      {selectedUsers.size > 0 ? ` • ${selectedUsers.size} selecionado(s)` : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={currentUserPage <= 1}
                        onClick={() => setUserPage((page) => Math.max(page - 1, 1))}
                        className="rounded-full border border-[#333] px-4 py-2 font-semibold text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Anterior
                      </button>
                      <span className="px-2 text-white/60">
                        {currentUserPage} / {totalUserPages}
                      </span>
                      <button
                        type="button"
                        disabled={currentUserPage >= totalUserPages}
                        onClick={() => setUserPage((page) => Math.min(page + 1, totalUserPages))}
                        className="rounded-full border border-[#333] px-4 py-2 font-semibold text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                </div>

                <aside className="grid gap-5">
                  <div id="planos" className="rounded-[24px] border border-[#333] bg-[#111] p-5">
                    <h2 className="text-[18px] font-black tracking-[-0.02em]">Planos</h2>
                    <div className="mt-5 space-y-4">
                      {planBreakdown.map((item) => (
                        <div key={item.label}>
                          <div className="mb-2 flex items-center justify-between text-[13px]">
                            <span className="text-white/60">{item.label}</span>
                            <span className="font-bold text-white">{item.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-[#242424]">
                            <div
                              className="h-full rounded-full bg-white"
                              style={{
                                width: `${metrics.total_users ? Math.min((item.value / metrics.total_users) * 100, 100) : 0}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[#333] bg-[#111] p-5">
                    <h2 className="text-[18px] font-black tracking-[-0.02em]">Últimas transações</h2>
                    <div className="mt-5 space-y-3">
                      {dashboard.transactions.length === 0 ? (
                        <p className="py-8 text-center text-[13px] text-white/45">Nenhuma assinatura encontrada.</p>
                      ) : (
                        dashboard.transactions.map((item) => (
                          <TransactionRow key={item.id} transaction={item} />
                        ))
                      )}
                    </div>
                  </div>
                </aside>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
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
  <div className="rounded-[22px] border border-[#333] bg-[#1a1a1a] p-5">
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-black uppercase tracking-[0.16em] text-white/38">{label}</span>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
        <Icon size={18} />
      </span>
    </div>
    <p className={cn("mt-7 text-[32px] font-black tracking-[-0.05em]", positive ? "text-[#00C853]" : "text-white")}>
      {value}
    </p>
    <p className="mt-2 text-[12px] text-white/42">{hint}</p>
  </div>
);

const AdminCheckbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={onChange}
    className={cn(
      "flex h-5 w-5 items-center justify-center rounded-md border transition",
      checked ? "border-[#00C853] bg-[#00C853] text-black" : "border-white/55 bg-transparent text-transparent hover:border-white"
    )}
    aria-pressed={checked}
  >
    <Check size={14} strokeWidth={3} />
  </button>
);

const SortableHeader = ({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: UserSortKey;
  current: { key: UserSortKey; direction: SortDirection };
  onSort: (key: UserSortKey) => void;
}) => (
  <th className="bg-[#1a1a1a] px-4 py-4">
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-2 whitespace-nowrap text-left transition hover:text-white"
    >
      {label}
      <ChevronsUpDown
        size={14}
        className={cn(current.key === sortKey ? "text-white" : "text-white/28")}
      />
    </button>
  </th>
);

const PlanBadge = ({ plan }: { plan?: string | null }) => {
  const planKey = getPlanKey(plan);

  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-black",
        planKey === "business" && "bg-[#00C853] text-black",
        planKey === "pro" && "bg-white text-black",
        planKey === "free" && "bg-[#2b2b2b] text-white/70"
      )}
    >
      {formatPlan(plan)}
    </span>
  );
};

const UserTableRow = ({
  row,
  selected,
  onToggle,
  actionsOpen,
  onToggleActions,
}: {
  row: AdminUserRow;
  selected: boolean;
  onToggle: () => void;
  actionsOpen: boolean;
  onToggleActions: () => void;
}) => (
  <tr
    className={cn(
      "text-[13px] text-white/72 transition",
      selected ? "bg-[#222]" : "bg-[#111] hover:bg-[#1a1a1a]"
    )}
  >
    <td className="rounded-l-2xl border-y border-l border-[#222] px-4 py-4">
      <AdminCheckbox checked={selected} onChange={onToggle} />
    </td>
    <td className="border-y border-[#222] px-4 py-4 font-semibold text-white/62">
      {row.user_id.slice(0, 8)}
    </td>
    <td className="border-y border-[#222] px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#242424] text-[12px] font-black text-white">
          {row.avatar_url ? (
            <img src={row.avatar_url} alt={row.name ?? "Usuário"} className="h-full w-full object-cover" />
          ) : (
            getInitials(row.name, row.email)
          )}
        </div>
        <div>
          <p className="font-bold text-white">{row.name || row.email || "Usuário"}</p>
          <p className="mt-0.5 text-[11px] text-white/35">{formatStatus(row.subscription_status)}</p>
        </div>
      </div>
    </td>
    <td className="border-y border-[#222] px-4 py-4 text-white/52">{row.email || "Email indisponível"}</td>
    <td className="border-y border-[#222] px-4 py-4 text-white/52">{formatDate(row.created_at)}</td>
    <td className="border-y border-[#222] px-4 py-4">
      <PlanBadge plan={row.plan} />
    </td>
    <td className="border-y border-[#222] px-4 py-4">
      <span className={cn("inline-flex items-center gap-2 font-bold", row.ml_connected ? "text-[#00C853]" : "text-white/42")}>
        {row.ml_connected ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
        {row.ml_connected ? "Sim" : "Não"}
      </span>
    </td>
    <td className="border-y border-[#222] px-4 py-4 font-bold text-white">{row.orders_count ?? 0}</td>
    <td className="relative rounded-r-2xl border-y border-r border-[#222] px-4 py-4 text-right">
      <button
        type="button"
        onClick={onToggleActions}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-[#2a2a2a] hover:text-white"
        aria-label="Abrir ações"
      >
        <MoreVertical size={18} />
      </button>
      {actionsOpen && (
        <div className="absolute right-4 top-12 z-20 w-44 overflow-hidden rounded-2xl border border-[#333] bg-black p-1 text-left shadow-2xl">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-white/75 transition hover:bg-[#1a1a1a] hover:text-white"
          >
            <Eye size={14} />
            Ver detalhes
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[12px] font-semibold text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
          >
            <UserX size={14} />
            Banir usuário
          </button>
        </div>
      )}
    </td>
  </tr>
);

const TransactionRow = ({ transaction }: { transaction: AdminTransaction }) => (
  <div className="rounded-2xl border border-[#2a2a2a] bg-black p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-[13px] font-bold text-white">
          {transaction.user_name || transaction.email || "Usuário"}
        </p>
        <p className="mt-1 truncate text-[11px] text-white/35">{transaction.email || transaction.user_id}</p>
      </div>
      <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-black">
        {formatPlan(transaction.plan)}
      </span>
    </div>
    <div className="mt-4 flex items-end justify-between">
      <div>
        <p className="text-[11px] text-white/35">{formatDate(transaction.created_at)}</p>
        <p className="mt-1 text-[11px] text-white/45">{formatStatus(transaction.status)}</p>
      </div>
      <p className="text-[16px] font-black text-[#00C853]">{formatBRL(transaction.amount)}</p>
    </div>
  </div>
);

export default AdminDashboardPage;
