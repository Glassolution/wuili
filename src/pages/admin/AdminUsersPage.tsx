import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Headphones,
  LayoutDashboard,
  Loader2,
  Mail,
  Percent,
  Search,
  ShieldCheck,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type AdminUserRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  plan: string | null;
  subscription_status: string | null;
  subscription_amount?: number | null;
  subscription_updated_at?: string | null;
  created_at: string;
  ml_connected: boolean;
  orders_count: number;
};

type ProfileRow = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  plano: string | null;
  created_at: string;
};

type SubscriptionRow = {
  user_id: string;
  plan: string | null;
  status: string | null;
  amount: number | null;
  is_trial: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

type AdminUserDetails = {
  email: string | null;
  phone: string | null;
  total_pago: number;
  total_transacoes: number;
  ultima_transacao: string | null;
};

type UserStatusFilter = "todos" | "ativos" | "gratis";
type SortKey = "created_at" | "name" | "plan" | "orders_count";

const statusFilters: Array<{ key: UserStatusFilter; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "ativos", label: "Ativos" },
  { key: "gratis", label: "Gratuitos" },
];

const sortOptions: Array<{ key: SortKey; label: string }> = [
  { key: "created_at", label: "Mais recentes" },
  { key: "name", label: "Nome" },
  { key: "plan", label: "Plano" },
  { key: "orders_count", label: "Pedidos" },
];

const chooseSubscription = (current: SubscriptionRow | undefined, next: SubscriptionRow) => {
  if (!current) return next;

  const currentActive = isActiveStatus(current.status);
  const nextActive = isActiveStatus(next.status);
  if (nextActive && !currentActive) return next;
  if (currentActive && !nextActive) return current;

  const currentDate = new Date(current.updated_at ?? current.created_at ?? 0).getTime();
  const nextDate = new Date(next.updated_at ?? next.created_at ?? 0).getTime();
  return nextDate > currentDate ? next : current;
};

const fetchAdminUsers = async (): Promise<AdminUserRow[]> => {
  const [functionResult, profilesResult, subscriptionsResult] = await Promise.all([
    supabase.functions.invoke<AdminUserRow[]>("admin-users"),
    supabase
      .from("profiles")
      .select("user_id,display_name,avatar_url,plano,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("user_id,plan,status,amount,is_trial,created_at,updated_at")
      .order("updated_at", { ascending: false }),
  ]);

  if (profilesResult.error && functionResult.error) {
    throw profilesResult.error;
  }

  const usersById = new Map<string, AdminUserRow>();
  const functionUsers = Array.isArray(functionResult.data) ? functionResult.data : [];
  for (const item of functionUsers) {
    usersById.set(item.user_id, item);
  }

  const subscriptionsByUser = new Map<string, SubscriptionRow>();
  for (const subscription of (subscriptionsResult.data ?? []) as SubscriptionRow[]) {
    subscriptionsByUser.set(
      subscription.user_id,
      chooseSubscription(subscriptionsByUser.get(subscription.user_id), subscription)
    );
  }

  for (const profile of (profilesResult.data ?? []) as ProfileRow[]) {
    const subscription = subscriptionsByUser.get(profile.user_id);
    const existing = usersById.get(profile.user_id);

    usersById.set(profile.user_id, {
      user_id: profile.user_id,
      name: existing?.name ?? profile.display_name,
      email: existing?.email ?? null,
      avatar_url: existing?.avatar_url ?? profile.avatar_url,
      plan: subscription?.plan ?? existing?.plan ?? profile.plano ?? "gratis",
      subscription_status: subscription?.status ?? existing?.subscription_status ?? null,
      subscription_amount: subscription?.amount ?? existing?.subscription_amount ?? null,
      subscription_updated_at: subscription?.updated_at ?? subscription?.created_at ?? existing?.subscription_updated_at ?? null,
      created_at: existing?.created_at ?? profile.created_at,
      ml_connected: existing?.ml_connected ?? false,
      orders_count: existing?.orders_count ?? 0,
    });
  }

  for (const [userId, existing] of usersById) {
    const subscription = subscriptionsByUser.get(userId);
    if (!subscription) continue;

    usersById.set(userId, {
      ...existing,
      plan: subscription.plan ?? existing.plan,
      subscription_status: subscription.status ?? existing.subscription_status,
      subscription_amount: subscription.amount ?? existing.subscription_amount ?? null,
      subscription_updated_at: subscription.updated_at ?? subscription.created_at ?? existing.subscription_updated_at ?? null,
    });
  }

  return Array.from(usersById.values());
};

const fetchAdminUserDetails = async (userId: string): Promise<AdminUserDetails> => {
  const { data, error } = await supabase.functions.invoke<AdminUserDetails>("get-user-details", {
    body: { user_id: userId },
  });

  if (error) throw error;

  return {
    email: data?.email ?? null,
    phone: data?.phone ?? null,
    total_pago: Number(data?.total_pago ?? 0),
    total_transacoes: Number(data?.total_transacoes ?? 0),
    ultima_transacao: data?.ultima_transacao ?? null,
  };
};

const formatDate = (value: string | null) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(".", "");
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatSubscriptionValue = (value?: number | null) =>
  typeof value === "number" && value > 0 ? formatBRL(value) : "Sem valor registrado";

const formatPlan = (plan?: string | null) => {
  const normalized = (plan ?? "gratis").toLowerCase();
  if (normalized === "business") return "Business";
  if (normalized === "pro") return "Pro";
  if (normalized === "plus") return "Plus";
  if (normalized === "trial") return "Trial";
  return "Gratuito";
};

const isActiveStatus = (status?: string | null) =>
  ["active", "paid", "approved", "authorized"].includes((status ?? "").toLowerCase());

const formatStatus = (status?: string | null) => {
  if (isActiveStatus(status)) return "Ativo";
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "trial") return "Trial";
  if (["cancelled", "canceled"].includes(normalized)) return "Cancelado";
  return "Sem assinatura";
};

