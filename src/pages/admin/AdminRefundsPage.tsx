import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Lock, XCircle, UserRound, Clock, ShieldCheck, RotateCcw } from "lucide-react";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/admin/AdminShell";
import { VeloLoadingScreen } from "@/components/ui/velo-loading-screen";

type RefundRow = {
  id: string;
  user_id: string;
  subscription_id: string | null;
  charge_id: string | null;
  reason: string;
  reason_details: string | null;
  status: string;
  refund_amount: number;
  requested_at: string;
  processed_at: string | null;
  provider_response: Record<string, unknown> | null;
  created_at: string;
};

type SubRow = {
  id: string;
  user_id: string;
  validapay_charge_id: string | null;
  payment_method: string | null;
  plan: string;
  status: string;
  amount: number | null;
  created_at: string;
  current_period_end: string | null;
};

type TabKey = "pending" | "processing" | "eligible" | "approved" | "rejected";

const REFUND_WINDOW_DAYS = 7;

const fmtDate = (s: string | null) =>
  s
    ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(s))
    : "—";
const fmtMoney = (n: number | null | undefined) =>
  n == null ? "—" : `R$ ${Number(n).toFixed(2).replace(".", ",")}`;
const fmtPaymentMethod = (value: string | null | undefined) => {
  const normalized = normalizeStatus(value);
  if (!normalized) return "—";
  if (normalized.includes("pix")) return "Pix";
  if (normalized.includes("card") || normalized.includes("cartao") || normalized.includes("cartão") || normalized.includes("credit")) {
    return "Cartão";
  }
  if (normalized.includes("boleto")) return "Boleto";
  if (normalized.includes("manual")) return "Manual";
  return value ?? "—";
};

const daysSince = (s: string) => Math.floor((Date.now() - new Date(s).getTime()) / (1000 * 60 * 60 * 24));
const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const getProviderRefundStatus = (refund: RefundRow) => {
  const response = refund.provider_response;
  if (!response) return "";

  const nested = response.provider_status_response;
  if (nested && typeof nested === "object" && "status" in nested) {
    return normalizeStatus((nested as Record<string, unknown>).status);
  }

  return normalizeStatus(response.status);
};

const isRefundInProgress = (refund: RefundRow) => {
  const status = normalizeStatus(refund.status);
  const providerStatus = getProviderRefundStatus(refund);

  if (["processing", "in_process", "in_progress", "em_processo"].includes(status)) return true;

  return (
    status === "processed" &&
    ["processing", "pending", "in_process", "in_progress", "created", "queued", "requested", "authorized"].includes(providerStatus)
  );
};

