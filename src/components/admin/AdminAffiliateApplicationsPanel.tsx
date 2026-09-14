import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import AffiliateApplicationCard, { type ApplicationRow } from "@/components/admin/AffiliateApplicationCard";

type ApplicationStatus = "pending" | "approved" | "rejected";

export type AffiliateApplication = ApplicationRow & {
  user_id: string;
  code: string;
  status: ApplicationStatus;
  agreed_terms: boolean;
  updated_at: string | null;
  is_active: boolean;
};

const FILTERS = [
  { key: "pending", label: "Pendentes" },
  { key: "approved", label: "Aprovadas" },
  { key: "rejected", label: "Rejeitadas" },
  { key: "all", label: "Todas" },
] as const;

const STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "border border-[#FDE7B2] bg-[#FFF7E6] text-[#B7791F]" },
  approved: { label: "Aprovada", className: "border border-[#BBF7D0] bg-[#ECFDF3] text-[#087443]" },
  rejected: { label: "Rejeitada", className: "border border-red-200 bg-red-50 text-red-600" },
};

const ERROR_MESSAGES: Record<string, string> = {
  not_admin: "Ação restrita a administradores.",
  not_found: "Solicitação não encontrada.",
  invalid_affiliate: "Solicitação inválida.",
  invalid_status: "Filtro inválido.",
};

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

const applicantName = (row: Pick<AffiliateApplication, "full_name" | "email" | "code">) =>
  row.full_name?.trim() || row.email?.trim() || (row.code ? `Afiliado ${row.code}` : "Solicitante");

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-dashed border-[#DDE3EE] bg-[#F8FAFC] p-6 text-center text-[13px] text-[#64748B]">
    {children}
  </div>
);

