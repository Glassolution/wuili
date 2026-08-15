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
  pending: { label: "Em análise", className: "bg-amber-500/10 text-amber-300" },
  approved: { label: "Aprovado", className: "bg-blue-500/10 text-blue-300" },
  paid: { label: "Pago", className: "bg-emerald-500/10 text-emerald-300" },
  rejected: { label: "Rejeitado", className: "bg-red-500/10 text-red-300" },
  cancelled: { label: "Cancelado", className: "bg-white/[0.06] text-white/50" },
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1 sm:w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-4 py-1.5 text-[12px] font-semibold transition",
              filter === f.key ? "bg-white text-black" : "text-white/60 hover:text-white",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/50">
          <Loader2 size={16} className="animate-spin" /> Carregando solicitações…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-[13px] text-white/45">
          Não foi possível carregar as solicitações de saque.
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-[13px] text-white/45">
          Nenhuma solicitação nesse filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => {
            const meta = STATUS[row.status] ?? STATUS.pending;
            const busy = busyId === row.id;
            return (
              <div key={row.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[15px] font-semibold text-white">
                        {row.display_name || row.email || row.affiliate_code}
                      </p>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", meta.className)}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] text-white/45">
                      {row.email || "—"} · Código <span className="font-mono text-white/70">{row.affiliate_code}</span> ·{" "}
                      {row.items_count} comissão(ões)
                    </p>
                    <p className="mt-1 text-[12px] text-white/45">
                      Solicitado em {dateFmt(row.requested_at)}
                      {row.decided_at ? ` · Decidido em ${dateFmt(row.decided_at)}` : ""}
                      {row.paid_at ? ` · Pago em ${dateFmt(row.paid_at)}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-white/60">
                      <span className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1">
                        Pix ({row.pix_key_type || "chave"}): <span className="font-mono">{row.pix_key || "—"}</span>
                      </span>
                      {row.pix_key ? (
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(row.pix_key ?? "");
                            toast({ title: "Chave Pix copiada." });
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-white/60 transition hover:text-white"
                        >
                          <Copy size={12} /> Copiar
                        </button>
                      ) : null}
                    </div>
                    {row.admin_note ? <p className="mt-2 text-[12px] text-white/40">Nota: {row.admin_note}</p> : null}
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <p className="text-[22px] font-bold leading-none tracking-[-0.03em] text-white">{money(row.amount)}</p>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {row.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(row.id, "approve")}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(row.id, "reject", "Rejeitar esta solicitação de saque?")}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12px] font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
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
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-400 px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-emerald-300 disabled:opacity-50"
                          >
                            {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Marcar como pago
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => run(row.id, "reject", "Rejeitar esta solicitação já aprovada?")}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12px] font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
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
    </section>
  );
};

export default AdminWithdrawalsPanel;
