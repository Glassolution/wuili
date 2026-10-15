import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, ChevronLeft, Loader2, X } from "lucide-react";
import AtlasSupportIcon from "@/components/dashboard/AtlasSupportIcon";
import { supabase } from "@/integrations/supabase/client";
import { PRAZO_REEMBOLSO, touchSupportTicket, type SupportMessage } from "@/lib/support";
import type { RefundMode, RefundStatus } from "@/lib/refundStatus";

/*
 * Área de reembolso/cancelamento que ocupa o painel inteiro do suporte quando a
 * pessoa toca no botão do cartão. Perguntas: motivo → o que podemos melhorar →
 * última chance de falar com a equipe → confirmar. Dentro de 7 dias do
 * pagamento vira pedido de reembolso (vai para /admin/reembolsos); depois disso
 * só é possível cancelar o plano.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelas de suporte e reembolso ainda fora dos tipos gerados
const db = supabase as any;

const MOTIVOS = [
  "Não consegui vender",
  "Tive problemas técnicos",
  "Achei caro",
  "Estou sem tempo",
  "Não era o que eu esperava",
  "Outro motivo",
];

const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : null);
const fmtValor = (n: number | null) =>
  n == null ? null : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type Passo = "motivo" | "melhorar" | "ultima_chance" | "confirmar" | "enviado";
const PASSOS: Passo[] = ["motivo", "melhorar", "ultima_chance", "confirmar"];

export const SupportRefundFlow = ({
  open,
  userId,
  ticketId,
  status,
  supportHours,
  onClose,
  onMessage,
  onSubmitted,
}: {
  open: boolean;
  userId: string;
  ticketId: string;
  status: RefundStatus | null;
  supportHours: string[];
  onClose: () => void;
  /** Mensagem gravada no ticket (para a conversa aparecer atualizada). */
  onMessage: (message: SupportMessage) => void;
  onSubmitted: () => void;
}) => {
  const reduceMotion = useReducedMotion();
  const [passo, setPasso] = useState<Passo>("motivo");
  const [motivo, setMotivo] = useState("");
  const [outro, setOutro] = useState("");
  const [melhorar, setMelhorar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [modoEnviado, setModoEnviado] = useState<RefundMode | null>(null);

  // cada abertura começa do zero
  useEffect(() => {
    if (!open) return;
    setPasso("motivo");
    setMotivo("");
    setOutro("");
    setMelhorar("");
    setErro(null);
    setModoEnviado(null);
  }, [open]);

  const mode = status?.mode ?? "reembolso";
  const ehReembolso = mode === "reembolso";
  const motivoFinal = motivo === "Outro motivo" ? `Outro: ${outro.trim()}` : motivo;
  const motivoOk = Boolean(motivo) && (motivo !== "Outro motivo" || outro.trim().length >= 3);
  const indice = PASSOS.indexOf(passo);

  const gravarNoTicket = async (texto: string) => {
    const { data, error } = await db
      .from("support_messages")
      .insert({ ticket_id: ticketId, user_id: userId, message: texto, sender: "user" })
      .select("*")
      .single();
    if (error) throw error;
    await touchSupportTicket(ticketId);
    onMessage(data as SupportMessage);
  };

  const falarComEquipe = async () => {
    setEnviando(true);
    setErro(null);
    try {
      await gravarNoTicket(
        [
          "Quero falar com uma pessoa da equipe antes de decidir.",
          motivoFinal ? `Motivo: ${motivoFinal}.` : "",
          melhorar.trim() ? `O que pode melhorar: ${melhorar.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      onClose();
    } catch (error) {
      console.error(error);
      setErro("Não foi possível chamar a equipe agora. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = async () => {
    if (!status?.assinatura) return;
    setEnviando(true);
    setErro(null);
    try {
      const detalhes = [
        `Pedido feito pelo chat de suporte (ticket ${ticketId}).`,
        `Motivo: ${motivoFinal}.`,
        `O que podemos melhorar: ${melhorar.trim() || "não informado"}.`,
      ].join(" ");
      const fn = ehReembolso ? "request-refund" : "cancel-subscription";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { subscription_id: status.assinatura.id, reason: motivoFinal, reason_details: detalhes },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- resposta simples da função
      const resposta = data as any;
      if (error || !resposta?.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- FunctionsHttpError carrega a Response
        const ctx = (error as any)?.context;
        const corpo = ctx?.json ? await ctx.json().catch(() => null) : null;
        setErro(resposta?.error || corpo?.error || "Não foi possível enviar o pedido. Tente de novo.");
        return;
      }

      await gravarNoTicket(
        [
          ehReembolso ? "Pedido de reembolso enviado." : "Cancelamento do plano confirmado.",
          `Motivo: ${motivoFinal}.`,
          melhorar.trim() ? `O que pode melhorar: ${melhorar.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      ).catch((e) => console.error("registro no ticket", e));
      await db.from("support_tickets").update({ category: "reembolso" }).eq("id", ticketId);

      setModoEnviado(mode);
      setPasso("enviado");
      onSubmitted();
    } catch (error) {
      console.error(error);
      setErro("Não foi possível enviar o pedido. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  };

  const voltar = () => {
    if (passo === "enviado" || indice <= 0) onClose();
    else setPasso(PASSOS[indice - 1]);
  };

  const titulo =
    passo === "enviado"
      ? modoEnviado === "reembolso"
        ? "Pedido enviado"
        : "Plano cancelado"
      : ehReembolso
        ? "Pedido de reembolso"
        : "Cancelar plano";

  const fluxoDisponivel = mode === "reembolso" || mode === "cancelamento";

  return (
    <AnimatePresence>
      {open ? (
        <motion.section
          key="refund-flow"
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
          transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 z-20 flex flex-col bg-white"
          aria-label={titulo}
        >
          <header className="flex h-[58px] shrink-0 items-center gap-2 border-b border-black/[0.07] px-3">
            <button
              type="button"
              onClick={voltar}
              disabled={enviando}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#F5F5F5] hover:text-[#111113]"
              aria-label={passo === "motivo" || passo === "enviado" ? "Voltar para a conversa" : "Voltar"}
            >
              <ChevronLeft size={21} strokeWidth={2.1} />
            </button>
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-[-0.025em] text-[#111113]">{titulo}</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[#6B7280] transition hover:bg-[#F5F5F5] hover:text-[#111113]"
              aria-label="Fechar e voltar para a conversa"
            >
              <X size={20} strokeWidth={2.1} />
            </button>
          </header>

          {fluxoDisponivel && passo !== "enviado" ? (
            <div className="flex shrink-0 gap-1.5 px-5 pt-4" aria-hidden="true">
              {PASSOS.map((p, i) => (
                <span
                  key={p}
                  className={`h-1 flex-1 rounded-full ${i <= indice ? (ehReembolso ? "bg-[#DC2626]" : "bg-[#2563EB]") : "bg-[#E5E7EB]"}`}
                />
              ))}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5">
            {!fluxoDisponivel ? (
              <SituacaoAtual status={status} />
            ) : passo === "motivo" ? (
              <>
                <h3 className="text-[19px] font-bold leading-6 tracking-[-0.02em] text-[#111827]">
                  {ehReembolso ? "Qual o motivo do reembolso?" : "Qual o motivo do cancelamento?"}
                </h3>
                <p className="mt-1.5 text-[13px] leading-5 text-[#6B7280]">Escolha a opção que mais combina com você.</p>
                <div className="mt-4 space-y-2" role="radiogroup" aria-label="Motivo">
                  {MOTIVOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      role="radio"
                      aria-checked={motivo === m}
                      onClick={() => setMotivo(m)}
                      className={`flex w-full items-center gap-3 rounded-[14px] border px-3.5 py-3 text-left text-[14px] transition ${
                        motivo === m
                          ? "border-[#2563EB] bg-[#EFF4FF] font-semibold text-[#1D4ED8]"
                          : "border-[#E5E7EB] text-[#374151] hover:border-[#BFD0FF] hover:bg-[#F8FAFF]"
                      }`}
                    >
                      <span
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                          motivo === m ? "border-[#2563EB]" : "border-[#D1D5DB]"
                        }`}
                      >
                        {motivo === m ? <span className="h-2 w-2 rounded-full bg-[#2563EB]" /> : null}
                      </span>
                      {m}
                    </button>
                  ))}
                </div>
                {motivo === "Outro motivo" ? (
                  <input
                    autoFocus
                    value={outro}
                    onChange={(e) => setOutro(e.target.value)}
                    placeholder="Qual foi o motivo?"
                    className="mt-2 h-11 w-full rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 text-[14px] text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB]"
                  />
                ) : null}
              </>
            ) : passo === "melhorar" ? (
              <>
                <h3 className="text-[19px] font-bold leading-6 tracking-[-0.02em] text-[#111827]">O que podemos melhorar?</h3>
                <p className="mt-1.5 text-[13px] leading-5 text-[#6B7280]">
                  Sua resposta vai direto para a equipe e ajuda a deixar a Velo melhor.
                </p>
                <textarea
                  autoFocus
                  value={melhorar}
                  onChange={(e) => setMelhorar(e.target.value)}
                  rows={5}
                  placeholder="Conte com as suas palavras…"
                  className="mt-4 w-full resize-none rounded-[14px] border border-[#E5E7EB] bg-white px-3.5 py-3 text-[14px] leading-5 text-[#111827] outline-none placeholder:text-[#9CA3AF] focus:border-[#2563EB]"
                />
              </>
            ) : passo === "ultima_chance" ? (
              <div className="flex flex-col items-center pt-4 text-center">
                <AtlasSupportIcon size={60} />
                <h3 className="mt-4 text-[19px] font-bold leading-6 tracking-[-0.02em] text-[#111827]">
                  Antes de decidir, quer falar com a nossa equipe?
                </h3>
                <p className="mt-2 max-w-[290px] text-[13.5px] leading-5 text-[#6B7280]">
                  Muitas vezes conseguimos resolver o problema na hora. A conversa continua aqui mesmo.
                </p>
                <p className="mt-3 text-[12px] leading-5 text-[#9CA3AF]">
                  {supportHours.map((linha) => (
                    <span key={linha} className="block">
                      {linha}
                    </span>
                  ))}
                </p>
              </div>
            ) : passo === "confirmar" ? (
              <>
                <h3 className="text-[19px] font-bold leading-6 tracking-[-0.02em] text-[#111827]">
                  {ehReembolso ? "Confirmar pedido de reembolso" : "Confirmar cancelamento"}
                </h3>
                <dl className="mt-4 space-y-2.5 rounded-[14px] border border-[#E5E7EB] p-4 text-[13.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#6B7280]">Motivo</dt>
                    <dd className="text-right font-medium text-[#111827]">{motivoFinal}</dd>
                  </div>
                  {ehReembolso && fmtValor(status?.assinatura?.amount ?? null) ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#6B7280]">Valor</dt>
                      <dd className="font-medium text-[#111827]">{fmtValor(status?.assinatura?.amount ?? null)}</dd>
                    </div>
                  ) : null}
                  {!ehReembolso && fmtData(status?.assinatura?.current_period_end ?? null) ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-[#6B7280]">Acesso até</dt>
                      <dd className="font-medium text-[#111827]">{fmtData(status?.assinatura?.current_period_end ?? null)}</dd>
                    </div>
                  ) : null}
                </dl>
                <div
                  className={`mt-3 rounded-[14px] px-4 py-3 text-[13px] leading-5 ${
                    ehReembolso ? "bg-[#FEF2F2] text-[#991B1B]" : "bg-[#F3F4F6] text-[#374151]"
                  }`}
                >
                  {ehReembolso ? (
                    <>
                      Ao confirmar, sua assinatura é cancelada e o pedido vai para a análise da equipe. {PRAZO_REEMBOLSO} Se
                      aprovado, os anúncios publicados pela Velo no Mercado Livre são encerrados.
                    </>
                  ) : (
                    <>
                      O reembolso só é possível em até 7 dias após o pagamento. Ao cancelar, não haverá novas cobranças e tudo
                      continua funcionando até o fim do período já pago.
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center pt-8 text-center">
                <CheckCircle2 size={48} strokeWidth={1.8} className="text-[#16A34A]" />
                <h3 className="mt-4 text-[19px] font-bold tracking-[-0.02em] text-[#111827]">
                  {modoEnviado === "reembolso" ? "Recebemos o seu pedido" : "Plano cancelado"}
                </h3>
                <p className="mt-2 max-w-[290px] text-[13.5px] leading-5 text-[#6B7280]">
                  {modoEnviado === "reembolso"
                    ? `Nossa equipe vai analisar e te responde aqui mesmo nesta conversa. ${PRAZO_REEMBOLSO}`
                    : `Não haverá novas cobranças. Tudo continua funcionando${
                        fmtData(status?.assinatura?.current_period_end ?? null)
                          ? ` até ${fmtData(status?.assinatura?.current_period_end ?? null)}`
                          : " até o fim do período já pago"
                      }.`}
                </p>
              </div>
            )}
            {erro ? (
              <p className="mt-4 rounded-[12px] bg-[#FEF2F2] px-3.5 py-2.5 text-[13px] text-[#B91C1C]">{erro}</p>
            ) : null}
          </div>

          <footer className="shrink-0 space-y-2 border-t border-black/[0.06] px-5 pb-5 pt-3">
            {!fluxoDisponivel || passo === "enviado" ? (
              <BotaoPrincipal onClick={onClose}>Voltar para a conversa</BotaoPrincipal>
            ) : passo === "motivo" ? (
              <BotaoPrincipal onClick={() => setPasso("melhorar")} disabled={!motivoOk}>
                Continuar
              </BotaoPrincipal>
            ) : passo === "melhorar" ? (
              <BotaoPrincipal onClick={() => setPasso("ultima_chance")}>
                {melhorar.trim() ? "Continuar" : "Pular"}
              </BotaoPrincipal>
            ) : passo === "ultima_chance" ? (
              <>
                <BotaoPrincipal onClick={falarComEquipe} disabled={enviando}>
                  {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
                  Falar com a equipe
                </BotaoPrincipal>
                <button
                  type="button"
                  onClick={() => setPasso("confirmar")}
                  disabled={enviando}
                  className="flex h-10 w-full items-center justify-center rounded-[12px] text-[13.5px] font-bold text-[#DC2626] transition hover:bg-[#FEF2F2]"
                >
                  {ehReembolso ? "Continuar com o reembolso" : "Continuar com o cancelamento"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#DC2626] text-[14px] font-bold text-white transition hover:bg-[#B91C1C] disabled:opacity-60"
              >
                {enviando ? <Loader2 size={16} className="animate-spin" /> : null}
                {ehReembolso ? "Confirmar pedido de reembolso" : "Confirmar cancelamento"}
              </button>
            )}
          </footer>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};

const BotaoPrincipal = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#2563EB] text-[14px] font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-40"
  >
    {children}
  </button>
);

const SituacaoAtual = ({ status }: { status: RefundStatus | null }) => {
  const mode = status?.mode;
  const texto =
    mode === "em_analise"
      ? { titulo: "Seu pedido já está em análise", corpo: `Nossa equipe vai te responder aqui mesmo nesta conversa. ${PRAZO_REEMBOLSO}` }
      : mode === "aprovado"
        ? { titulo: "Seu reembolso já foi aprovado", corpo: PRAZO_REEMBOLSO }
        : mode === "cancelado"
          ? {
              titulo: "Seu plano já está cancelado",
              corpo: `Não haverá novas cobranças. Tudo continua funcionando${
                fmtData(status?.assinatura?.current_period_end ?? null)
                  ? ` até ${fmtData(status?.assinatura?.current_period_end ?? null)}`
                  : " até o fim do período já pago"
              }.`,
            }
          : {
              titulo: "Não encontramos uma assinatura ativa",
              corpo: "Se você foi cobrado, conte aqui na conversa que a nossa equipe verifica para você.",
            };
  return (
    <div className="flex flex-col items-center pt-8 text-center">
      <CheckCircle2 size={44} strokeWidth={1.8} className="text-[#9CA3AF]" />
      <h3 className="mt-4 text-[18px] font-bold tracking-[-0.02em] text-[#111827]">{texto.titulo}</h3>
      <p className="mt-2 max-w-[290px] text-[13.5px] leading-5 text-[#6B7280]">{texto.corpo}</p>
    </div>
  );
};
