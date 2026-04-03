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
  <section id="planos" className="relative z-[1] py-[120px] bg-white">
    <div className="max-w-[1100px] mx-auto px-6 md:px-10">
      <div className="text-center mb-16">
        <div className="inline-flex items-center justify-center gap-[6px] text-[0.75rem] font-medium text-[#7C3AED] tracking-[0.08em] uppercase mb-[18px] before:content-[''] before:w-5 before:h-px before:bg-[#7C3AED]">
          Planos
        </div>
        <h2 className="font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold tracking-[-0.035em] leading-[1.12] text-[#0A0A0A] mx-auto mb-4">
          Comece grátis. Escale quando quiser.
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[400px] md:max-w-none mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.name}
            className={`border rounded-[20px] p-8 relative transition-all hover:-translate-y-[3px] ${
              plan.featured
                ? "border-[#7C3AED] bg-[#0A0A0A] text-white shadow-[0_20px_60px_rgba(124,58,237,0.2)] hover:shadow-[0_24px_64px_rgba(124,58,237,0.25)]"
                : "border-[rgba(0,0,0,0.07)] bg-white hover:shadow-[0_16px_48px_rgba(0,0,0,0.07)]"
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#7C3AED] text-white text-[0.6875rem] font-semibold tracking-[0.06em] uppercase px-[14px] py-1 rounded-full">
                {plan.badge}
              </div>
            )}
            <div className={`font-['Sora'] text-[0.875rem] font-semibold uppercase tracking-[0.06em] mb-4 ${plan.featured ? "text-white/50" : "text-[#6B6B6B]"}`}>
              {plan.name}
            </div>
            <div className={`font-['Sora'] text-[2.8rem] font-bold tracking-[-0.04em] leading-none mb-[6px] ${plan.featured ? "text-white" : "text-[#0A0A0A]"}`}>
              <sup className="text-[1.1rem] font-medium align-top mt-2 inline-block">R$</sup>
              {plan.price}
              <sub className={`text-[0.875rem] font-normal ${plan.featured ? "text-white/40" : "text-[#6B6B6B]"}`}>{plan.sub}</sub>
            </div>
            <div className={`text-[0.875rem] leading-[1.5] mb-7 ${plan.featured ? "text-white/50" : "text-[#6B6B6B]"}`}>{plan.desc}</div>
            <div className={`h-px mb-6 ${plan.featured ? "bg-white/10" : "bg-[rgba(0,0,0,0.07)]"}`} />
            <div className="flex flex-col gap-3 mb-8">
              {plan.features.map((f) => (
                <div key={f.text} className={`flex items-start gap-[10px] text-[0.875rem] font-light ${!f.included ? "opacity-35" : ""} ${plan.featured ? "text-white/80" : "text-[#0A0A0A]"}`}>
                  {f.included ? (
                    <Check size={18} className={`flex-shrink-0 mt-[1px] ${plan.featured ? "text-[#9F67FF]" : "text-[#7C3AED]"}`} strokeWidth={1.5} />
                  ) : (
                    <X size={18} className="flex-shrink-0 mt-[1px] text-[#999]" strokeWidth={1.5} />
                  )}
                  {f.text}
                </div>
              ))}
            </div>
            <button className={`w-full text-[0.9375rem] font-medium py-[13px] rounded-full cursor-pointer border-none transition-all tracking-[-0.01em] font-['DM_Sans'] ${
              plan.featured
                ? "bg-[#7C3AED] text-white shadow-[0_4px_20px_rgba(124,58,237,0.22)] hover:bg-[#9F67FF]"
                : "bg-[#F4F4F4] text-[#0A0A0A] hover:bg-[#E8E8E8]"
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
