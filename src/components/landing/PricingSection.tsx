import { Check, X } from "lucide-react";

const plans = [
  {
    name: "Grátis", price: "0", sub: "/mês", featured: false,
    desc: "Para testar a plataforma e sentir como funciona.",
    features: [
      { text: "Até 5 produtos", included: true },
      { text: "Publicação manual", included: true },
      { text: "Análise de tendências", included: true },
      { text: "IA automática", included: false },
      { text: "Shopee e AliExpress", included: false },
    ],
    cta: "Começar grátis",
  },
  {
    name: "Padrão", price: "99", sub: ",90/mês", featured: true, badge: "Mais popular",
    desc: "IA completa para quem quer resultados reais no Mercado Livre.",
    features: [
      { text: "Até 30 produtos", included: true },
      { text: "IA cria e publica anúncios", included: true },
      { text: "Monitoramento 24h de preços", included: true },
      { text: "Mercado Livre integrado", included: true },
      { text: "Resposta automática clientes", included: false },
    ],
    cta: "Assinar agora",
  },
  {
    name: "Pro", price: "149", sub: ",90/mês", featured: false,
    desc: "Tudo ilimitado, com IA respondendo clientes e multi-plataforma.",
    features: [
      { text: "Produtos ilimitados", included: true },
      { text: "Shopee + AliExpress + ML", included: true },
      { text: "IA responde compradores", included: true },
      { text: "Relatórios avançados", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    cta: "Assinar Pro",
  },
];

const PricingSection = () => (
  <section id="planos" className="relative z-[1] bg-[#111113] py-[120px]">
    <div className="mx-auto max-w-[1100px] px-6 md:px-10">
      <div className="mb-16 text-center">
        <div className="mb-[18px] inline-flex items-center justify-center gap-[6px] text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8ec5ff] before:h-px before:w-5 before:bg-[#8ec5ff] before:content-['']">
          Planos
        </div>
        <h2 className="mx-auto mb-4 font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold leading-[1.12] tracking-[-0.035em] text-white">
          Comece grátis. Escale quando quiser.
        </h2>
      </div>

      <div className="mx-auto grid max-w-[400px] grid-cols-1 gap-5 md:max-w-none md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`relative rounded-[20px] border p-8 transition-all hover:-translate-y-[3px] ${
              plan.featured
                ? "border-white/20 bg-white text-[#0a0a0a] shadow-[0_20px_60px_rgba(255,255,255,0.08)] hover:shadow-[0_24px_64px_rgba(255,255,255,0.12)]"
                : "border-white/[0.06] bg-white/[0.03] hover:shadow-[0_16px_48px_rgba(0,0,0,0.3)]"
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-[14px] py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[#0a0a0a]">
                {plan.badge}
              </div>
            )}
            <div className={`mb-4 font-['Sora'] text-[0.875rem] font-semibold uppercase tracking-[0.06em] ${plan.featured ? "text-[#0a0a0a]/50" : "text-white/30"}`}>
              {plan.name}
            </div>
            <div className={`mb-[6px] font-['Sora'] text-[2.8rem] font-bold leading-none tracking-[-0.04em] ${plan.featured ? "text-[#0a0a0a]" : "text-white"}`}>
              <sup className="mt-2 inline-block align-top text-[1.1rem] font-medium">R$</sup>
              {plan.price}
              <sub className={`text-[0.875rem] font-normal ${plan.featured ? "text-[#0a0a0a]/40" : "text-white/30"}`}>{plan.sub}</sub>
            </div>
            <div className={`mb-7 text-[0.875rem] leading-[1.5] ${plan.featured ? "text-[#0a0a0a]/50" : "text-white/40"}`}>{plan.desc}</div>
            <div className={`mb-6 h-px ${plan.featured ? "bg-[#0a0a0a]/10" : "bg-white/[0.06]"}`} />
            <div className="mb-8 flex flex-col gap-3">
              {plan.features.map((f) => (
                <div key={f.text} className={`flex items-start gap-[10px] text-[0.875rem] font-light ${!f.included ? "opacity-35" : ""} ${plan.featured ? "text-[#0a0a0a]/80" : "text-white/70"}`}>
                  {f.included ? (
                    <Check size={18} className={`mt-[1px] flex-shrink-0 ${plan.featured ? "text-[#0a0a0a]" : "text-[#8ec5ff]"}`} strokeWidth={1.5} />
                  ) : (
                    <X size={18} className="mt-[1px] flex-shrink-0 text-white/20" strokeWidth={1.5} />
                  )}
                  {f.text}
                </div>
              ))}
            </div>
            <button className={`w-full cursor-pointer rounded-full border-none py-[13px] font-['Manrope'] text-[0.9375rem] font-medium tracking-[-0.01em] transition-all ${
              plan.featured
                ? "bg-[#0a0a0a] text-white shadow-[0_4px_20px_rgba(0,0,0,0.15)] hover:bg-[#1a1a1a]"
                : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
            }`}>
              {plan.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default PricingSection;
