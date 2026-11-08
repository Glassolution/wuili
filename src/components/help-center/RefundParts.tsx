import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";
import type { RefundStatus } from "@/lib/refundStatus";
import { CANCEL_PAGE_PATH, PRAZO_DEVOLUCAO, PRAZO_REEMBOLSO, REFUND_WINDOW_DAYS } from "@/lib/refundEligibility";
import {
  describeRefundEvent,
  REFUND_STAGE_LABEL,
  refundStage,
  type RefundEvent,
  type RefundRequestRow,
} from "@/lib/refundRequestHistory";

/*
  Peças do reembolso na Central de Ajuda: conta logada, elegibilidade,
  situação do pedido com histórico, avisos e botões. Usadas pelo atendimento
  de reembolso (RefundChat, /ajuda/reembolso).
*/

const PLAN_LABEL: Record<string, string> = { go: "Go", base: "Base", plus: "Pro", pro: "Pro", business: "Business" };

const DAY = 86_400_000;
export const fmtData = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");
const fmtDataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtValor = (n: number | null | undefined) =>
  n == null ? "—" : Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const nomePlano = (plan: string | null, lifetime: boolean) =>
  `${plan ? PLAN_LABEL[plan.toLowerCase()] ?? plan : "Velo"}${lifetime ? " vitalício" : ""}`;

/* ── Peças ──────────────────────────────────────────────────────────────────── */

export const campo =
  "block w-full rounded-[10px] border border-[#D4D9E0] bg-white px-3 text-[15px] text-[#0F172A] outline-none transition placeholder:text-[#8A94A3] focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15";

