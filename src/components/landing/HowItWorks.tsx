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
    <section id="como-funciona" className="relative z-[1] bg-[#111113] py-[120px]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="mb-[18px] inline-flex items-center gap-[6px] text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8ec5ff] before:h-px before:w-5 before:bg-[#8ec5ff] before:content-['']">
          Como funciona
        </div>
        <h2 className="mb-4 max-w-[580px] font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold leading-[1.12] tracking-[-0.035em] text-white">
          Da escolha do nicho ao <em className="not-italic text-[#8ec5ff]">lucro</em>, em minutos
        </h2>
        <p className="max-w-[480px] text-base font-light leading-[1.65] text-white/50">
          Você faz uma coisa. A IA faz o resto. Sem curva de aprendizado, sem adivinhação.
        </p>

        <div className="mt-16 grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-[80px]">
          <div className="flex flex-col">
            {steps.map((step, i) => (
              <div
                key={i}
                onClick={() => setActive(i)}
                className={`flex cursor-pointer gap-5 py-7 transition-all ${i < steps.length - 1 ? "border-b border-white/[0.06]" : ""} ${i === 0 ? "pt-0" : ""}`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] font-['Sora'] text-[0.8125rem] font-bold transition-all ${active === i ? "bg-white text-[#0a0a0a]" : "bg-white/[0.06] text-white/30"}`}>
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="mb-[6px] font-['Sora'] text-[0.9375rem] font-semibold tracking-[-0.02em] text-white">{step.title}</div>
                  <div className="text-[0.875rem] font-light leading-[1.6] text-white/50">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[20px] border border-white/[0.08] bg-[#1a1a1d] shadow-[0_24px_60px_rgba(0,0,0,0.4)]" style={{ aspectRatio: "4/3" }}>
            <div className="flex items-center gap-2 border-b border-white/[0.06] bg-[#151516] px-4 py-3">
              <div className="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <div className="h-2 w-2 rounded-full bg-[#febc2e]" />
              <div className="h-2 w-2 rounded-full bg-[#28c840]" />
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="mb-1 font-['Sora'] text-[0.75rem] font-semibold uppercase tracking-[0.04em] text-white/40">Produtos sugeridos pela IA</div>
              {mockProducts.map((p, i) => (
                <div key={i} className={`flex items-center justify-between rounded-lg bg-white/[0.04] px-4 py-[14px] ${p.faded ? "opacity-50" : ""}`}>
                  <div className="flex flex-col gap-1">
                    <span className="inline-block w-fit rounded-full bg-[#8ec5ff]/10 px-2 py-[2px] text-[0.6875rem] font-medium text-[#8ec5ff]">{p.badge}</span>
                    <span className="font-['Sora'] text-[0.8125rem] font-semibold text-white">{p.name}</span>
                    <span className="text-[0.6875rem] text-white/40">{p.sub}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-['Sora'] text-[0.9rem] font-bold text-white">{p.price}</div>
                    <span className="mt-1 inline-block rounded-full bg-[#16a34a]/20 px-2 py-[2px] text-[0.6875rem] font-medium text-[#4ade80]">{p.margin}</span>
                  </div>
                </div>
              ))}
              <div className="mt-auto flex gap-2">
                <div className="flex-1 cursor-pointer rounded-lg bg-white py-[10px] text-center font-['Sora'] text-[0.75rem] font-semibold text-[#0a0a0a] transition-colors hover:bg-white/90">Aprovar selecionados</div>
                <div className="flex w-10 cursor-pointer items-center justify-center rounded-lg bg-white/[0.06] text-base text-white/60 transition-colors hover:bg-white/[0.1]">↻</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
