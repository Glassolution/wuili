import { Check, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Grátis",
    price: "0",
    sub: "/mês",
    featured: false,
    desc: "Para testar a plataforma e sentir como funciona.",
    features: [
      { text: "Até 3 produtos publicados", included: true },
      { text: "Chat com IA", included: true },
      { text: "Mercado Livre", included: true },
      { text: "IA automática completa", included: false },
      { text: "Shopee e AliExpress", included: false },
    ],
    cta: "Começar grátis",
    badge: null,
  },
  {
    name: "Padrão",
    price: "99",
    sub: ",90/mês",
    featured: true,
    badge: "Mais popular",
    desc: "IA completa para quem quer resultados reais no Mercado Livre.",
    features: [
      { text: "Produtos ilimitados", included: true },
      { text: "IA cria e publica anúncios", included: true },
      { text: "ML + Shopee", included: true },
      { text: "Monitoramento de preços 24h", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    cta: "Assinar Padrão →",
  },
  {
    name: "Pro",
    price: "149",
    sub: ",90/mês",
    featured: false,
    badge: null,
    desc: "Tudo ilimitado, com IA respondendo clientes e multi-plataforma.",
    features: [
      { text: "Tudo do Padrão", included: true },
      { text: "Múltiplas contas ML", included: true },
      { text: "IA responde compradores", included: true },
      { text: "Analytics avançado", included: true },
      { text: "API access", included: true },
    ],
    cta: "Assinar Pro →",
  },
];

const PricingSection = () => {
  const navigate = useNavigate();

  return (
    <section id="planos" className="relative z-[1] bg-[#060b18] py-[120px]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="mb-16 text-center">
          <div className="mb-[18px] inline-flex items-center justify-center gap-[6px] text-[0.75rem] font-medium uppercase tracking-[0.08em] text-[#8ec5ff] before:h-px before:w-5 before:bg-[#8ec5ff] before:content-['']">
            Planos
          </div>
          <h2 className="mx-auto mb-4 font-['Sora'] text-[clamp(1.9rem,3.5vw,2.8rem)] font-bold leading-[1.12] tracking-[-0.035em] text-white">
            Comece grátis.{" "}
            <em className="not-italic text-[#8ec5ff]">Cresça quando quiser.</em>
          </h2>
          <p className="mx-auto max-w-[400px] text-base font-light leading-[1.65] text-white/50">
            Sem cartão de crédito para começar. Cancele quando quiser.
          </p>
        </div>

        <div className="mx-auto grid max-w-[400px] grid-cols-1 gap-5 md:max-w-none md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-[20px] border p-8 transition-all duration-300 hover:-translate-y-1 ${
                plan.featured
                  ? "border-[#2563eb]/60 bg-gradient-to-b from-[#2563eb]/10 to-[#1e3a8a]/10 shadow-[0_0_60px_rgba(37,99,235,0.15)]"
                  : "border-white/[0.07] bg-white/[0.03] hover:border-white/[0.12] hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563eb] px-[14px] py-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-white">
                  {plan.badge}
                </div>
              )}

              <div className="mb-4 font-['Sora'] text-[0.875rem] font-semibold uppercase tracking-[0.06em] text-white/40">
                {plan.name}
              </div>

              <div className="mb-[6px] font-['Sora'] text-[2.8rem] font-bold leading-none tracking-[-0.04em] text-white">
                <sup className="mt-2 inline-block align-top text-[1.1rem] font-medium text-white/60">
                  R$
                </sup>
                {plan.price}
                <sub className="text-[0.875rem] font-normal text-white/35">{plan.sub}</sub>
              </div>

              <div className="mb-7 text-[0.875rem] leading-[1.5] text-white/40">{plan.desc}</div>
              <div className="mb-6 h-px bg-white/[0.06]" />

              <div className="mb-8 flex flex-col gap-3">
                {plan.features.map((f) => (
                  <div
                    key={f.text}
                    className={`flex items-start gap-[10px] text-[0.875rem] font-light ${
                      !f.included ? "opacity-30" : "text-white/75"
                    }`}
                  >
                    {f.included ? (
                      <Check
                        size={17}
                        className="mt-[1px] flex-shrink-0 text-[#8ec5ff]"
                        strokeWidth={2}
                      />
                    ) : (
                      <X
                        size={17}
                        className="mt-[1px] flex-shrink-0 text-white/25"
                        strokeWidth={2}
                      />
                    )}
                    {f.text}
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate("/cadastro")}
                className={`w-full cursor-pointer rounded-xl border-none py-[13px] font-['Sora'] text-[0.9375rem] font-semibold tracking-[-0.01em] transition-all ${
                  plan.featured
                    ? "bg-[#2563eb] text-white hover:bg-[#1d4ed8] hover:shadow-[0_8px_24px_rgba(37,99,235,0.4)]"
                    : "bg-white/[0.07] text-white hover:bg-white/[0.12]"
                }`}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
