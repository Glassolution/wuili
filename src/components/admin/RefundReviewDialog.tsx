import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageSquare, StickyNote, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  describeRefundEvent,
  fetchRefundEvents,
  REFUND_STAGE_LABEL,
  refundStage,
} from "@/lib/refundRequestHistory";

/*
  Análise de um pedido de reembolso no admin: dados do pedido, histórico
  completo (inclusive anotações internas) e as ações. Toda ação passa pela
  função admin-refund-action, que confere o papel de admin no servidor.

  - Aprovar: estorna, encerra o plano e os anúncios (mensagem ao cliente opcional).
  - Recusar: exige mensagem explicando o motivo ao cliente.
  - Responder: manda mensagem ao cliente sem mudar o status.
  - Anotação interna: só a equipe vê.
*/

export type RefundReviewAction = "approve" | "reject" | "respond" | "note";

export type RefundReviewRow = {
  id: string;
  status: string;
  reason: string;
  reason_details: string | null;
  refund_amount: number;
  requested_at: string;
  admin_response?: string | null;
  source?: string | null;
};

const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const fmtMoney = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SOURCE_LABEL: Record<string, string> = {
  help_center: "Central de Ajuda",
  settings: "Configurações (tela antiga)",
  admin: "Admin",
};

export function RefundReviewDialog({
  row,
  customer,
  busy,
  onClose,
  onAction,
}: {
  row: RefundReviewRow | null;
  customer: string;
  busy: boolean;
  onClose: () => void;
  onAction: (action: RefundReviewAction, message: string) => Promise<unknown>;
}) {
  const [message, setMessage] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-refund-events", row?.id],
    enabled: Boolean(row),
    queryFn: () => fetchRefundEvents(row ? [row.id] : []),
  });

  if (!row) return null;
  const stage = refundStage(row.status);
  const pending = stage === "pendente";

  const run = async (action: RefundReviewAction, text: string) => {
    setError(null);
    if ((action === "reject" || action === "respond") && !text.trim()) {
      setError(action === "reject" ? "Escreva para o cliente o motivo da recusa." : "Escreva a mensagem para o cliente.");
      return;
    }
    if (action === "note" && !text.trim()) {
      setError("Escreva a anotação.");
      return;
    }
    if (action === "approve" && !window.confirm("Aprovar estorna o valor, encerra o plano e os anúncios publicados pela Velo. Confirmar?")) return;
    try {
      await onAction(action, text.trim());
      if (action === "note") setNote("");
      else setMessage("");
      await refetch();
      if (action === "approve" || action === "reject") onClose();
    } catch (e) {
      setError((e as Error)?.message || "Não foi possível concluir.");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Pedido de reembolso
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                stage === "aprovado" ? "bg-emerald-50 text-emerald-700" : stage === "recusado" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
              }`}
            >
              {REFUND_STAGE_LABEL[stage]}
            </span>
          </DialogTitle>
          <DialogDescription>
            {customer} · {fmtMoney(Number(row.refund_amount))} · pedido em {fmtDataHora(row.requested_at)}
            {row.source ? ` · via ${SOURCE_LABEL[row.source] ?? row.source}` : ""}
          </DialogDescription>
        </DialogHeader>

        <section className="rounded-xl border border-[#E5E7EB] p-4 text-[13px]">
          <p className="font-semibold text-[#171715]">{row.reason}</p>
          {row.reason_details ? <p className="mt-1 whitespace-pre-wrap leading-5 text-[#475467]">{row.reason_details}</p> : null}
          {row.admin_response ? (
            <p className="mt-3 rounded-lg bg-[#F8FAFC] px-3 py-2 text-[#171715]">
              <span className="block text-[11px] font-semibold text-[#667085]">Última resposta ao cliente</span>
              {row.admin_response}
            </p>
          ) : null}
        </section>

        <section>
          <h3 className="text-[13px] font-semibold text-[#171715]">Histórico</h3>
          {isLoading ? (
            <p className="mt-2 text-[12px] text-[#667085]">Carregando…</p>
          ) : events.length === 0 ? (
            <p className="mt-2 text-[12px] text-[#667085]">Sem eventos registrados (pedido anterior ao histórico).</p>
          ) : (
            <ol className="mt-2 space-y-2.5 border-l border-[#E5E7EB] pl-4">
              {events.map((event) => (
                <li key={event.id} className="relative text-[12.5px]">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[21px] top-1.5 size-2 rounded-full ${event.kind === "note" ? "bg-amber-500" : "bg-[#2563EB]"}`}
                  />
                  <p className="font-medium text-[#171715]">
                    {describeRefundEvent(event, "admin")}
                    <span className="ml-1.5 font-normal text-[#98A2B3]">
                      · {event.actor_role === "admin" ? "equipe" : event.actor_role === "customer" ? "cliente" : "sistema"}
                      {event.visible_to_customer ? "" : " · interno"}
                    </span>
                  </p>
                  {event.message ? <p className="mt-0.5 whitespace-pre-wrap text-[#475467]">{event.message}</p> : null}
                  <p className="mt-0.5 text-[11px] text-[#98A2B3]">{fmtDataHora(event.created_at)}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="space-y-2">
          <label htmlFor="resposta-cliente" className="text-[13px] font-semibold text-[#171715]">
            Mensagem para o cliente
          </label>
          <textarea
            id="resposta-cliente"
            rows={3}
            maxLength={4000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={pending ? "Obrigatória para recusar; opcional ao aprovar. O cliente vê nas notificações e no artigo." : "O cliente vê nas notificações e no artigo de reembolso."}
            className="w-full resize-y rounded-lg border border-[#E5E7EB] p-3 text-[13px] outline-none focus:border-[#2563EB]"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("respond", message)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 py-2 text-[12px] font-semibold text-[#344054] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              <MessageSquare size={13} aria-hidden="true" /> Só responder
            </button>
            {pending ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run("reject", message)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} aria-hidden="true" />} Recusar
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run("approve", message)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} aria-hidden="true" />} Aprovar e estornar
                </button>
              </>
            ) : null}
          </div>
        </section>

        <section className="space-y-2 border-t border-[#EEF2F7] pt-4">
          <label htmlFor="anotacao-interna" className="text-[13px] font-semibold text-[#171715]">
            Anotação interna <span className="font-normal text-[#98A2B3]">(o cliente não vê)</span>
          </label>
          <div className="flex gap-2">
            <input
              id="anotacao-interna"
              maxLength={4000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: conferi o uso da conta, nenhuma venda."
              className="h-10 flex-1 rounded-lg border border-[#E5E7EB] px-3 text-[13px] outline-none focus:border-[#2563EB]"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("note", note)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] px-3 text-[12px] font-semibold text-[#344054] hover:bg-[#F8FAFC] disabled:opacity-50"
            >
              <StickyNote size={13} aria-hidden="true" /> Salvar
            </button>
          </div>
        </section>

        {error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