const getInitials = (name?: string | null, email?: string | null) => {
  const source = name || email || "Velo";
  return source
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
};

const isFreePlan = (plan?: string | null) => {
  const normalized = (plan ?? "gratis").toLowerCase();
  return ["gratis", "free", "gratuito"].includes(normalized);
};

const getSortValue = (user: AdminUserRow, key: SortKey) => {
  if (key === "created_at") return new Date(user.created_at).getTime();
  if (key === "orders_count") return Number(user.orders_count ?? 0);
  if (key === "plan") return formatPlan(user.plan);
  return user.name ?? user.email ?? "";
};

const AdminUsersPage = () => {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserStatusFilter>("todos");
  const [sortBy, setSortBy] = useState<SortKey>("created_at");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const {
    data: users = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["admin-users-clean"],
    queryFn: fetchAdminUsers,
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  const selectedUser = useMemo(
    () => users.find((item) => item.user_id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  const { data: selectedDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: ["admin-user-details-clean", selectedUserId],
    queryFn: () => fetchAdminUserDetails(selectedUserId!),
    enabled: !!selectedUserId,
  });

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users
      .filter((item) => {
        const matchesSearch =
          !query ||
          (item.name ?? "").toLowerCase().includes(query) ||
          (item.email ?? "").toLowerCase().includes(query) ||
          item.user_id.toLowerCase().includes(query);

        const matchesFilter =
          filter === "todos" ||
          (filter === "ativos" && isActiveStatus(item.subscription_status)) ||
          (filter === "gratis" && isFreePlan(item.plan));

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const valueA = getSortValue(a, sortBy);
        const valueB = getSortValue(b, sortBy);

        if (typeof valueA === "number" && typeof valueB === "number") {
          return valueB - valueA;
        }

        return String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" });
      });
  }, [filter, search, sortBy, users]);

  const stats = useMemo(() => {
    const activeUsers = users.filter((item) => isActiveStatus(item.subscription_status)).length;
    const mlUsers = users.filter((item) => item.ml_connected).length;
    const totalOrders = users.reduce((sum, item) => sum + Number(item.orders_count ?? 0), 0);
    const newThisWeek = users.filter((item) => {
      const createdAt = new Date(item.created_at);
      const start = new Date();
      start.setDate(start.getDate() - 7);
      return !Number.isNaN(createdAt.getTime()) && createdAt >= start;
    }).length;

    return [
      { label: "Usuários", value: users.length.toLocaleString("pt-BR"), hint: "perfis carregados" },
      { label: "Assinaturas ativas", value: activeUsers.toLocaleString("pt-BR"), hint: "status ativo ou pago" },
      { label: "Mercado Livre", value: mlUsers.toLocaleString("pt-BR"), hint: "contas conectadas" },
      { label: "Pedidos", value: totalOrders.toLocaleString("pt-BR"), hint: `${newThisWeek} novos em 7 dias` },
    ];
  }, [users]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f5f4] text-black">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-[#f5f5f4] text-[#111111]">
      <div className="flex min-h-screen items-start">
        <AdminSidebar userId={user.id} />

        <main className="min-w-0 flex-1">
          <header className="border-b border-black/[0.08] bg-white px-4 py-5 sm:px-6 lg:px-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-black/55">Admin Velo</p>
                <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.045em] text-black sm:text-[40px]">
                  Usuários
                </h1>
                <p className="mt-2 max-w-2xl text-[14px] leading-6 text-black/58">
                  Acompanhe contas reais, planos, conexão com Mercado Livre e atividade de pedidos.
                </p>
              </div>

              <div className="flex w-full items-center gap-2 rounded-[14px] border border-black/10 bg-[#f7f7f7] px-4 py-3 xl:w-[390px]">
                <Search size={18} className="text-black/45" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar usuário, email ou ID..."
                  className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-black/38"
                />
              </div>
            </div>
          </header>

          <div className="space-y-5 px-4 py-5 sm:px-6 lg:px-7">
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {stats.map((item) => (
                <article key={item.label} className="rounded-[18px] border border-black/[0.08] bg-white p-5 shadow-sm">
                  <p className="text-[13px] text-black/62">{item.label}</p>
                  <strong className="mt-5 block text-[29px] font-semibold tracking-[-0.05em] text-black">
                    {item.value}
                  </strong>
                  <p className="mt-3 text-[12px] text-black/52">{item.hint}</p>
                </article>
              ))}
            </section>

            <section className="rounded-[22px] border border-black/[0.08] bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-black/[0.08] p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {statusFilters.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      className={cn(
                        "h-10 rounded-full px-4 text-[13px] font-semibold transition",
                        filter === item.key
                          ? "bg-black text-white"
                          : "border border-black/10 bg-white text-black/62 hover:border-black/20 hover:text-black"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <label className="flex w-full items-center justify-between gap-3 rounded-full border border-black/10 px-4 py-2 text-[13px] text-black/56 lg:w-auto">
                  Ordenar
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortKey)}
                    className="bg-transparent font-semibold text-black outline-none"
                  >
                    {sortOptions.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {isLoading ? (
                <div className="flex min-h-[360px] items-center justify-center">
                  <Loader2 className="h-7 w-7 animate-spin text-black" />
                </div>
              ) : isError ? (
                <div className="flex min-h-[360px] items-center justify-center p-8 text-center">
                  <div>
                    <p className="text-[18px] font-semibold text-black">Não foi possível carregar usuários.</p>
                    <p className="mt-2 max-w-md text-[13px] leading-6 text-black/54">
                      {error instanceof Error ? error.message : "Confira a Edge Function admin-users e as permissões de admin."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid min-h-[620px] lg:grid-cols-[minmax(0,1fr)_360px]">
                  <div className="overflow-x-auto p-4">
                    <table className="w-full min-w-[850px] border-separate border-spacing-y-2">
                      <thead>
                        <tr className="text-left text-[12px] font-semibold text-black/45">
                          <th className="px-4 py-2">Usuário</th>
                          <th className="px-4 py-2">Plano</th>
                          <th className="px-4 py-2">Status</th>
                          <th className="px-4 py-2">ML</th>
                          <th className="px-4 py-2 text-right">Pedidos</th>
                          <th className="px-4 py-2">Cadastro</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="rounded-2xl bg-[#f7f7f7] px-4 py-14 text-center text-[14px] text-black/50">
                              Nenhum usuário encontrado.
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map((item) => (
                            <UserRow
                              key={item.user_id}
                              user={item}
                              selected={selectedUserId === item.user_id}
                              onClick={() => setSelectedUserId(item.user_id)}
                            />
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <UserDetailsPanel
                    user={selectedUser}
                    details={selectedDetails}
                    loading={isLoadingDetails}
                    onClose={() => setSelectedUserId(null)}
                  />
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};

const AdminSidebar = ({ userId }: { userId: string }) => (
  <aside className="sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-white/[0.07] bg-[#111111] text-white lg:flex lg:flex-col">
    <div className="flex h-[74px] items-center border-b border-white/[0.06] px-7">
      <Link to="/admin/painel" className="flex items-center gap-3">
        <VeloMark />
        <div>
          <p className="text-[19px] font-semibold tracking-[-0.04em]">VeloMetric</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/36">Admin</p>
        </div>
      </Link>
    </div>

    <div className="flex-1 px-5 py-6">
      <p className="mb-3 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">Monitoramento</p>
      <div className="space-y-1">
        <AdminNavLink icon={LayoutDashboard} label="Painel" to="/admin/painel" />
        <AdminNavLink icon={Percent} label="Comissões" to="/admin/comissoes" />
        <AdminNavLink icon={Users} label="Usuários" to="/admin/usuarios" active />
        <AdminNavLink icon={Headphones} label="Suporte" to="/admin/suporte" />
      </div>
    </div>

    <div className="mt-auto space-y-5 border-t border-white/[0.06] p-5">
      <div className="rounded-[12px] border border-white/[0.08] bg-white/[0.035] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black">
            <ShieldCheck size={17} />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] text-white/58">Admin ID</p>
            <p className="truncate text-[14px] font-semibold tracking-[-0.02em]">
              {userId.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>
      </div>

      <Link
        to="/dashboard"
        className="flex h-10 items-center gap-2 rounded-[10px] px-2 text-[13px] font-semibold text-white transition hover:bg-white/[0.06]"
      >
        <ArrowLeft size={15} />
        Voltar à Velo
      </Link>
    </div>
  </aside>
);

const AdminNavLink = ({
  icon: Icon,
  label,
  to,
  active = false,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  to: string;
  active?: boolean;
}) => (
  <Link
    to={to}
    className={cn(
      "group flex h-10 items-center gap-3 rounded-[9px] px-3 text-[14px] font-semibold transition",
      active ? "bg-white/[0.10] text-white" : "text-white/56 hover:bg-white/[0.06] hover:text-white"
    )}
  >
    <Icon size={16} strokeWidth={1.8} />
    {label}
  </Link>
);

const VeloMark = () => (
  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-black shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
    <svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M33 18A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
      <path
        d="M30 26L34 30L38 26"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

const UserRow = ({
  user,
  selected,
  onClick,
}: {
  user: AdminUserRow;
  selected: boolean;
  onClick: () => void;
}) => (
  <tr
    onClick={onClick}
    className={cn(
      "cursor-pointer text-[13px] transition",
      selected ? "bg-black text-white" : "bg-[#fbfbfb] text-black hover:bg-[#f1f1f1]"
    )}
  >
    <td className="rounded-l-2xl px-4 py-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} selected={selected} />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{user.name || "Usuário sem nome"}</p>
          <p className={cn("mt-0.5 truncate text-[12px]", selected ? "text-white/54" : "text-black/45")}>
            {user.email || user.user_id.slice(0, 8)}
          </p>
        </div>
      </div>
    </td>
    <td className="px-4 py-4">
      <div className="flex flex-col items-start gap-1.5">
        <span className={cn("rounded-full px-3 py-1 text-[12px] font-semibold", selected ? "bg-white/12" : "bg-black/[0.04]")}>
          {formatPlan(user.plan)}
        </span>
        <span className={cn("text-[11px] font-medium", selected ? "text-white/54" : "text-black/45")}>
          {formatSubscriptionValue(user.subscription_amount)}
        </span>
      </div>
    </td>
    <td className="px-4 py-4">
      <StatusPill status={user.subscription_status} selected={selected} />
    </td>
    <td className="px-4 py-4">
      <span className={cn("inline-flex items-center gap-1.5 font-semibold", user.ml_connected ? "text-emerald-600" : selected ? "text-white/45" : "text-black/38")}>
        <Store size={14} />
        {user.ml_connected ? "Conectado" : "Não"}
      </span>
    </td>
    <td className="px-4 py-4 text-right font-semibold">{Number(user.orders_count ?? 0).toLocaleString("pt-BR")}</td>
    <td className="rounded-r-2xl px-4 py-4 text-black/48">{formatDate(user.created_at)}</td>
  </tr>
);

const Avatar = ({ user, selected }: { user: AdminUserRow; selected: boolean }) => (
  <span
    className={cn(
      "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[12px] font-semibold",
      selected ? "bg-white text-black" : "bg-black text-white"
    )}
  >
    {user.avatar_url ? (
      <img src={user.avatar_url} alt={user.name ?? "Usuário"} className="h-full w-full object-cover" />
    ) : (
      getInitials(user.name, user.email)
    )}
  </span>
);

const StatusPill = ({ status, selected }: { status?: string | null; selected: boolean }) => {
  const active = isActiveStatus(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold",
        active
          ? "bg-emerald-100 text-emerald-700"
          : selected
            ? "bg-white/10 text-white/58"
            : "bg-black/[0.04] text-black/48"
      )}
    >
      {active && <CheckCircle2 size={13} />}
      {formatStatus(status)}
    </span>
  );
};

const UserDetailsPanel = ({
  user,
  details,
  loading,
  onClose,
}: {
  user: AdminUserRow | null;
  details?: AdminUserDetails;
  loading: boolean;
  onClose: () => void;
}) => (
  <aside className="border-t border-black/[0.08] bg-[#fafafa] p-5 lg:border-l lg:border-t-0">
    {!user ? (
      <div className="flex min-h-full items-center justify-center rounded-[18px] border border-dashed border-black/12 p-8 text-center">
        <div>
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
            <UserRound size={20} />
          </span>
          <p className="mt-4 text-[15px] font-semibold">Selecione um usuário</p>
          <p className="mt-2 text-[13px] leading-6 text-black/48">
            Clique em uma linha para ver email, pagamento e dados de contato.
          </p>
        </div>
      </div>
    ) : (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar user={user} selected={false} />
            <div className="min-w-0">
              <h2 className="truncate text-[18px] font-semibold tracking-[-0.03em]">{user.name || "Usuário"}</h2>
              <p className="mt-1 truncate text-[12px] text-black/45">{user.user_id}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-[12px] font-semibold text-black/42 hover:text-black">
            Fechar
          </button>
        </div>

        {loading ? (
          <div className="flex h-44 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid gap-3">
              <DetailCard label="Email" value={details?.email ?? user.email ?? "Não informado"} icon={Mail} copyValue={details?.email ?? user.email} />
              <DetailCard label="Telefone" value={details?.phone ?? "Não informado"} icon={UserRound} />
              <DetailCard
                label="Assinatura"
                value={`${formatPlan(user.plan)} · ${formatStatus(user.subscription_status)} · ${formatSubscriptionValue(user.subscription_amount)}`}
                icon={ShieldCheck}
              />
            </div>

            <div className="rounded-[18px] border border-black/[0.08] bg-white p-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-black/44">Financeiro</p>
              <strong className="mt-4 block text-[30px] font-semibold tracking-[-0.05em]">
                {formatBRL(details?.total_pago ?? 0)}
              </strong>
              <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
                <div className="rounded-[14px] bg-[#f5f5f4] p-3">
                  <p className="text-black/44">Transações</p>
                  <p className="mt-2 font-semibold">{details?.total_transacoes ?? 0}</p>
                </div>
                <div className="rounded-[14px] bg-[#f5f5f4] p-3">
                  <p className="text-black/44">Última</p>
                  <p className="mt-2 font-semibold">{formatDate(details?.ultima_transacao ?? null)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[18px] border border-black/[0.08] bg-white p-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-black/44">Operação</p>
              <div className="mt-4 space-y-3 text-[13px]">
                <DetailLine label="Mercado Livre" value={user.ml_connected ? "Conectado" : "Não conectado"} />
                <DetailLine label="Pedidos" value={Number(user.orders_count ?? 0).toLocaleString("pt-BR")} />
                <DetailLine label="Cadastro" value={formatDate(user.created_at)} />
              </div>
            </div>
          </>
        )}
      </div>
    )}
  </aside>
);

const DetailCard = ({
  label,
  value,
  icon: Icon,
  copyValue,
}: {
  label: string;
  value: string;
  icon: typeof Mail;
  copyValue?: string | null;
}) => (
  <div className="rounded-[18px] border border-black/[0.08] bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black text-white">
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] text-black/45">{label}</p>
          <p className="mt-1 break-words text-[13px] font-semibold text-black">{value}</p>
        </div>
      </div>
      {copyValue && (
        <button
          type="button"
          onClick={() => void navigator.clipboard?.writeText(copyValue)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-black/42 transition hover:bg-black/[0.05] hover:text-black"
          aria-label={`Copiar ${label}`}
        >
          <Copy size={14} />
        </button>
      )}
    </div>
  </div>
);

const DetailLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-black/45">{label}</span>
    <strong className="text-right font-semibold">{value}</strong>
  </div>
);

export default AdminUsersPage;
