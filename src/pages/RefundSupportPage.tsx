import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Clock3, FileText, ShieldCheck } from "lucide-react";
import HelpCenterShell from "@/components/help-center/HelpCenterShell";
import { Breadcrumb } from "@/components/help-center/HelpCenterParts";
import RefundChat from "@/components/help-center/RefundChat";
import { fadeUp } from "@/components/help-center/helpMotion";
import { REFUND_PAGE_PATH } from "@/lib/refundEligibility";

/**
 * Atendimento de reembolso (/ajuda/reembolso). Só se chega aqui pelo link discreto
 * no passo a passo do artigo "Pedir reembolso de uma cobrança". O chat (RefundChat)
 * conversa com a IA da função refund-assistant e envia o pedido pela
 * request-refund, depois que o cliente confirma no cartão.
 */
const RefundSupportPage = () => (
  <HelpCenterShell title="Atendimento de reembolso · Velo" showSupportButton={false}>
    <motion.div initial="hidden" animate="show" variants={fadeUp}>
      <Breadcrumb
        basePath="/ajuda"
        items={[
          { label: "Pagamentos e planos", to: "/ajuda/pagamentos-e-planos" },
          { label: "Pedir reembolso", to: REFUND_PAGE_PATH },
          { label: "Atendimento" },
        ]}
      />
      <h1 className="mt-6 text-[30px] font-medium leading-[1.15] tracking-[-0.02em] text-[#0D0D0D] sm:text-[40px]">
        Atendimento de reembolso
      </h1>
      <p className="mt-3 max-w-[720px] text-[16.5px] leading-[1.6] text-[#3F4652] sm:text-[17.5px]">
        Converse com a atendente sobre a sua cobrança. Ela confere a sua situação, explica as regras e, se der para pedir, monta o
        pedido para você revisar e enviar.
      </p>
    </motion.div>

    <div className="mt-8 grid gap-8 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10">
      <RefundChat />

      <aside className="space-y-5 text-[14.5px] leading-[1.6] text-[#3F4652] lg:pt-1">
        <Dica icone={<Clock3 size={18} aria-hidden="true" />} titulo="Prazo de 7 dias">
          O pedido vale até 7 dias depois da cobrança. Depois disso, ainda dá para cancelar a renovação.
        </Dica>
        <Dica icone={<ShieldCheck size={18} aria-hidden="true" />} titulo="Quem decide é a equipe">
          A atendente é uma IA. Ela não aprova nem recusa: a equipe da Velo analisa cada pedido.
        </Dica>
        <Dica icone={<FileText size={18} aria-hidden="true" />} titulo="Regras completas">
          <Link to={REFUND_PAGE_PATH} className="text-[#2563EB] underline underline-offset-2">
            Leia o artigo sobre reembolso
          </Link>{" "}
          para ver tudo o que acontece com o acesso e os anúncios.
        </Dica>
        <Link to={REFUND_PAGE_PATH} className="inline-flex items-center gap-1.5 text-[14px] text-[#52606D] hover:text-[#2563EB]">
          <ArrowLeft size={15} aria-hidden="true" /> Voltar para o artigo
        </Link>
      </aside>
    </div>
  </HelpCenterShell>
);

function Dica({ icone, titulo, children }: { icone: React.ReactNode; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[8px] bg-[#EFF6FF] text-[#2563EB]">{icone}</span>
      <div>
        <p className="font-medium text-[#0F172A]">{titulo}</p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}

export default RefundSupportPage;
