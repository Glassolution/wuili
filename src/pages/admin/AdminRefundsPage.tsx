import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Lock, XCircle, UserRound } from "lucide-react";
import { toast } from "sonner";
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
  created_at: string;
};

const fmtDate = (s: string | null) =>
  s ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(s)) : "—";
const fmtMoney = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`;

const AdminRefundsPage = () => {
  const { user, loading } = useAuth();
  const qc = useQueryClient();

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["admin-profile-refunds", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "admin").maybeSingle();
      return data;
    },
  });
  const isAdmin = !!profile;

  const { data: refunds = [], isLoading } = useQuery({
    queryKey: ["admin-refunds-pending"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("refund_requests")
        .select("*")
        .eq("status", "pending")
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RefundRow[];
    },
    refetchInterval: 10000,
  });

  const userIds = useMemo(() => Array.from(new Set(refunds.map((r) => r.user_id))), [refunds]);
  const subIds = useMemo(() => Array.from(new Set(refunds.map((r) => r.subscription_id).filter(Boolean) as string[])), [refunds]);

  const { data: profiles = {} } = useQuery({
    queryKey: ["admin-refunds-profiles", userIds.join(",")],
    enabled: isAdmin && userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, display_name, avatar_url").in("user_id", userIds);
      const map: Record<string, { display_name: string | null; avatar_url: string | null }> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = { display_name: p.display_name, avatar_url: p.avatar_url }; });
      return map;
    },
  });

  const { data: subs = {} } = useQuery({
    queryKey: ["admin-refunds-subs", subIds.join(",")],
    enabled: isAdmin && subIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("id, plan, created_at, amount").in("id", subIds);
      const map: Record<string, any> = {};
      (data || []).forEach((s: any) => { map[s.id] = s; });
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
      qc.invalidateQueries({ queryKey: ["admin-refunds-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-pending-counts"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
    onSettled: () => setBusyId(null),
  });

  if (loading || loadingProfile) {
    return <div className="flex min-h-screen items-center justify-center bg-black"><Loader2 className="h-7 w-7 animate-spin text-white" /></div>;
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

  return (
    <AdminShell active="refunds" userId={user.id}>
      <div className="rounded-[22px] bg-white p-6 text-[#0A0A0A]">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#A3A3A3]">Admin</p>
            <h1 className="text-[24px] font-black tracking-tight">Reembolsos pendentes</h1>
          </div>
          <span className="rounded-full bg-[#0A0A0A] px-4 py-2 text-[13px] font-semibold text-white">{refunds.length} pendentes</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : refunds.length === 0 ? (
          <div className="rounded-2xl border border-[#E5E5E5] bg-[#FAFAFA] p-12 text-center text-[14px] text-[#737373]">
            Nenhum pedido de reembolso pendente.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-[#E5E5E5]">
            <table className="w-full text-[13px]">
              <thead className="bg-[#FAFAFA] text-left text-[11px] uppercase tracking-wider text-[#737373]">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Data compra</th>
                  <th className="px-4 py-3">Pedido em</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((r) => {
                  const p = profiles[r.user_id];
                  const s = r.subscription_id ? subs[r.subscription_id] : null;
                  const busy = busyId === r.id;
                  return (
                    <tr key={r.id} className="border-t border-[#F0F0F0] align-top">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          {p?.avatar_url ? (
                            <img src={p.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0A0A0A] text-white"><UserRound size={16} /></div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold">{p?.display_name || "Usuário"}</p>
                            <p className="truncate text-[11px] text-[#A3A3A3]">{r.user_id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium">{s?.plan || "—"}</td>
                      <td className="px-4 py-4 text-[#525252]">{fmtDate(s?.created_at || null)}</td>
                      <td className="px-4 py-4 text-[#525252]">{fmtDate(r.requested_at)}</td>
                      <td className="px-4 py-4 max-w-[280px]">
                        <p className="font-semibold">{r.reason}</p>
                        {r.reason_details && (
                          <p className="mt-1 text-[12px] leading-5 text-[#525252] whitespace-pre-wrap">{r.reason_details}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 font-semibold">{fmtMoney(Number(r.refund_amount))}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            disabled={busy}
                            onClick={() => action.mutate({ id: r.id, kind: "approve" })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                            Aprovar reembolso
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => action.mutate({ id: r.id, kind: "reject" })}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                            Recusar e manter
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
};

export default AdminRefundsPage;
