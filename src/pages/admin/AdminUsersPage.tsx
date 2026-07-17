import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Grid3x3,
  List,
  Loader2,
  Plus,
  Search,
  Store,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminShell } from "@/components/admin/AdminShell";
import { AdminUserDetailModal } from "@/components/admin/AdminUserDetailModal";
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
  last_seen_at?: string | null;
};

const ONLINE_WINDOW_MS = 2 * 60 * 1000;
const isOnline = (lastSeenAt?: string | null) => {
  if (!lastSeenAt) return false;
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ONLINE_WINDOW_MS;
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

type UserStatusFilter = "todos" | "online" | "ativos" | "gratis";
type SortKey = "created_at" | "name" | "plan" | "orders_count";

const statusFilters: Array<{ key: UserStatusFilter; label: string }> = [
  { key: "todos", label: "Todos" },
  { key: "online", label: "Online" },
  { key: "ativos", label: "Ativos" },
  { key: "gratis", label: "Gratuitos" },
];

const isActiveStatus = (status?: string | null) =>
  ["active", "paid", "approved", "authorized"].includes((status ?? "").toLowerCase());

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
  const [functionResult, profilesResult, subscriptionsResult, sessionsResult] = await Promise.all([
    supabase.functions.invoke("admin-users") as Promise<{ data: AdminUserRow[] | null; error: unknown }>,
    supabase
      .from("profiles")
      .select("user_id,display_name,avatar_url,plano,created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("subscriptions")
      .select("user_id,plan,status,amount,is_trial,created_at,updated_at")
      .order("updated_at", { ascending: false }),
    supabase
      .from("user_sessions")
      .select("user_id,last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(2000),
  ]);

  if (profilesResult.error && functionResult.error) throw profilesResult.error;

  const lastSeenByUser = new Map<string, string>();
  for (const row of (sessionsResult.data ?? []) as Array<{ user_id: string; last_seen_at: string | null }>) {
    if (!row.user_id || !row.last_seen_at) continue;
    if (!lastSeenByUser.has(row.user_id)) lastSeenByUser.set(row.user_id, row.last_seen_at);
  }

  const usersById = new Map<string, AdminUserRow>();
  const functionUsers = Array.isArray(functionResult.data) ? functionResult.data : [];
  for (const item of functionUsers)
    usersById.set(item.user_id, { ...item, last_seen_at: lastSeenByUser.get(item.user_id) ?? null });

  const subscriptionsByUser = new Map<string, SubscriptionRow>();
  for (const s of (subscriptionsResult.data ?? []) as SubscriptionRow[]) {
    subscriptionsByUser.set(s.user_id, chooseSubscription(subscriptionsByUser.get(s.user_id), s));
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
      subscription_updated_at:
        subscription?.updated_at ?? subscription?.created_at ?? existing?.subscription_updated_at ?? null,
      created_at: existing?.created_at ?? profile.created_at,
      ml_connected: existing?.ml_connected ?? false,
      orders_count: existing?.orders_count ?? 0,
      last_seen_at: lastSeenByUser.get(profile.user_id) ?? existing?.last_seen_at ?? null,
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
      subscription_updated_at:
        subscription.updated_at ?? subscription.created_at ?? existing.subscription_updated_at ?? null,
    });
  }

  return Array.from(usersById.values());
};

const formatDateShort = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    .format(date)
    .replace(".", "");
};

const relativeTime = (value: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diff = Date.now() - date.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "hoje";
  if (days === 1) return "1 dia atrás";
  if (days < 30) return `${days} dias atrás`;
  const months = Math.floor(days / 30);
  if (months === 1) return "1 mês atrás";
  if (months < 12) return `${months} meses atrás`;
  const years = Math.floor(months / 12);
  return years === 1 ? "1 ano atrás" : `${years} anos atrás`;
};

const formatPlan = (plan?: string | null) => {
  const n = (plan ?? "gratis").toLowerCase();
  if (n === "business") return "Business";
  if (n === "pro") return "Pro";
  if (n === "plus") return "Plus";
  if (n === "trial") return "Trial";
  return "Gratuito";
};

