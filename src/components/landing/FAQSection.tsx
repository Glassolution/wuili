import { HelpCircle } from "lucide-react";

const faqs = [
  {
    question: "A Velo é um aplicativo para computador ou celular?",
    answer:
      "Não. A Velo funciona pela web, direto no navegador. Você acessa a plataforma, importa produtos, configura anúncios e acompanha pedidos pelo painel online.",
  },
  {
    question: "Posso publicar produtos no Mercado Livre pela Velo?",
    answer:
      "Sim. Depois de conectar sua conta do Mercado Livre, a Velo prepara o anúncio com título, preço, descrição e imagem para você publicar com mais velocidade.",
  },
  {
    question: "O plano gratuito permite publicar?",
    answer:
      "O plano gratuito permite explorar o catálogo, favoritar produtos e configurar preços. Para publicar no Mercado Livre, é necessário estar em um plano pago.",
  },
  {
    question: "Como os pedidos aparecem na plataforma?",
    answer:
      "Quando uma venda é recebida pelo Mercado Livre, a Velo registra o pedido e mostra as informações importantes para você acompanhar o envio e a entrega.",
  },
  {
    question: "Shopee e TikTok Shop já estão disponíveis?",
    answer:
      "Ainda não. Mercado Livre é a integração ativa no momento. Shopee e TikTok Shop estão no roadmap e aparecem como próximas plataformas.",
  },
  {
    question: "Onde encontro suporte?",
    answer:
      "Usuários logados podem acessar Configurações e abrir o suporte dentro da plataforma. A central também permite acionar atendimento humano quando necessário.",
  },
];

const FAQSection = () => {
  return (
    <section id="faq" className="scroll-mt-28 bg-white px-6 py-24 md:px-8">
      <div className="mx-auto max-w-[1120px]">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/[0.03] px-4 py-2 font-['Manrope'] text-[12px] font-semibold uppercase tracking-[0.14em] text-black/55">
              <HelpCircle className="h-4 w-4 text-black" />
              FAQ
            </div>
            <h2 className="font-['Manrope'] text-[clamp(2.25rem,5vw,4.25rem)] font-[800] leading-[0.98] tracking-[-0.045em] text-[#0a0a0a]">
              Perguntas frequentes
            </h2>
          </div>
          <p className="max-w-[420px] font-['Manrope'] text-[15px] leading-[1.65] text-[#6b7280]">
            Respostas rápidas sobre como a Velo funciona hoje, sem prometer apps ou integrações que ainda não estão disponíveis.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {faqs.map((faq) => (
            <article
              key={faq.question}
              className="rounded-[18px] border border-black/[0.08] bg-[#fafafa] p-6 transition hover:border-black/[0.16] hover:bg-white"
            >
              <h3 className="mb-3 font-['Manrope'] text-[18px] font-[750] leading-tight tracking-[-0.015em] text-[#0a0a0a]">
                {faq.question}
              </h3>
              <p className="font-['Manrope'] text-[14.5px] leading-[1.65] text-[#666]">
                {faq.answer}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQSection;
