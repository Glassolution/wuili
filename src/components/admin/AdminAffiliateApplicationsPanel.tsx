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
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-300" },
  approved: { label: "Aprovada", className: "bg-emerald-500/10 text-emerald-300" },
  rejected: { label: "Rejeitada", className: "bg-red-500/10 text-red-300" },
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
  <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center text-[13px] text-white/45">{children}</div>
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        onClick={(event) => event.stopPropagation()}
        className="h-full w-full max-w-[720px] overflow-y-auto border-l border-white/[0.08] bg-[#0A0A0B] text-white shadow-[0_0_70px_rgba(0,0,0,0.65)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#0A0A0B]/95 px-6 py-4 backdrop-blur">
          <button type="button" onClick={onClose} className="flex items-center gap-2 text-[12px] text-white/60 transition hover:text-white">
            <X size={14} /> Fechar
          </button>
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", meta.className)}>{meta.label}</span>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[24px] font-bold tracking-[-0.03em] text-white">{applicantName(application)}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-white/45">
              {application.email || "Sem e-mail"}
              {application.code ? (
                <>
                  {" "}
                  · Código <span className="font-mono text-white/70">{application.code}</span>
                </>
              ) : null}{" "}
              · Enviada em {dateFmt(application.created_at)}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/45">Cadastro enviado</h2>
            <AffiliateApplicationCard application={application} />
          </section>

          {application.status === "pending" ? (
            <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-white/10 bg-black/20 p-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide("reject", application)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-[12px] font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
              >
                <X size={13} /> Rejeitar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecide("approve", application)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-[13px] text-white/45">
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
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
      <div className="border-b border-white/10 bg-white/[0.04] px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Solicitações de afiliados</p>
        <h2 className="mt-2 text-[22px] font-bold tracking-[-0.03em] text-white">Aprovação de cadastros</h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-white/45">
          Clique em um pedido para ver o formulário completo e decidir. Ao aprovar, o afiliado é liberado e a página de comissões dele destrava.
        </p>
      </div>

      <div className="space-y-4 p-5">
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
          <Empty>Não foi possível carregar as solicitações.</Empty>
        ) : rows.length === 0 ? (
          <Empty>Nenhuma solicitação nesse filtro.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-left text-[13px]">
              <thead className="bg-white/[0.04] text-[11px] uppercase tracking-[0.14em] text-white/35">
                <tr>
                  <th className="px-4 py-3">Solicitante</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Data do pedido</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
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
                      className="cursor-pointer text-white/80 transition hover:bg-white/[0.04] focus:bg-white/[0.05] focus:outline-none"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{applicantName(row)}</p>
                        {row.code ? <p className="font-mono text-[12px] text-white/40">{row.code}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-white/60">{row.email || "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-white/55">{dateFmt(row.created_at)}</td>
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
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
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
                              className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
                            >
                              {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
                            </button>
                          </div>
                        ) : (
                          <span className="text-[12px] text-white/35">{dateFmt(row.updated_at)}</span>
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