const getInitials = (name?: string | null, email?: string | null) => {
  const source = name || email || "Velo";
  return source
    .split(/[\s._@-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
};

const isFreePlan = (plan?: string | null) =>
  ["gratis", "free", "gratuito"].includes((plan ?? "gratis").toLowerCase());

const getSortValue = (u: AdminUserRow, key: SortKey) => {
  if (key === "created_at") return new Date(u.created_at).getTime();
  if (key === "orders_count") return Number(u.orders_count ?? 0);
  if (key === "plan") return formatPlan(u.plan);
  return u.name ?? u.email ?? "";
};

type LeadTemp = "cold" | "warm" | "hot";
const leadTemperature = (u: AdminUserRow): LeadTemp => {
  if (isActiveStatus(u.subscription_status)) return "hot";
  if (u.ml_connected || u.orders_count > 0) return "warm";
  return "cold";
};

const tempLabel: Record<LeadTemp, string> = { hot: "Ativo", warm: "Engajado", cold: "Frio" };
const tempStyle: Record<LeadTemp, string> = {
  hot: "bg-white/15 text-white border border-white/20",
  warm: "bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/20",
  cold: "bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const AdminUsersPage = () => {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserStatusFilter>("todos");
  const [sortBy] = useState<SortKey>("created_at");
  const [view, setView] = useState<"list" | "grid">("list");
  const [pageSize, setPageSize] = useState(11);
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users = [], isLoading, isError, error } = useQuery({
    queryKey: ["admin-users-clean"],
    queryFn: fetchAdminUsers,
    enabled: !!user?.id,
    refetchInterval: 15000,
  });

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((item) => {
        const matchesSearch =
          !q ||
          (item.name ?? "").toLowerCase().includes(q) ||
          (item.email ?? "").toLowerCase().includes(q) ||
          item.user_id.toLowerCase().includes(q);
        const matchesFilter =
          filter === "todos" ||
          (filter === "online" && isOnline(item.last_seen_at)) ||
          (filter === "ativos" && isActiveStatus(item.subscription_status)) ||
          (filter === "gratis" && isFreePlan(item.plan));
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const va = getSortValue(a, sortBy);
        const vb = getSortValue(b, sortBy);
        if (typeof va === "number" && typeof vb === "number") return vb - va;
        return String(va).localeCompare(String(vb), "pt-BR", { sensitivity: "base" });
      });
  }, [filter, search, sortBy, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedUsers = filteredUsers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B] text-white">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  return (
    <AdminShell active="users" userId={user.id}>
      <div
        className="min-h-full bg-transparent text-white"
        style={{ fontFamily: "'Geist', 'Inter Tight', -apple-system, sans-serif" }}
      >
        {/* Top bar */}
        <header className="flex flex-col gap-4 border-b border-white/[0.06] px-6 py-5 md:flex-row md:items-center md:justify-between">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Usuários</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar"
                className="h-9 w-64 rounded-full border border-white/10 bg-[#161617] pl-9 pr-4 text-[13px] text-white placeholder:text-white/30 focus:border-white/20 focus:outline-none"
              />
            </div>
            <button className="relative rounded-full border border-white/10 bg-[#161617] p-2 text-white/60 hover:text-white">
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#EF4444]" />
            </button>
          </div>
        </header>

        <div className="p-6">
          <section className="border-0 bg-transparent">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex rounded-lg border border-white/[0.08] bg-[#161617] p-0.5 text-[12px]">
                {(["list", "grid"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-3.5 py-1.5 transition",
                      view === v ? "bg-white/[0.06] text-white" : "text-[#8A8A8E] hover:text-white"
                    )}
                  >
                    {v === "list" ? <List size={13} strokeWidth={1.5} /> : <Grid3x3 size={13} strokeWidth={1.5} />}
                    {v === "list" ? "Lista" : "Grade"}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-lg border border-white/[0.08] bg-[#161617] p-0.5 text-[11px]">
                  {statusFilters.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => {
                        setFilter(s.key);
                        setPage(1);
                      }}
                      className={cn(
                        "rounded-md px-3 py-1.5 transition",
                        filter === s.key ? "bg-white/[0.06] text-white" : "text-[#8A8A8E] hover:text-white"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#161617] px-4 py-2 text-[12px] text-[#8A8A8E] hover:text-white transition">
                  <Filter size={13} strokeWidth={1.5} />
                  Filtrar
                </button>
                <button className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#161617] px-4 py-2 text-[12px] text-[#8A8A8E] hover:text-white transition">
                  <Download size={13} strokeWidth={1.5} />
                  Exportar
                </button>
                <button className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-[12px] font-medium text-black hover:bg-[#E5E5E7] transition">
                  <Plus size={13} strokeWidth={2.5} />
                  Novo usuário
                </button>
              </div>
            </div>

            {/* Content */}
            {isLoading ? (
              <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-white/60" />
              </div>
            ) : isError ? (
              <div className="flex min-h-[420px] items-center justify-center p-8 text-center">
                <div>
                  <p className="text-[15px] font-semibold">Não foi possível carregar usuários.</p>
                  <p className="mt-2 max-w-md text-[12px] leading-6 text-white/50">
                    {error instanceof Error ? error.message : "Confira a Edge Function admin-users."}
                  </p>
                </div>
              </div>
            ) : view === "list" ? (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-[13px]">
                  <thead>
                    <tr className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/40">
                      <Th first>Usuário</Th>
                      <Th>Email</Th>
                      <Th>Atividade</Th>
                      <Th>Status</Th>
                      <Th>Cadastro</Th>
                      <Th>Origem</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05]">
                    {pagedUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-[13px] text-white/40">
                          Nenhum usuário encontrado.
                        </td>
                      </tr>
                    ) : (
                      pagedUsers.map((u) => (
                        <UserRow key={u.user_id} user={u} onClick={() => setSelectedUserId(u.user_id)} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {pagedUsers.map((u) => (
                  <UserCard key={u.user_id} user={u} onClick={() => setSelectedUserId(u.user_id)} />
                ))}
              </div>
            )}

            {/* Pagination */}
            <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.05] pt-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2 text-[12px] text-white/50">
                <span>Mostrar</span>
                <div className="relative">
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="appearance-none rounded-full border border-white/10 bg-[#161617] py-1.5 pl-3 pr-7 text-[12px] text-white focus:border-white/20 focus:outline-none"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n} className="bg-[#161617]">
                        {n}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-white/50" />
                </div>
                <span>por página</span>
              </div>

              <Pagination page={currentPage} totalPages={totalPages} onChange={setPage} />
            </div>
          </section>
        </div>
      </div>
      <AdminUserDetailModal userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
    </AdminShell>
  );
};

const Th = ({ children, first }: { children: React.ReactNode; first?: boolean }) => (
  <th className={cn("py-3 font-medium", first ? "pl-2 pr-4" : "px-4")}>
    <span className="inline-flex items-center gap-1">
      {children}
      <ChevronDown size={11} className="text-white/30" />
    </span>
  </th>
);

const UserRow = ({ user, onClick }: { user: AdminUserRow; onClick?: () => void }) => {
  const temp = leadTemperature(user);
  const online = isOnline(user.last_seen_at);
  return (
    <tr onClick={onClick} className="group cursor-pointer transition hover:bg-white/[0.02]">
      <td className="py-3.5 pl-2 pr-4">
        <div className="flex items-center gap-3">
          <Avatar user={user} online={online} />
          <span className="truncate font-medium text-white">{user.name || "Sem nome"}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-white/70">{user.email || "—"}</td>
      <td className="px-4 py-3.5 text-white/60">
        {online ? (
          <span className="inline-flex items-center gap-1.5 text-white">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            Online agora
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <Store size={12} className="text-white/40" />
            {user.last_seen_at ? relativeTime(user.last_seen_at) : "—"}
          </span>
        )}
      </td>
      <td className="px-4 py-3.5">
        {online ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">
            Online
          </span>
        ) : (
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", tempStyle[temp])}>
            {tempLabel[temp]}
          </span>
        )}
      </td>
      <td className="px-4 py-3.5 text-white/55">{relativeTime(user.created_at)}</td>
      <td className="px-4 py-3.5">
        <SourceBadge user={user} />
      </td>
    </tr>
  );
};

const UserCard = ({ user, onClick }: { user: AdminUserRow; onClick?: () => void }) => {
  const temp = leadTemperature(user);
  const online = isOnline(user.last_seen_at);
  return (
    <div onClick={onClick} className="cursor-pointer border border-white/[0.08] bg-transparent p-4 transition hover:bg-white/[0.02] rounded-lg">
      <div className="flex items-center gap-3">
        <Avatar user={user} online={online} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">{user.name || "Sem nome"}</p>
          <p className="truncate text-[11px] text-white/45">{user.email || user.user_id.slice(0, 8)}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        {online ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Online
          </span>
        ) : (
          <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium", tempStyle[temp])}>
            {tempLabel[temp]}
          </span>
        )}
        <span className="text-[11px] text-white/45">{relativeTime(user.created_at)}</span>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-white/[0.05] pt-3 text-[11px] text-white/50">
        <span>{formatPlan(user.plan)}</span>
        <SourceBadge user={user} compact />
      </div>
    </div>
  );
};

const Avatar = ({ user, online }: { user: AdminUserRow; online?: boolean }) => (
  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.08] text-[11px] font-semibold text-white/80">
    {user.avatar_url ? (
      <img src={user.avatar_url} alt={user.name ?? "Usuário"} className="h-full w-full object-cover" />
    ) : (
      getInitials(user.name, user.email)
    )}
    {online ? (
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0A0A0B] bg-white" />
    ) : null}
  </span>
);

const SourceBadge = ({ user, compact }: { user: AdminUserRow; compact?: boolean }) => {
  const source = user.ml_connected ? "Mercado Livre" : "Direto";
  const dot = user.ml_connected ? "bg-[#FBBF24]" : "bg-white/40";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#161617] px-2.5 py-1 text-[11px] text-white/70",
        compact && "border-transparent bg-transparent px-0 py-0"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
      {source}
    </span>
  );
};

const Pagination = ({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) => {
  const pages = useMemo(() => {
    const arr: (number | "…")[] = [];
    const push = (n: number | "…") => arr.push(n);
    const window = 1;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) push(i);
      else if (arr[arr.length - 1] !== "…") push("…");
    }
    return arr;
  }, [page, totalPages]);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#161617] text-white/60 transition hover:text-white disabled:opacity-30"
      >
        <ChevronLeft size={14} />
      </button>
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="px-1.5 text-[12px] text-white/40">
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            className={cn(
              "h-8 min-w-8 rounded-full px-2 text-[12px] transition",
              p === page
                ? "bg-white text-black"
                : "border border-white/10 bg-[#161617] text-white/70 hover:text-white"
            )}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#161617] text-white/60 transition hover:text-white disabled:opacity-30"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
};

export default AdminUsersPage;
