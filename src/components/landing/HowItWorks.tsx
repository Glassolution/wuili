import { useState } from "react";

const steps = [
  { title: "Escolha seu nicho", desc: "Moda, eletrônicos, beleza ou casa. Só isso. 30 segundos de trabalho da sua parte." },
  { title: "A IA escaneia o mercado", desc: "Analisa o Mercado Livre em tempo real — alta demanda, baixa concorrência, margem acima de 40%." },
  { title: "Anúncio criado automaticamente", desc: "Título com SEO, descrição, fotos do fornecedor e preço com margem já calculada. Pronto para publicar." },
  { title: "Você aprova com um clique", desc: "Revisa o anúncio, clica em publicar — ou pede ajuste. O controle é sempre seu." },
  { title: "IA monitora e ajusta 24h", desc: "Preços, concorrentes e perguntas dos compradores. Tudo gerenciado sem você precisar fazer nada." },
];

const mockProducts = [
  { badge: "Alta demanda", name: "Suporte Veicular Magnético", sub: "842 vendas/mês · Shopee + ML", price: "R$ 49,90", margin: "Margem 47%" },
  { badge: "Tendência", name: "Kit Skincare Coreano 5 Itens", sub: "1.2k vendas/mês · ML", price: "R$ 89,90", margin: "Margem 52%" },
  { badge: "Estável", name: "Luminária LED de Mesa", sub: "534 vendas/mês · ML", price: "R$ 67,00", margin: "Margem 41%", faded: true },
];

const HowItWorks = () => {
  const [active, setActive] = useState(0);

  return (
    <section id="como-funciona" className="relative z-[1] py-[120px]">
      <div className="max-w-[1100px] mx-auto px-6 md:px-10">
        <div className="inline-flex items-center gap-[6px] text-[0.75rem] font-medium text-[#7C3AED] tracking-[0.08em] uppercase mb-[18px] before:content-[''] before:w-5 before:h-px before:bg-[#7C3AED]">
          Como funciona
        </div>
        <h2 className="font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold tracking-[-0.035em] leading-[1.12] text-[#0A0A0A] max-w-[580px] mb-4">
          Da escolha do nicho ao <em className="not-italic text-[#7C3AED]">lucro</em>, em minutos
        </h2>
        <p className="text-base font-light text-[#6B6B6B] max-w-[480px] leading-[1.65]">
          Você faz uma coisa. A IA faz o resto. Sem curva de aprendizado, sem adivinhação.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-[80px] items-center mt-16">
          <div className="flex flex-col">
            {steps.map((step, i) => (
              <div
                key={i}
                onClick={() => setActive(i)}
                className={`flex gap-5 py-7 cursor-pointer transition-all ${i < steps.length - 1 ? "border-b border-[rgba(0,0,0,0.07)]" : ""} ${i === 0 ? "pt-0" : ""}`}
              >
                <div className={`w-9 h-9 rounded-[10px] flex-shrink-0 flex items-center justify-center font-['Sora'] text-[0.8125rem] font-bold transition-all ${active === i ? "bg-[#7C3AED] text-white" : "bg-[#F4F4F4] text-[#999]"}`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="font-['Sora'] text-[0.9375rem] font-semibold text-[#0A0A0A] mb-[6px] tracking-[-0.02em]">{step.title}</div>
                  <div className="text-[0.875rem] font-light text-[#6B6B6B] leading-[1.6]">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white border border-[rgba(0,0,0,0.1)] rounded-[20px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.08)]" style={{ aspectRatio: "4/3" }}>
            <div className="bg-[#F7F7F7] border-b border-[rgba(0,0,0,0.07)] px-4 py-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
              <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
              <div className="w-2 h-2 rounded-full bg-[#28C840]" />
            </div>
            <div className="flex-1 p-5 flex flex-col gap-3">
              <div className="font-['Sora'] text-[0.75rem] font-semibold text-[#6B6B6B] mb-1 tracking-[0.04em] uppercase">Produtos sugeridos pela IA</div>
              {mockProducts.map((p, i) => (
                <div key={i} className={`bg-[#F4F4F4] rounded-lg px-4 py-[14px] flex items-center justify-between ${p.faded ? "opacity-50" : ""}`}>
                  <div className="flex flex-col gap-1">
                    <span className="inline-block w-fit px-2 py-[2px] rounded-full text-[0.6875rem] font-medium bg-[rgba(124,58,237,0.1)] text-[#7C3AED]">{p.badge}</span>
                    <span className="font-['Sora'] text-[0.8125rem] font-semibold text-[#0A0A0A]">{p.name}</span>
                    <span className="text-[0.6875rem] text-[#6B6B6B]">{p.sub}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-['Sora'] text-[0.9rem] font-bold text-[#0A0A0A]">{p.price}</div>
                    <span className="inline-block px-2 py-[2px] rounded-full text-[0.6875rem] font-medium mt-1 bg-[#DCFCE7] text-[#16A34A]">{p.margin}</span>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-auto">
                <div className="flex-1 bg-[#7C3AED] rounded-lg py-[10px] text-center text-[0.75rem] font-semibold text-white font-['Sora'] cursor-pointer hover:bg-[#9F67FF] transition-colors">Aprovar selecionados</div>
                <div className="w-10 bg-[#F4F4F4] rounded-lg flex items-center justify-center text-base cursor-pointer hover:bg-[#E8E8E8] transition-colors">↻</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
