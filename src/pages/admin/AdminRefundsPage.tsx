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
        <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#0A0A0A] p-8 text-center">
          <Lock size={24} className="mx-auto" strokeWidth={1.5} />
          <h1 className="mt-4 text-[20px] font-bold">Acesso restrito</h1>
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; count: number; icon: typeof Clock; accent: string }[] = [
    { key: "pending", label: "Pedidos recentes", count: pending.length, icon: Clock, accent: "text-amber-500 bg-amber-500/10" },
    { key: "eligible", label: "Ativos elegíveis", count: eligible.length, icon: ShieldCheck, accent: "text-blue-500 bg-blue-500/10" },
    { key: "approved", label: "Reembolsados", count: approved.length, icon: CheckCircle2, accent: "text-white bg-white/10" },
    { key: "rejected", label: "Recusados", count: rejected.length, icon: XCircle, accent: "text-red-500 bg-red-500/10" },
  ];

  return (
    <AdminShell active="refunds" userId={user.id}>
      <div className="min-h-full bg-transparent text-white">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">
          <header className="flex flex-col gap-4 border-b border-white/[0.08] pb-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#8A8A8E]">Admin</p>
              <h1 className="text-[24px] font-semibold tracking-tight text-white mt-1">Reembolsos</h1>
              <p className="mt-1 text-[13px] text-[#8A8A8E]">
                Contas ativas, pedidos recentes e histórico de reembolsos efetuados.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#8A8A8E]">
              <RotateCcw size={14} strokeWidth={1.5} />
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
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                    active
                      ? "border-white/[0.08] bg-white/[0.06] text-white shadow-sm"
                      : "border-white/[0.08] bg-[#161617] text-[#8A8A8E] hover:border-white/20 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${active ? "bg-white/10 text-white" : t.accent}`}>
                      <Icon size={16} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">{t.label}</p>
                      <p className={`text-[11px] ${active ? "text-white/60" : "text-[#8A8A8E]"}`}>
                        {t.count} {t.count === 1 ? "conta" : "contas"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-white/[0.08] pt-4">
            {loadingRefunds || loadingSubs ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-white/60" />
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
      <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
    ) : (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.08] text-white">
        <UserRound size={14} strokeWidth={1.5} />
      </div>
    )}
    <div className="min-w-0">
      <p className="truncate font-medium text-white">{p?.display_name || "Usuário"}</p>
      <p className="truncate text-[11px] text-[#8A8A8E]">{p?.email || fallback}</p>
    </div>
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <div className="px-6 py-16 text-center text-[13px] text-[#8A8A8E]">{text}</div>
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
    <div className="overflow-hidden">
      <table className="w-full text-[13px] text-left">
        <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-[#8A8A8E]">
          <tr>
            <th className="px-4 py-3 font-medium">Usuário</th>
            <th className="px-4 py-3 font-medium">Plano</th>
            <th className="px-4 py-3 font-medium">Valor pago</th>
            <th className="px-4 py-3 font-medium">Comprou em</th>
            <th className="px-4 py-3 font-medium">Dias restantes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.08]">
          {rows.map((s) => {
            const daysLeft = Math.max(0, REFUND_WINDOW_DAYS - daysSince(s.created_at));
            return (
              <tr key={s.id} className="hover:bg-white/[0.01]">
                <td className="px-4 py-3">
                  <UserCell p={profiles[s.user_id]} fallback={s.user_id.slice(0, 8)} />
                </td>
                <td className="px-4 py-3 font-medium text-white">{s.plan || "—"}</td>
                <td className="px-4 py-3 text-white">{fmtMoney(s.amount)}</td>
                <td className="px-4 py-3 text-[#8A8A8E]">{fmtDate(s.created_at)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-lg bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-[11px] font-semibold text-blue-300">
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-[13px] text-left">
        <thead className="border-b border-white/[0.08] text-[11px] uppercase tracking-wider text-[#8A8A8E]">
          <tr>
            <th className="px-4 py-3 font-medium">Usuário</th>
            <th className="px-4 py-3 font-medium">Plano</th>
            <th className="px-4 py-3 font-medium">Pedido em</th>
            {variant === "pending" && <th className="px-4 py-3 font-medium">Aguardando</th>}
            <th className="px-4 py-3 font-medium">Assinatura ativa há</th>
            {variant !== "pending" && <th className="px-4 py-3 font-medium">Processado em</th>}
            <th className="px-4 py-3 font-medium">Motivo</th>
            <th className="px-4 py-3 font-medium">Valor</th>
            {variant === "pending" && <th className="px-4 py-3 font-medium text-right">Ações</th>}
            {variant !== "pending" && <th className="px-4 py-3 font-medium">Status</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.08]">
          {rows.map((r) => {
            const p = profiles[r.user_id];
            const s = r.subscription_id ? subs[r.subscription_id] : null;
            const busy = busyId === r.id;
            const waitingDays = daysSince(r.requested_at);
            const accountDays = s?.created_at ? daysSince(s.created_at) : null;
            const overdue = variant === "pending" && waitingDays >= 2;
            const pastRefundWindow = accountDays != null && accountDays > 7;
            return (
              <tr
                key={r.id}
                className={`align-top transition hover:bg-white/[0.01] ${
                  overdue ? "bg-red-500/[0.06]" : ""
                }`}
              >
                <td className={`px-4 py-4 ${overdue ? "border-l-4 border-l-red-500" : ""}`}>
                  <UserCell p={p} fallback={r.user_id.slice(0, 8)} />
                </td>
                <td className="px-4 py-4 font-medium text-white">{s?.plan || "—"}</td>
                <td className="px-4 py-4 text-[#8A8A8E]">{fmtDate(r.requested_at)}</td>
                {variant === "pending" && (
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        overdue ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      {waitingDays === 0
                        ? "hoje"
                        : `há ${waitingDays} ${waitingDays === 1 ? "dia" : "dias"}`}
                    </span>
                  </td>
                )}
                <td className="px-4 py-4">
                  {accountDays == null ? (
                    <span className="text-[#8A8A8E]">—</span>
                  ) : (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        pastRefundWindow
                          ? "bg-red-500/10 text-red-400"
                          : "bg-white/[0.06] text-white"
                      }`}
                      title={pastRefundWindow ? "Fora da janela de 7 dias — reembolso não obrigatório" : "Dentro da janela de 7 dias"}
                    >
                      {accountDays} {accountDays === 1 ? "dia" : "dias"}
                      {pastRefundWindow ? " • fora do prazo" : ""}
                    </span>
                  )}
                </td>
                {variant !== "pending" && (
                  <td className="px-4 py-4 text-[#8A8A8E]">{fmtDate(r.processed_at)}</td>
                )}
                <td className="max-w-[280px] px-4 py-4">
                  <p className="font-semibold text-white">{r.reason}</p>
                  {r.reason_details && (
                    <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-[#8A8A8E]">
                      {r.reason_details}
                    </p>
                  )}
                </td>

                <td className="px-4 py-4 font-semibold text-white">{fmtMoney(Number(r.refund_amount))}</td>
                {variant === "pending" ? (
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={busy}
                        onClick={() => onApprove?.(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} strokeWidth={1.5} />}
                        Aprovar
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onReject?.(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#161617] text-[#8A8A8E] px-3 py-1.5 text-[12px] font-semibold hover:text-white disabled:opacity-50 transition"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} strokeWidth={1.5} />}
                        Recusar
                      </button>
                    </div>
                  </td>
                ) : (
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                        variant === "approved"
                          ? "bg-white/[0.06] border border-white/15 text-white"
                          : "bg-red-500/10 border border-red-500/20 text-red-300"
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
