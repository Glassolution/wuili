import { Link } from "react-router-dom";
import { REFUND_CHAT_PATH } from "@/lib/refundEligibility";

/**
 * Link discreto do artigo de reembolso para o atendimento (/ajuda/reembolso).
 * O artigo novo já traz o link no próprio texto (passo 2 de "Como funciona o
 * atendimento"); este bloco só atende quem ainda usa os marcadores
 * [[atendimento-reembolso]] ou [[formulario-reembolso]] (HelpArticleNote).
 * De propósito, é uma frase comum, sem cartão nem botão.
 */
export default function RefundChatLink() {
  return (
    <p className="my-5 text-[16px] leading-[1.7] text-[#3F4652]">
      Para pedir, abra o{" "}
      <Link
        to={REFUND_CHAT_PATH}
        className="text-[#2563EB] underline decoration-[#2563EB]/40 underline-offset-[3px] hover:decoration-[#2563EB]"
      >
        atendimento de reembolso
      </Link>{" "}
      com você logado na conta que foi cobrada.
    </p>
  );
}
