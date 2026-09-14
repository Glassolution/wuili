import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type WithdrawalRow = {
  id: string;
  affiliate_code: string;
  amount: number;
  status: string;
  pix_key: string | null;
  pix_key_type: string | null;
  admin_note: string | null;
  requested_at: string;
  decided_at: string | null;
  paid_at: string | null;
  cancelled_at: string | null;
  display_name: string | null;
  email: string | null;
  items_count: number;
};

const FILTERS = [
  { key: "pending", label: "Pendentes" },
  { key: "approved", label: "Aprovados" },
  { key: "paid", label: "Pagos" },
  { key: "all", label: "Todos" },
] as const;

const money = (n: number | null | undefined) =>
  `R$ ${Number(n ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const dateFmt = (s: string | null | undefined) =>
  s
    ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(s))
    : "—";

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Em análise", className: "border border-[#FDE7B2] bg-[#FFF7E6] text-[#B7791F]" },
  approved: { label: "Aprovado", className: "border border-[#D9E4FF] bg-[#EFF6FF] text-[#2563EB]" },
  paid: { label: "Pago", className: "border border-[#BBF7D0] bg-[#ECFDF3] text-[#087443]" },
  rejected: { label: "Rejeitado", className: "border border-red-200 bg-red-50 text-red-600" },
  cancelled: { label: "Cancelado", className: "border border-[#DDE3EE] bg-[#F8FAFC] text-[#64748B]" },
};

const ERROR_MESSAGES: Record<string, string> = {
  not_admin: "Ação restrita a administradores.",
  not_found: "Solicitação não encontrada.",
  invalid_transition: "Esta solicitação não permite essa ação no status atual.",
  invalid_action: "Ação inválida.",
};

export const AdminWithdrawalsPanel = () => {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-withdrawal-requests", filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_withdrawal_requests" as never, {
        p_status: filter,
      } as never);
      if (error) throw error;
      return ((data as unknown as { requests?: WithdrawalRow[] })?.requests ?? []) as WithdrawalRow[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, action, note }: { id: string; action: "approve" | "reject" | "pay"; note?: string }) => {
      const { error } = await supabase.rpc("rpc_admin_withdrawal_decide" as never, {
        p_id: id,
        p_action: action,
        p_note: note ?? null,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Solicitação atualizada." });
      void queryClient.invalidateQueries({ queryKey: ["admin-withdrawal-requests"] });
    },
    onError: (err: unknown) => {
      const raw = String((err as { message?: string })?.message ?? "");
      const key = Object.keys(ERROR_MESSAGES).find((code) => raw.includes(code));
      toast({
        title: key ? ERROR_MESSAGES[key] : "Não foi possível atualizar a solicitação.",
        variant: "destructive",
      });
    },
    onSettled: () => setBusyId(null),
  });

  const run = (id: string, action: "approve" | "reject" | "pay", confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusyId(id);
    decide.mutate({ id, action });
  };

  const rows = data ?? [];

  return (
    <section className="overflow-hidden rounded-[18px] border border-[#E6EAF2] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#EEF1F6] bg-[#F8FAFC] px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A8F9B]">Solicitações de saque</p>
        <h2 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-[#171715]">Repasses de afiliados</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#64748B]">
          Aprove pedidos, marque pagamentos Pix como concluídos e acompanhe o histórico de cada solicitação.
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-[#DDE3EE] bg-white p-1 shadow-sm sm:w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-[12px] font-semibold transition",
                filter === f.key ? "bg-[#2563EB] text-white" : "text-[#64748B] hover:bg-[#EFF6FF] hover:text-[#2563EB]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-[#64748B]">
            <Loader2 size={16} className="animate-spin" /> Carregando solicitações…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-dashed border-[#DDE3EE] bg-[#F8FAFC] p-6 text-center text-[13px] text-[#64748B]">
            Não foi possível carregar as solicitações de saque.
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#DDE3EE] bg-[#F8FAFC] p-6 text-center text-[13px] text-[#64748B]">
            Nenhuma solicitação nesse filtro.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => {
              const meta = STATUS[row.status] ?? STATUS.pending;
              const busy = busyId === row.id;
              return (
                <div key={row.id} className="rounded-2xl border border-[#E6EAF2] bg-white p-4 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-semibold text-[#171715]">
                          {row.display_name || row.email || row.affiliate_code}
                        </p>
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.className)}>
                          {meta.label}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] text-[#64748B]">
                        {row.email || "—"} · Código <span className="font-mono font-semibold text-[#2563EB]">{row.affiliate_code}</span> ·{" "}
                        {row.items_count} comissão(ões)
                      </p>
                      <p className="mt-1 text-[12px] text-[#64748B]">
                        Solicitado em {dateFmt(row.requested_at)}
                        {row.decided_at ? ` · Decidido em ${dateFmt(row.decided_at)}` : ""}
                        {row.paid_at ? ` · Pago em ${dateFmt(row.paid_at)}` : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[#64748B]">
                        <span className="rounded-lg border border-[#DDE3EE] bg-[#F8FAFC] px-2 py-1">
                          Pix ({row.pix_key_type || "chave"}): <span className="font-mono text-[#273449]">{row.pix_key || "—"}</span>
                        </span>
                        {row.pix_key ? (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(row.pix_key ?? "");
                              toast({ title: "Chave Pix copiada." });
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#DDE3EE] bg-white px-2 py-1 text-[#64748B] transition hover:border-[#C7D7FE] hover:text-[#2563EB]"
                          >
                            <Copy size={12} /> Copiar
                          </button>
                        ) : null}
                      </div>
                      {row.admin_note ? <p className="mt-2 text-[12px] text-[#8A8F9B]">Nota: {row.admin_note}</p> : null}
                    </div>

                    <div className="flex flex-col items-end gap-3">
                      <p className="text-[22px] font-bold leading-none tracking-[-0.03em] text-[#171715]">{money(row.amount)}</p>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {row.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(row.id, "approve")}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(row.id, "reject", "Rejeitar esta solicitação de saque?")}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              <X size={13} /> Rejeitar
                            </button>
                          </>
                        ) : null}
                        {row.status === "approved" ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(row.id, "pay", `Confirmar pagamento de ${money(row.amount)}?`)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#087443] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#066137] disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Marcar como pago
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => run(row.id, "reject", "Rejeitar esta solicitação já aprovada?")}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              <X size={13} /> Rejeitar
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminWithdrawalsPanel;