const isRefundCompleted = (refund: RefundRow) => {
  if (isRefundInProgress(refund)) return false;
  return ["approved", "processed", "refunded", "completed", "success", "confirmed"].includes(normalizeStatus(refund.status));
};

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
        .select("id,user_id,validapay_charge_id,payment_method,plan,status,amount,created_at,current_period_end")
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
    () => allRefunds.filter(isRefundCompleted),
    [allRefunds],
  );
  const processing = useMemo(
    () => allRefunds.filter(isRefundInProgress),
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
      const { data } = await supabase
        .from("subscriptions")
        .select("id, plan, created_at, amount, validapay_charge_id, payment_method")
        .in("id", subIds);
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
    return <VeloLoadingScreen message="Carregando reembolsos..." />;
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
    { key: "pending", label: "Pedidos recentes", count: pending.length, icon: Clock, accent: "text-amber-700 bg-amber-100" },
    { key: "processing", label: "Em processo", count: processing.length, icon: RotateCcw, accent: "text-blue-700 bg-blue-100" },
    { key: "eligible", label: "Ativos elegíveis", count: eligible.length, icon: ShieldCheck, accent: "text-emerald-700 bg-emerald-100" },
    { key: "approved", label: "Reembolsados", count: approved.length, icon: CheckCircle2, accent: "text-slate-700 bg-slate-100" },
    { key: "rejected", label: "Recusados", count: rejected.length, icon: XCircle, accent: "text-red-700 bg-red-100" },
  ];

  return (
    <AdminShell
      active="refunds"
      userId={user.id}
      title="Reembolsos"
      subtitle="Contas ativas, pedidos recentes e histórico de reembolsos efetuados."
      actions={
        <div className="flex items-center gap-2 text-[12px] text-[#8A8A8E]">
          <RotateCcw size={14} strokeWidth={1.5} />
          Janela de elegibilidade: {REFUND_WINDOW_DAYS} dias
        </div>
      }
    >
      <div className="min-h-full bg-transparent text-[#171715]">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-6">

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {tabs.map((t) => {
              const active = tab === t.key;
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-[#2563EB] bg-[#EFF6FF] text-[#0F172A] shadow-[0_14px_35px_rgba(37,99,235,0.10)]"
                      : "border-[#E5E7EB] bg-white text-[#667085] shadow-sm hover:border-[#B8C7E8] hover:text-[#0F172A]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-[#2563EB] text-white" : t.accent}`}>
                      <Icon size={16} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold">{t.label}</p>
                      <p className={`text-[11px] ${active ? "text-[#475569]" : "text-[#8A8A8E]"}`}>
                        {t.count} {t.count === 1 ? "conta" : "contas"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-[#EFEFEB] pt-4">
            {loadingRefunds || loadingSubs ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
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
            ) : tab === "processing" ? (
              <>
                <p className="mb-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[12px] text-blue-800">
                  Reembolsos em processo já foram enviados ao provedor e aguardam confirmação automática.
                </p>
                <RefundsTable rows={processing} profiles={profiles} subs={subs} variant="processing" />
              </>
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
  chargeId,
}: {
  p?: { display_name: string | null; avatar_url: string | null; email: string | null };
  fallback: string;
  chargeId?: string | null;
}) => (
  <div className="flex items-center gap-3">
    {p?.avatar_url ? (
      <img src={p.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
    ) : (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFF6FF] text-[#2563EB]">
        <UserRound size={14} strokeWidth={1.5} />
      </div>
    )}
    <div className="min-w-0">
      <p className="truncate font-semibold text-[#171715]">{p?.display_name || "Usuário"}</p>
      <p className="truncate text-[11px] text-[#8A8A8E]">{p?.email || fallback}</p>
      <p className="mt-0.5 max-w-[220px] truncate font-mono text-[10.5px] font-semibold text-[#2563EB]">
        charge_id: {chargeId?.trim() ? chargeId : "—"}
      </p>
    </div>
  </div>
);

const EmptyRow = ({ text }: { text: string }) => (
  <div className="rounded-2xl border border-dashed border-[#D9DDE7] bg-[#F8FAFC] px-6 py-16 text-center text-[13px] text-[#667085]">{text}</div>
);

const PaymentMethodBadge = ({ value }: { value?: string | null }) => {
  const label = fmtPaymentMethod(value);
  const normalized = normalizeStatus(value);
  const className = normalized.includes("pix")
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalized.includes("card") || normalized.includes("cartao") || normalized.includes("cartão") || normalized.includes("credit")
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : normalized.includes("manual")
        ? "border-slate-200 bg-slate-50 text-slate-700"
        : "border-[#E5E7EB] bg-white text-[#667085]";

  return (
    <span className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  );
};

const EligibleTable = ({
  rows,
  profiles,
}: {
  rows: SubRow[];
  profiles: Record<string, { display_name: string | null; avatar_url: string | null; email: string | null }>;
}) => {
  if (rows.length === 0) return <EmptyRow text="Nenhuma conta ativa dentro da janela de reembolso." />;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <table className="w-full text-[13px] text-left">
        <thead className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-[#667085]">
          <tr>
            <th className="px-4 py-3 font-medium">Usuário</th>
            <th className="px-4 py-3 font-medium">Plano</th>
            <th className="px-4 py-3 font-medium">Forma de pagamento</th>
            <th className="px-4 py-3 font-medium">Valor pago</th>
            <th className="px-4 py-3 font-medium">Comprou em</th>
            <th className="px-4 py-3 font-medium">Dias restantes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#EEF2F7]">
          {rows.map((s) => {
            const daysLeft = Math.max(0, REFUND_WINDOW_DAYS - daysSince(s.created_at));
            return (
              <tr key={s.id} className="hover:bg-[#F8FAFC]">
                <td className="px-4 py-3">
                  <UserCell p={profiles[s.user_id]} fallback={s.user_id.slice(0, 8)} chargeId={s.validapay_charge_id} />
                </td>
                <td className="px-4 py-3 font-semibold text-[#171715]">{s.plan || "—"}</td>
                <td className="px-4 py-3">
                  <PaymentMethodBadge value={s.payment_method} />
                </td>
                <td className="px-4 py-3 font-medium text-[#171715]">{fmtMoney(s.amount)}</td>
                <td className="px-4 py-3 text-[#8A8A8E]">{fmtDate(s.created_at)}</td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
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
  variant: "pending" | "processing" | "approved" | "rejected";
  busyId?: string | null;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}) => {
  if (rows.length === 0) {
    const t =
      variant === "pending"
        ? "Nenhum pedido de reembolso pendente."
        : variant === "processing"
          ? "Nenhum reembolso em processo."
        : variant === "approved"
          ? "Nenhum reembolso efetuado ainda."
          : "Nenhum pedido recusado.";
    return <EmptyRow text={t} />;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
      <table className="w-full min-w-[1120px] text-left text-[13px]">
        <thead className="border-b border-[#E5E7EB] bg-[#F8FAFC] text-[11px] uppercase tracking-wider text-[#667085]">
          <tr>
            <th className="px-4 py-3 font-medium">Usuário</th>
            <th className="px-4 py-3 font-medium">Plano</th>
            <th className="px-4 py-3 font-medium">Forma de pagamento</th>
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
        <tbody className="divide-y divide-[#EEF2F7]">
          {rows.map((r) => {
            const p = profiles[r.user_id];
            const s = r.subscription_id ? subs[r.subscription_id] : null;
            const busy = busyId === r.id;
            const waitingDays = daysSince(r.requested_at);
            const accountDays = s?.created_at ? daysSince(s.created_at) : null;
            const overdue = variant === "pending" && waitingDays >= 2;
            const pastRefundWindow = accountDays != null && accountDays > 7;
            const statusTone =
              variant === "processing"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : variant === "approved"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700";
            const statusLabel =
              variant === "processing"
                ? "Em processo"
                : variant === "approved"
                  ? "Reembolsado"
                  : variant === "rejected"
                    ? "Recusado"
                    : r.status;
            return (
              <tr
                key={r.id}
                className={`align-top transition hover:bg-[#F8FAFC] ${overdue ? "bg-red-50" : ""}`}
              >
                <td className={`px-4 py-4 ${overdue ? "border-l-4 border-l-red-500" : ""}`}>
                  <UserCell p={p} fallback={r.user_id.slice(0, 8)} chargeId={r.charge_id ?? s?.validapay_charge_id ?? null} />
                </td>
                <td className="px-4 py-4 font-semibold text-[#171715]">{s?.plan || "—"}</td>
                <td className="px-4 py-4">
                  <PaymentMethodBadge value={s?.payment_method} />
                </td>
                <td className="px-4 py-4 text-[#667085]">{fmtDate(r.requested_at)}</td>
                {variant === "pending" && (
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        overdue ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"
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
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                        pastRefundWindow
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                      title={pastRefundWindow ? "Fora da janela de 7 dias — reembolso não obrigatório" : "Dentro da janela de 7 dias"}
                    >
                      {accountDays} {accountDays === 1 ? "dia" : "dias"}
                      {pastRefundWindow ? " • fora do prazo" : ""}
                    </span>
                  )}
                </td>
                {variant !== "pending" && (
                  <td className="px-4 py-4 text-[#667085]">{fmtDate(r.processed_at)}</td>
                )}
                <td className="max-w-[280px] px-4 py-4">
                  <p className="font-semibold text-[#171715]">{r.reason}</p>
                  {r.reason_details && (
                    <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-[#667085]">
                      {r.reason_details}
                    </p>
                  )}
                </td>

                <td className="px-4 py-4 font-semibold text-[#171715]">{fmtMoney(Number(r.refund_amount))}</td>
                {variant === "pending" ? (
                  <td className="px-4 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        disabled={busy}
                        onClick={() => onApprove?.(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#1D4ED8] disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} strokeWidth={1.5} />}
                        Aprovar
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onReject?.(r.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#475569] shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} strokeWidth={1.5} />}
                        Recusar
                      </button>
                    </div>
                  </td>
                ) : (
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${statusTone}`}
                    >
                      {statusLabel}
                    </span>
                    {variant === "approved" && (
                      <p className="mt-1 text-[11px] leading-4 text-[#8A8A8E]">
                        Em processo no banco emissor — prazo de até 30 dias para aparecer na fatura do cliente.
                      </p>
                    )}
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
