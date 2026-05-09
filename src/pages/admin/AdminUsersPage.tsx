import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Eye,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Search,
  UserX,
} from "lucide-react";
import { AdminShell } from "@/components/admin/AdminShell";
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
  created_at: string;
  ml_connected: boolean;
  orders_count: number;
};

type AdminUserDetails = {
  email: string | null;
  phone: string | null;
  total_pago: number;
  total_transacoes: number;
  ultima_transacao: string | null;
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
type UserSortKey = "id" | "name" | "email" | "created_at" | "status" | "ml_connected" | "orders_count";
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

async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.functions.invoke("admin-users");
  if (error) {
    if (import.meta.env.DEV) return fetchAdminUsersDevFallback();
    throw error;
  }
  return (data ?? []) as AdminUserRow[];
}

async function fetchAdminUsersDevFallback(): Promise<AdminUserRow[]> {
  const profiles = await loadProfiles();
  const userIds = profiles.map(getProfileUserId).filter(Boolean);

  const [subsRes, integrationsRes, ordersRes] = await Promise.all([
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
      ? (supabase as any).from("orders").select("user_id").in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const error = subsRes.error ?? integrationsRes.error ?? ordersRes.error;
  if (error) throw error;

  const latestSubByUser = new Map<string, SubscriptionRow>();
  for (const subscription of (subsRes.data ?? []) as SubscriptionRow[]) {
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

  return profiles.map((profile) => {
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
}

async function fetchAdminUserDetails(userId: string): Promise<AdminUserDetails> {
  const { data, error } = await supabase.functions.invoke("get-user-details", {
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

const formatDate = (value: string | null) => {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

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
  return "Inativo";
};

const isActiveStatus = (status?: string | null) =>
  ["active", "approved", "authorized", "paid"].includes((status ?? "").toLowerCase());

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
  if (key === "status") return formatStatus(row.subscription_status);
  if (key === "ml_connected") return row.ml_connected ? 1 : 0;
  if (key === "orders_count") return row.orders_count ?? 0;
  return "";
};

const getWhatsAppHref = (phone?: string | null) => {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
};

const AdminUsersPage = () => {
  const { user, loading } = useAuth();
  const [userTab, setUserTab] = useState<UserPlanFilter>("all");
  const [userSearch, setUserSearch] = useState("");
  const [userPage, setUserPage] = useState(1);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(() => new Set());
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: UserSortKey; direction: SortDirection }>({
    key: "created_at",
    direction: "desc",
  });
  const [openActionUserId, setOpenActionUserId] = useState<string | null>(null);

  const { data: isAdmin = false, isLoading: loadingRole } = useQuery({
    queryKey: ["admin-users-access", user?.id],
    enabled: !!user?.id,
    queryFn: () => checkAdminAccess(user!.id),
  });

  const { data: users = [], isLoading: loadingUsers, isError } = useQuery({
    queryKey: ["admin-users-table"],
    enabled: !!user?.id && isAdmin,
    queryFn: fetchAdminUsers,
  });

  const { data: expandedDetails, isLoading: loadingExpandedDetails } = useQuery({
    queryKey: ["admin-user-details", expandedUserId],
    enabled: !!expandedUserId && isAdmin,
    queryFn: () => fetchAdminUserDetails(expandedUserId!),
  });

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const list = users.filter((item) => {
      const matchesTab = userTab === "all" || getPlanKey(item.plan) === userTab;
      const matchesSearch =
        !query ||
        (item.name ?? "").toLowerCase().includes(query) ||
        (item.email ?? "").toLowerCase().includes(query);

      return matchesTab && matchesSearch;
    });

    return [...list].sort((a, b) => {
      const dir = sortConfig.direction === "asc" ? 1 : -1;
      const valueA = getUserSortValue(a, sortConfig.key);
      const valueB = getUserSortValue(b, sortConfig.key);

      if (typeof valueA === "number" && typeof valueB === "number") {
        return (valueA - valueB) * dir;
      }

      return String(valueA).localeCompare(String(valueB), "pt-BR", { sensitivity: "base" }) * dir;
    });
  }, [sortConfig.direction, sortConfig.key, userSearch, userTab, users]);

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
          <h1 className="mt-5 text-[24px] font-bold">Acesso restrito</h1>
          <p className="mt-2 text-[14px] leading-6 text-white/55">
            Este dashboard é exclusivo para usuários com role admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminShell active="users" userId={user.id}>
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="font-sans text-[38px] font-bold tracking-normal text-white md:text-[48px]">
            Usuários
          </h1>
          <p className="mt-3 text-[15px] text-white/48">
            Perfis, planos, Mercado Livre e pedidos acumulados.
          </p>
        </div>

        <div className="flex h-12 w-full items-center gap-2 rounded-full border border-[#222] bg-[#111] px-4 text-white/45 lg:w-[360px]">
          <Search size={17} />
          <input
            value={userSearch}
            onChange={(event) => updateSearch(event.target.value)}
            placeholder="Buscar nome ou email..."
            className="min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
          />
        </div>
      </header>

      <section className="mt-8 rounded-[20px] border border-[#222] bg-[#0a0a0a]">
        <div className="border-b border-[#222] px-5 pt-5">
          <div className="flex flex-wrap gap-7">
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

        {isError ? (
          <div className="px-5 py-14 text-center">
            <p className="text-[16px] font-bold text-white">Não foi possível carregar os usuários.</p>
            <p className="mt-2 text-[13px] text-white/45">
              Verifique permissões de leitura em profiles, subscriptions, user_integrations e orders.
            </p>
          </div>
        ) : loadingUsers ? (
          <div className="flex items-center justify-center px-5 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[1120px] border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-[12px] font-bold text-[#888]">
                    <th className="rounded-l-xl border-y border-l border-[#222] bg-[#111] px-4 py-4">
                      <AdminCheckbox checked={allVisibleSelected} onChange={toggleAllVisible} />
                    </th>
                    <SortableHeader label="ID" sortKey="id" current={sortConfig} onSort={updateSort} />
                    <SortableHeader label="Usuário" sortKey="name" current={sortConfig} onSort={updateSort} />
                    <SortableHeader label="Email" sortKey="email" current={sortConfig} onSort={updateSort} />
                    <SortableHeader label="Data cadastro" sortKey="created_at" current={sortConfig} onSort={updateSort} />
                    <SortableHeader label="Status" sortKey="status" current={sortConfig} onSort={updateSort} />
                    <SortableHeader label="ML Conectado" sortKey="ml_connected" current={sortConfig} onSort={updateSort} />
                    <SortableHeader label="Pedidos" sortKey="orders_count" current={sortConfig} onSort={updateSort} />
                    <th className="rounded-r-xl border-y border-r border-[#222] bg-[#111] px-4 py-4 text-right">Ação</th>
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
                        expanded={expandedUserId === row.user_id}
                        details={expandedUserId === row.user_id ? expandedDetails : undefined}
                        loadingDetails={expandedUserId === row.user_id && loadingExpandedDetails}
                        onToggleExpand={() =>
                          setExpandedUserId((current) => current === row.user_id ? null : row.user_id)
                        }
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
          </>
        )}
      </section>
    </AdminShell>
  );
};

const AdminCheckbox = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      onChange();
    }}
    className={cn(
      "flex h-5 w-5 items-center justify-center rounded-md border transition",
      checked ? "border-[#00C853] bg-[#00C853] text-white" : "border-[#444] bg-transparent text-transparent hover:border-white/70"
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
  <th className="border-y border-[#222] bg-[#111] px-4 py-4">
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-2 whitespace-nowrap text-left transition hover:text-white"
    >
      {label}
      <span className={cn("text-[12px]", current.key === sortKey ? "text-white" : "text-white/25")}>
        {current.key === sortKey ? (current.direction === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </button>
  </th>
);

const StatusBadge = ({ status }: { status?: string | null }) => (
  <span
    className={cn(
      "inline-flex rounded-full px-3 py-1 text-[11px] font-bold",
      isActiveStatus(status) ? "bg-[#00C853] text-black" : "bg-[#333] text-[#888]"
    )}
  >
    {formatStatus(status)}
  </span>
);

const ConnectionBadge = ({ connected }: { connected: boolean }) => (
  <span
    className={cn(
      "inline-flex rounded-full px-3 py-1 text-[11px] font-bold",
      connected ? "bg-[#00C853] text-black" : "bg-[#333] text-[#888]"
    )}
  >
    {connected ? "Sim" : "Não"}
  </span>
);

const UserTableRow = ({
  row,
  selected,
  onToggle,
  expanded,
  details,
  loadingDetails,
  onToggleExpand,
  actionsOpen,
  onToggleActions,
}: {
  row: AdminUserRow;
  selected: boolean;
  onToggle: () => void;
  expanded: boolean;
  details?: AdminUserDetails;
  loadingDetails: boolean;
  onToggleExpand: () => void;
  actionsOpen: boolean;
  onToggleActions: () => void;
}) => (
  <>
    <tr
      onClick={onToggleExpand}
      className={cn(
        "group cursor-pointer text-[13px] text-[#888] transition",
        expanded || selected ? "bg-[#1a1a1a]" : "bg-transparent hover:bg-[#111]"
      )}
    >
      <td className="rounded-l-xl border-y border-l border-[#222] px-4 py-4">
        <AdminCheckbox checked={selected} onChange={onToggle} />
      </td>
      <td className="border-y border-[#222] px-4 py-4 font-semibold text-[#888]">
        {row.user_id.slice(0, 8)}
      </td>
      <td className="border-y border-[#222] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#222] text-[12px] font-bold text-white">
            {row.avatar_url ? (
              <img src={row.avatar_url} alt={row.name ?? "Usuário"} className="h-full w-full object-cover" />
            ) : (
              getInitials(row.name, row.email)
            )}
          </div>
          <div>
            <p className="font-bold text-white">{row.name || row.email || "Usuário"}</p>
            <p className="mt-0.5 text-[11px] text-[#888]">{formatPlan(row.plan)}</p>
          </div>
        </div>
      </td>
      <td className="border-y border-[#222] px-4 py-4 text-[#888]">{row.email || "Email indisponível"}</td>
      <td className="border-y border-[#222] px-4 py-4 text-[#888]">{formatDate(row.created_at)}</td>
      <td className="border-y border-[#222] px-4 py-4">
        <StatusBadge status={row.subscription_status} />
      </td>
      <td className="border-y border-[#222] px-4 py-4">
        <ConnectionBadge connected={row.ml_connected} />
      </td>
      <td className="border-y border-[#222] px-4 py-4 font-bold text-white">{row.orders_count ?? 0}</td>
      <td className="relative rounded-r-xl border-y border-r border-[#222] px-4 py-4 text-right">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleActions();
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition hover:bg-[#2a2a2a] hover:text-white"
          aria-label="Abrir ações"
        >
          <MoreVertical size={18} />
        </button>
        {actionsOpen && (
          <div
            onClick={(event) => event.stopPropagation()}
            className="absolute right-4 top-12 z-20 w-44 overflow-hidden rounded-2xl border border-[#333] bg-black p-1 text-left shadow-2xl"
          >
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
              Suspender conta
            </button>
          </div>
        )}
      </td>
    </tr>
    {expanded && (
      <tr className="bg-[#1a1a1a] text-[13px]">
        <td colSpan={9} className="rounded-b-xl border-x border-b border-[#222] px-8 py-6">
          <div className="flex items-start justify-between gap-5">
            {loadingDetails ? (
              <div className="flex min-h-[120px] flex-1 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            ) : (
              <div className="grid flex-1 gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <DetailItem label="Email" value={details?.email ?? row.email ?? "Não informado"} />
                  <DetailItem
                    label="WhatsApp"
                    value={details?.phone ?? "Não informado"}
                    href={getWhatsAppHref(details?.phone)}
                  />
                  <DetailItem label="Cadastro" value={formatDate(row.created_at)} />
                </div>
                <div className="space-y-3">
                  <DetailItem label="Total pago" value={formatBRL(details?.total_pago ?? 0)} highlight />
                  <DetailItem label="Transações" value={String(details?.total_transacoes ?? 0)} />
                  <DetailItem label="Última transação" value={formatDate(details?.ultima_transacao ?? null)} />
                </div>
              </div>
            )}
            <div className="flex shrink-0 flex-col items-end gap-4">
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#333] text-white/65 transition hover:border-white/70 hover:text-white"
                aria-label="Editar usuário"
              >
                <Pencil size={18} />
              </button>
              <button
                type="button"
                onClick={onToggleExpand}
                className="text-[12px] font-semibold text-[#888] transition hover:text-white"
              >
                ▲ Ocultar
              </button>
            </div>
          </div>
        </td>
      </tr>
    )}
  </>
);

const DetailItem = ({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string;
  value: string;
  href?: string | null;
  highlight?: boolean;
}) => (
  <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
    <span className="text-[#888]">{label}</span>
    {href ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn("break-words font-semibold transition hover:text-white", highlight ? "text-[#00C853]" : "text-white")}
      >
        {value}
      </a>
    ) : (
      <span className={cn("break-words font-semibold", highlight ? "text-[#00C853]" : "text-white")}>
        {value}
      </span>
    )}
  </div>
);

export default AdminUsersPage;
