import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Lock, XCircle, UserRound, Clock, ShieldCheck, RotateCcw } from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";

type RefundRow = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  reason: string;
  reason_details: string | null;
  status: string;
  refund_amount: number;
  requested_at: string;
  processed_at: string | null;
  created_at: string;
};

type SubRow = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  amount: number | null;
  created_at: string;
  current_period_end: string | null;
};

type TabKey = "pending" | "eligible" | "approved" | "rejected";

const REFUND_WINDOW_DAYS = 7;

const fmtDate = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(s))
    : "—";
const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `R$ ${Number(n).toFixed(2).replace(".", ",")}`;

const daysSince = (s: string) => Math.floor((Date.now() - new Date(s).getTime()) / (1000 * 60 * 60 * 24));

const AdminRefundsPage = () => {
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("pending");

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["admin-profile-refunds", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return data;
    },
  });
  const isAdmin = !!profile;

  const { data: allRefunds = [], isLoading: loadingRefunds } = useQuery({
    queryKey: ["admin-refunds-all"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*")
        .order("requested_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as RefundRow[];
    },
    refetchInterval: 15000,
  });

  const { data: activeSubs = [], isLoading: loadingSubs } = useQuery({
    queryKey: ["admin-subs-eligible"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id,user_id,plan,status,amount,created_at,current_period_end")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as SubRow[];
    },
    refetchInterval: 30000,
  });

  const pending = useMemo(
    () =>
      allRefunds
        .filter((r) => r.status === "pending")
        .slice()
        .sort((a, b) => new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime()),
    [allRefunds],
  );
  const approved = useMemo(
    () => allRefunds.filter((r) => ["approved", "refunded", "completed"].includes(r.status)),
    [allRefunds],
  );
  const rejected = useMemo(() => allRefunds.filter((r) => ["rejected", "denied"].includes(r.status)), [allRefunds]);

  const requestedUserIds = new Set(allRefunds.map((r) => r.user_id));
  const eligible = useMemo(
    () =>
      activeSubs.filter((s) => daysSince(s.created_at) <= REFUND_WINDOW_DAYS && !requestedUserIds.has(s.user_id)),
    [activeSubs, allRefunds],
  );

  const userIds = useMemo(
    () => Array.from(new Set([...allRefunds.map((r) => r.user_id), ...activeSubs.map((s) => s.user_id)])),
    [allRefunds, activeSubs],
  );
  const subIds = useMemo(
    () => Array.from(new Set(allRefunds.map((r) => r.subscription_id).filter(Boolean) as string[])),
    [allRefunds],
  );

  const { data: profiles = {} } = useQuery({
    queryKey: ["admin-refunds-profiles", userIds.join(",")],
    enabled: isAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url, email").in("user_id", userIds);
      const map: Record<string, { display_name: string | null; avatar_url: string | null; email: string | null }> = {};
      (data || []).forEach((p: any) => {
        map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url, email: (p as any).email ?? null };
      });
      return map;
    },
  });

  const { data: subs = {} } = useQuery({
    queryKey: ["admin-refunds-subs", subIds.join(",")],
    enabled: isAdmin && subIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("id, plan, created_at, amount").in("id", subIds);
      const map: Record<string, any> = {};
      (data || []).forEach((s: any) => {
        map[s.id] = s;
      });
      return map;
    },
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: "approve" | "reject" }) => {
      setBusyId(id);
      const { data, error } = await supabase.functions.invoke("admin-refund-action", {
        body: { refund_id: id, action: kind },
      });
      if (error || (data && data.error)) throw new Error((data && data.error) || error?.message || "Falha");
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.kind === "approve" ? "Reembolso aprovado." : "Reembolso recusado.");
      qc.invalidateQueries({ queryKey: ["admin-refunds-all"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
    onSettled: () => setBusyId(null),
  });

  if (loading || loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0a0a0a] p-8 text-center">
          <Lock size={24} className="mx-auto" />
          <h1 className="mt-4 text-[20px] font-bold">Acesso restrito</h1>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; count: number; icon: typeof Clock; accent: string }[] = [
    { key: "pending", label: "Pedidos recentes", count: pending.length, icon: Clock, accent: "text-amber-600 bg-amber-50" },
    { key: "eligible", label: "Ativos elegíveis", count: eligible.length, icon: ShieldCheck, accent: "text-blue-600 bg-blue-50" },
    { key: "approved", label: "Reembolsados", count: approved.length, icon: CheckCircle2, accent: "text-emerald-600 bg-emerald-50" },
    { key: "rejected", label: "Recusados", count: rejected.length, icon: XCircle, accent: "text-red-600 bg-red-50" },
  ];

  return (
    <AdminShell active="refunds" userId={user.id}>
      <div className="min-h-full bg-[#f5f5f4] p-5 text-[#0A0A0A] md:p-8">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
          <header className="flex flex-col gap-4 rounded-3xl border border-[#E5E5E5] bg-white px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">Admin</p>
              <h1 className="text-[24px] font-black tracking-tight">Reembolsos</h1>
              <p className="mt-1 text-[13px] text-[#737373]">
                Contas ativas, pedidos recentes e histórico de reembolsos efetuados.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#737373]">
              <RotateCcw size={14} />
              Janela de elegibilidade: {REFUND_WINDOW_DAYS} dias
            </div>
          </header>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {tabs.map((t) => {
              const active = tab === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-[#0A0A0A] bg-[#0A0A0A] text-white shadow-sm"
                      : "border-[#E5E5E5] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-white/10 text-white" : t.accent}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">{t.label}</p>
                      <p className={`text-[11px] ${active ? "text-white/60" : "text-[#A3A3A3]"}`}>
                        {t.count} {t.count === 1 ? "conta" : "contas"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rounded-3xl border border-[#E5E5E5] bg-white shadow-sm">
            {loadingRefunds || loadingSubs ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : tab === "eligible" ? (
              <EligibleTable rows={eligible} profiles={profiles} />
            ) : tab === "pending" ? (
              <RefundsTable
                rows={pending}
                profiles={profiles}
                subs={subs}
                variant="pending"
                busyId={busyId}
                onApprove={(id) => action.mutate({ id, kind: "approve" })}
                onReject={(id) => action.mutate({ id, kind: "reject" })}
              />
            ) : tab === "approved" ? (
              <RefundsTable rows={approved} profiles={profiles} subs={subs} variant="approved" />
            ) : (
              <RefundsTable rows={rejected} profiles={profiles} subs={subs} variant="rejected" />
            )}
          </div>
        </div>
      </div>
    </AdminShell>
  );
};

const UserCell = ({
  p,
  fallback,
}: {
  p?: { display_name: string | null; avatar_url: string | null; email: string | null };
  fallback: string;
}) => (
  <div className="flex items-center gap-3">
    {p?.avatar_url ? (
      <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
    ) : (
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A0A0A] text-white">
        <UserRound size={16} />
      </div>
    )}
    <div className="min-w-0">
      <p className="truncate font-semibold">{p?.display_name || "Usuário"}</p>
      <p className="truncate text-[11px] text-[#A3A3A3]">{p?.email || fallback}</p>
    </div>
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <div className="px-6 py-16 text-center text-[13px] text-[#737373]">{text}</div>
);

const EligibleTable = ({
  rows,
  profiles,
}: {
  rows: SubRow[];
  profiles: Record<string, { display_name: string | null; avatar_url: string | null; email: string | null }>;
}) => {
  if (rows.length === 0) return <EmptyRow text="Nenhuma conta ativa dentro da janela de reembolso." />;
  return (
    <div className="overflow-hidden rounded-3xl">
      <table className="w-full text-[13px]">
        <thead className="bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wider text-[#737373]">
          <tr>
            <th className="px-4 py-3">Usuário</th>
            <th className="px-4 py-3">Plano</th>
            <th className="px-4 py-3">Valor pago</th>
            <th className="px-4 py-3">Comprou em</th>
            <th className="px-4 py-3">Dias restantes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const daysLeft = Math.max(0, REFUND_WINDOW_DAYS - daysSince(s.created_at));
            return (
              <tr key={s.id} className="border-t border-[#F0F0F0]">
                <td className="px-4 py-3">
                  <UserCell p={profiles[s.user_id]} fallback={s.user_id.slice(0, 8)} />
                </td>
                <td className="px-4 py-3 font-medium">{s.plan || "—"}</td>
                <td className="px-4 py-3">{fmtMoney(s.amount)}</td>
                <td className="px-4 py-3 text-[#525252]">{fmtDate(s.created_at)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {daysLeft} {daysLeft === 1 ? "dia" : "dias"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const RefundsTable = ({
  rows,
  profiles,
  subs,
  variant,
  busyId,
  onApprove,
  onReject,
}: {
  rows: RefundRow[];
  profiles: Record<string, { display_name: string | null; avatar_url: string | null; email: string | null }>;
  subs: Record<string, any>;
  variant: "pending" | "approved" | "rejected";
  busyId?: string | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) => {
  if (rows.length === 0) {
    const t =
      variant === "pending"
        ? "Nenhum pedido de reembolso pendente."
        : variant === "approved"
          ? "Nenhum reembolso efetuado ainda."
          : "Nenhum pedido recusado.";
    return <EmptyRow text={t} />;
  }
  return (
    <div className="overflow-x-auto rounded-3xl">
      <table className="w-full min-w-[900px] text-[13px]">
        <thead className="bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wider text-[#737373]">
          <tr>
            <th className="px-4 py-3">Usuário</th>
            <th className="px-4 py-3">Plano</th>
            <th className="px-4 py-3">Pedido em</th>
            {variant === "pending" && <th className="px-4 py-3">Aguardando</th>}
            {variant === "pending" && <th className="px-4 py-3">Conta há</th>}
            {variant !== "pending" && <th className="px-4 py-3">Processado em</th>}
            <th className="px-4 py-3">Motivo</th>
            <th className="px-4 py-3">Valor</th>
            {variant === "pending" && <th className="px-4 py-3 text-right">Ações</th>}
            {variant !== "pending" && <th className="px-4 py-3">Status</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = profiles[r.user_id];
            const s = r.subscription_id ? subs[r.subscription_id] : null;
            const busy = busyId === r.id;
            const waitingDays = daysSince(r.requested_at);
            const accountDays = s?.created_at ? daysSince(s.created_at) : null;
            const overdue = variant === "pending" && waitingDays >= 2;
            return (
              <tr
                key={r.id}
                className={`border-t border-[#F0F0F0] align-top ${
                  overdue ? "bg-red-50/60" : ""
                }`}
              >
                <td className={`px-4 py-4 ${overdue ? "border-l-4 border-l-red-500" : ""}`}>
                  <UserCell p={p} fallback={r.user_id.slice(0, 8)} />
                </td>
                <td className="px-4 py-4 font-medium">{s?.plan || "—"}</td>
                <td className="px-4 py-4 text-[#525252]">{fmtDate(r.requested_at)}</td>
                {variant === "pending" && (
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        overdue ? "bg-red-100 text-red-700" : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {waitingDays === 0
                        ? "hoje"
                        : `há ${waitingDays} ${waitingDays === 1 ? "dia" : "dias"}`}
                    </span>
                  </td>
                )}
                {variant === "pending" && (
                  <td className="px-4 py-4 text-[#525252]">
                    {accountDays == null
                      ? "—"
                      : `${accountDays} ${accountDays === 1 ? "dia" : "dias"}`}
                  </td>
                )}
                {variant !== "pending" && (
                  <td className="px-4 py-4 text-[#525252]">{fmtDate(r.processed_at)}</td>
                )}
                <td className="max-w-[280px] px-4 py-4">
                  <p className="font-semibold">{r.reason}</p>
                  {r.reason_details && (
                    <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-[#525252]">
                      {r.reason_details}
                    </p>
                  )}
                </td>
                <td className="px-4 py-4 font-semibold">{fmtMoney(Number(r.refund_amount))}</td>
                {variant === "pending" ? (
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={busy}
                        onClick={() => onApprove?.(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                        Aprovar
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onReject?.(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                        Recusar
                      </button>
                    </div>
                  </td>
                ) : (
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        variant === "approved"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AdminRefundsPage;