const ApplicationDetailDrawer = ({
  application,
  onClose,
  onDecide,
  busy,
}: {
  application: AffiliateApplication | null;
  onClose: () => void;
  onDecide: (action: "approve" | "reject", row: AffiliateApplication) => void;
  busy: boolean;
}) => {
  if (!application) return null;

  const meta = STATUS[application.status] ?? STATUS.pending;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35 backdrop-blur-sm" onClick={onClose}>
      <aside
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-[720px] overflow-y-auto border-l border-[#E6EAF2] bg-white text-[#171715] shadow-[0_0_70px_rgba(15,23,42,0.18)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#EEF1F6] bg-white/95 px-6 py-4 backdrop-blur">
          <button type="button" onClick={onClose} className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] transition hover:text-[#171715]">
            <X size={14} /> Fechar
          </button>
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", meta.className)}>{meta.label}</span>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section className="rounded-2xl border border-[#E6EAF2] bg-[#F8FAFC] p-5">
            <p className="text-[24px] font-bold tracking-[-0.03em] text-[#171715]">{applicantName(application)}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
              {application.email || "Sem e-mail"}
              {application.code ? (
                <>
                  {" "}
                  · Código <span className="font-mono font-semibold text-[#2563EB]">{application.code}</span>
                </>
              ) : null}{" "}
              · Enviada em {dateFmt(application.created_at)}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#8A8F9B]">Cadastro enviado</h2>
            <AffiliateApplicationCard application={application} />
          </section>

          {application.status === "pending" ? (
            <div className="sticky bottom-0 -mx-6 mt-2 flex flex-col gap-2 border-t border-[#EEF1F6] bg-white/95 px-6 py-4 backdrop-blur sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide("reject", application)}
                className="inline-flex h-10 min-w-[116px] items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-white px-4 text-[12px] font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                <X size={13} /> Rejeitar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide("approve", application)}
                className="inline-flex h-10 min-w-[116px] items-center justify-center gap-1.5 rounded-xl bg-[#2563EB] px-4 text-[12px] font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8] disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E6EAF2] bg-[#F8FAFC] p-4 text-[13px] text-[#64748B]">
              Solicitação já {application.status === "approved" ? "aprovada" : "rejeitada"} em {dateFmt(application.updated_at)}.
              {application.status === "rejected" ? " O afiliado pode reenviar o formulário." : ""}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export const AdminAffiliateApplicationsPanel = () => {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("pending");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-affiliate-applications", filter],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rpc_admin_affiliate_applications" as never, {
        p_status: filter,
      } as never);
      if (error) throw error;
      return ((data as unknown as { applications?: AffiliateApplication[] })?.applications ?? []) as AffiliateApplication[];
    },
  });

  const rows = useMemo(() => data ?? [], [data]);
  const selected = useMemo(() => rows.find((row) => row.user_id === selectedUserId) ?? null, [rows, selectedUserId]);

  const decide = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: "approve" | "reject" }) => {
      const rpc = action === "approve" ? "rpc_admin_accept_affiliate_application" : "rpc_admin_reject_affiliate_application";
      const { error } = await supabase.rpc(rpc as never, { p_user_id: userId } as never);
      if (error) throw error;
    },
    onSuccess: async (_result, { action }) => {
      toast({
        title: action === "approve" ? "Solicitação aprovada." : "Solicitação rejeitada.",
        description:
          action === "approve"
            ? "O afiliado foi liberado e já aparece em “Por afiliado”."
            : "O afiliado pode reenviar o formulário.",
      });
      setSelectedUserId(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-affiliate-applications"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-affiliates-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-affiliate-details"] }),
      ]);
    },
    onError: (err: unknown) => {
      const raw = String((err as { message?: string })?.message ?? "");
      const key = Object.keys(ERROR_MESSAGES).find((code) => raw.includes(code));
      toast({
        title: key ? ERROR_MESSAGES[key] : "Não foi possível atualizar a solicitação.",
        variant: "destructive",
      });
    },
  });

  const run = (action: "approve" | "reject", row: AffiliateApplication) => {
    if (action === "reject" && !window.confirm(`Rejeitar a solicitação de ${applicantName(row)}?`)) return;
    decide.mutate({ userId: row.user_id, action });
  };

  const busyUserId = decide.isPending ? (decide.variables?.userId ?? null) : null;

  return (
    <section className="overflow-hidden rounded-[18px] border border-[#E6EAF2] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#EEF1F6] bg-[#F8FAFC] px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8A8F9B]">Solicitações de afiliados</p>
        <h2 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-[#171715]">Aprovação de cadastros</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[#64748B]">
          Clique em um pedido para ver o formulário completo e decidir. Ao aprovar, o afiliado é liberado e a página de comissões dele destrava.
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
          <Empty>Não foi possível carregar as solicitações.</Empty>
        ) : rows.length === 0 ? (
          <Empty>Nenhuma solicitação nesse filtro.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#E6EAF2]">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-[#F8FAFC] text-[11px] uppercase tracking-[0.14em] text-[#8A8F9B]">
                <tr>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Data do pedido</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF1F6]">
                {rows.map((row) => {
                  const meta = STATUS[row.status] ?? STATUS.pending;
                  const busy = busyUserId === row.user_id;
                  return (
                    <tr
                      key={row.user_id}
                      onClick={() => setSelectedUserId(row.user_id)}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedUserId(row.user_id);
                        }
                      }}
                      className="cursor-pointer text-[#64748B] transition hover:bg-[#F8FAFC] focus:bg-[#F8FAFC] focus:outline-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[#171715]">{applicantName(row)}</p>
                        {row.code ? <p className="font-mono text-[12px] text-[#8A8F9B]">{row.code}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-[#64748B]">{row.email || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[#64748B]">{dateFmt(row.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", meta.className)}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.status === "pending" ? (
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation();
                                run("reject", row);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                            >
                              <X size={13} /> Rejeitar
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={(event) => {
                                event.stopPropagation();
                                run("approve", row);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-[#2563EB] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
                            </button>
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#8A8F9B]">{dateFmt(row.updated_at)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ApplicationDetailDrawer
        application={selected}
        onClose={() => setSelectedUserId(null)}
        onDecide={run}
        busy={busyUserId === selected?.user_id}
      />
    </section>
  );
};

export default AdminAffiliateApplicationsPanel;