export function ContaLogada({ email, onSair, sandbox }: { email: string; onSair: () => void; sandbox: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[14px] text-[#52606D]">
      <p className="flex items-center gap-2">
        <ShieldCheck size={16} className="text-[#2563EB]" aria-hidden="true" />
        Logado como <strong className="font-medium text-[#0F172A]">{email}</strong>
        {sandbox ? <span className="rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-semibold text-[#1E3A8A]">Sandbox</span> : null}
      </p>
      <button type="button" onClick={onSair} className="text-[#2563EB] underline-offset-2 hover:underline">
        Não é a conta cobrada? Sair
      </button>
    </div>
  );
}

export function ResumoElegibilidade({
  assinatura,
  modo,
}: {
  assinatura: NonNullable<RefundStatus["assinatura"]>;
  modo: RefundStatus["mode"] | undefined;
}) {
  const inicio = new Date(assinatura.created_at).getTime();
  const fim = new Date(inicio + REFUND_WINDOW_DAYS * DAY).toISOString();
  const dentro = modo === "reembolso";
  const situacao =
    modo === "reembolso" ? "Dentro do prazo"
    : modo === "em_analise" ? "Pedido em análise"
    : modo === "aprovado" ? "Reembolso já aprovado"
    : "Fora do prazo";
  return (
    <div>
      <h3 className="text-[17px] font-medium text-[#0F172A]">Sua elegibilidade</h3>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-[#E4E7EB] bg-[#E4E7EB] sm:grid-cols-4">
        <Celula rotulo="Plano" valor={nomePlano(assinatura.plan, assinatura.purchase_kind === "lifetime")} />
        <Celula rotulo="Data da cobrança" valor={fmtData(assinatura.created_at)} />
        <Celula rotulo="Valor" valor={fmtValor(assinatura.amount)} />
        <Celula
          rotulo={`Prazo de ${REFUND_WINDOW_DAYS} dias`}
          valor={situacao}
          detalhe={`${new Date(fim).getTime() > Date.now() ? "até" : "terminou em"} ${fmtData(fim)}`}
          tom={dentro ? "ok" : "neutro"}
        />
      </dl>
    </div>
  );
}

export function ForaDoPrazo({ modo }: { modo: RefundStatus["mode"] | undefined }) {
  if (modo === "em_analise" || modo === "aprovado" || modo === "sem_assinatura" || !modo) return null;
  const texto =
    modo === "vitalicio"
      ? "O prazo de 7 dias para reembolso do seu plano vitalício já passou. Como não há renovação, não há nada a cancelar."
      : modo === "cancelado"
        ? "Esta assinatura não pode mais ser reembolsada, e a renovação já está cancelada: não haverá novas cobranças e o acesso segue até o fim do período já pago."
        : "Esta assinatura não pode mais ser reembolsada: o prazo de 7 dias terminou ou você já recebeu um reembolso antes. Você ainda pode cancelar a renovação para não ser cobrado de novo.";
  return (
    <div>
      <Aviso tom="neutro" icone={<Clock size={18} aria-hidden="true" />}>{texto}</Aviso>
      {modo === "cancelamento" ? (
        <Link
          to={CANCEL_PAGE_PATH}
          className="mt-4 inline-flex h-11 items-center rounded-full border border-[#D4D9E0] px-5 text-[15px] text-[#0F172A] transition hover:border-[#2563EB] hover:text-[#2563EB]"
        >
          Cancelar a renovação
        </Link>
      ) : null}
      <p className="mt-4 text-[14px] text-[#52606D]">
        Foi cobrado em duplicidade ou depois de cancelar? Isso é tratado à parte, sem prazo: veja{" "}
        <Link to="/ajuda/pagamentos-e-planos/cobranca-nao-reconhecida" className="text-[#2563EB] underline underline-offset-2">
          Cobrança que não reconheço
        </Link>
        .
      </p>
    </div>
  );
}

export function SituacaoDoPedido({ pedido, historico }: { pedido: RefundRequestRow; historico: RefundEvent[] }) {
  const etapa = refundStage(pedido.status);
  const icone =
    etapa === "aprovado" ? <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
    : etapa === "recusado" ? <XCircle size={18} className="text-[#B91C1C]" aria-hidden="true" />
    : <Clock size={18} className="text-amber-600" aria-hidden="true" />;
  const explicacao =
    etapa === "aprovado" ? PRAZO_DEVOLUCAO
    : etapa === "recusado" ? "Você mantém o acesso até o fim do período já pago."
    : PRAZO_REEMBOLSO;
  // Eventos antigos (antes do histórico existir) podem faltar: o pedido em si sempre aparece.
  const eventos = historico.length
    ? historico
    : [{ id: "abertura", refund_request_id: pedido.id, kind: "created", from_status: null, to_status: "pending", message: pedido.reason, actor_role: "customer", visible_to_customer: true, created_at: pedido.requested_at } as RefundEvent];

  return (
    <div className="rounded-[12px] border border-[#E4E7EB] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[16px] font-medium text-[#0F172A]">
          {icone} Seu pedido de {fmtData(pedido.requested_at)}
        </h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${
            etapa === "aprovado" ? "bg-emerald-50 text-emerald-700" : etapa === "recusado" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"
          }`}
        >
          {REFUND_STAGE_LABEL[etapa]}
        </span>
      </div>
      <p className="mt-2 text-[14.5px] leading-[1.55] text-[#3F4652]">{explicacao}</p>
      {pedido.admin_response ? (
        <blockquote className="mt-3 rounded-[10px] bg-[#F8FAFC] px-4 py-3 text-[14.5px] leading-[1.55] text-[#0F172A]">
          <span className="mb-1 block text-[12.5px] font-medium text-[#52606D]">Resposta da equipe</span>
          {pedido.admin_response}
        </blockquote>
      ) : null}
      <ol className="mt-4 space-y-3 border-l border-[#E4E7EB] pl-4">
        {eventos.map((evento) => (
          <li key={evento.id} className="relative text-[14px]">
            <span aria-hidden="true" className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-[#2563EB]" />
            <p className="text-[#0F172A]">{describeRefundEvent(evento, "customer")}</p>
            {evento.message && evento.kind !== "created" ? <p className="mt-0.5 text-[#3F4652]">{evento.message}</p> : null}
            {evento.kind === "created" && evento.message ? <p className="mt-0.5 text-[#52606D]">Motivo: {evento.message}</p> : null}
            <p className="mt-0.5 text-[12.5px] text-[#8A94A3]">{fmtDataHora(evento.created_at)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Celula({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: string; detalhe?: string; tom?: "ok" | "neutro" }) {
  return (
    <div className="min-w-0 bg-white px-4 py-3.5">
      <dt className="text-[12.5px] text-[#52606D]">{rotulo}</dt>
      <dd className={`mt-1 text-[15.5px] font-medium tabular-nums ${tom === "ok" ? "text-emerald-700" : "text-[#0F172A]"}`}>
        {valor}
        {detalhe ? <span className="mt-0.5 block text-[12.5px] font-normal text-[#52606D]">{detalhe}</span> : null}
      </dd>
    </div>
  );
}

export function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="grid gap-1 px-4 py-3 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="text-[#52606D]">{rotulo}</dt>
      <dd className="whitespace-pre-line break-words text-[#0F172A]">{valor}</dd>
    </div>
  );
}

export function SimNao({
  legenda,
  nome,
  valor,
  onChange,
}: {
  legenda: string;
  nome: string;
  valor: "" | "sim" | "nao";
  onChange: (v: "sim" | "nao") => void;
}) {
  return (
    <fieldset>
      <legend className="text-[15px] font-medium text-[#0F172A]">{legenda}</legend>
      <div className="mt-2 flex gap-2">
        {(["sim", "nao"] as const).map((opcao) => (
          <label
            key={opcao}
            className={`flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-[10px] border text-[15px] transition ${
              valor === opcao ? "border-[#2563EB] bg-[#EFF6FF] text-[#0F172A]" : "border-[#E4E7EB] text-[#3F4652] hover:border-[#C7D2E0]"
            }`}
          >
            <input type="radio" name={nome} checked={valor === opcao} onChange={() => onChange(opcao)} className="size-4 accent-[#2563EB]" />
            {opcao === "sim" ? "Sim" : "Não"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Aviso({ tom, icone, children }: { tom: "erro" | "neutro"; icone: ReactNode; children: ReactNode }) {
  return (
    <div
      role={tom === "erro" ? "alert" : undefined}
      className={`flex gap-3 rounded-[10px] px-4 py-3 text-[14.5px] leading-[1.55] ${
        tom === "erro" ? "bg-red-50 text-red-800" : "bg-[#F8FAFC] text-[#3F4652]"
      }`}
    >
      <span className="mt-0.5 shrink-0">{icone}</span>
      <p>{children}</p>
    </div>
  );
}

export function BotaoPrincipal({
  children,
  onClick,
  type = "button",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#2563EB] px-6 text-[15px] font-medium text-white transition hover:bg-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function BotaoSecundario({
  children,
  onClick,
  disabled,
  className = "",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[#D4D9E0] px-5 text-[15px] text-[#0F172A] transition hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}
