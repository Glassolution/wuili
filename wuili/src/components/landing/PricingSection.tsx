import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { playSatisfyingClick } from "@/lib/uiFeedback";
import {
  Sparkles,
  MessageSquare,
  Image,
  Brain,
  Mic,
  Zap,
  BarChart3,
  Globe,
  ShieldCheck,
  Layers,
  RefreshCw,
  Bot,
  Store,
  TrendingUp,
  Headphones,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Feature = { icon: LucideIcon; text: string };

type Plan = {
  id: string;
  name: string;
  price: string;
  currency: string;
  period: string;
  desc: string;
  cta: string;
  ctaStyle: "outlined" | "filled";
  prefix?: string;
  features: Feature[];
  note?: string;
};

const plans: Plan[] = [
  {
    id: "gratis",
    name: "Grátis",
    price: "0",
    currency: "R$",
    period: "BRL / mês",
    desc: "Comece a organizar sua operação",
    cta: "Criar conta grátis",
    ctaStyle: "outlined",
    features: [
      { icon: Sparkles, text: "IA para criação de anúncios" },
      { icon: MessageSquare, text: "Chat com IA básico" },
      { icon: Store, text: "1 marketplace conectado" },
      { icon: Image, text: "5 produtos no catálogo" },
      { icon: Mic, text: "Sem suporte prioritário" },
    ],
    note: "Ideal para quem está começando.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "99,90",
    currency: "R$",
    period: "BRL / mês",
    desc: "Desbloqueie a experiência completa",
    cta: "Fazer upgrade para o Pro",
    ctaStyle: "filled",
    features: [
      { icon: Zap, text: "IA avançada com auto-publicação" },
      { icon: Globe, text: "Até 2 marketplaces" },
      { icon: RefreshCw, text: "Monitoramento de preços 24h" },
      { icon: Brain, text: "Memória de operação entre sessões" },
      { icon: Bot, text: "Respostas automáticas a compradores" },
      { icon: BarChart3, text: "Relatórios financeiros" },
      { icon: Layers, text: "Suporte prioritário" },
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "149,90",
    currency: "R$",
    period: "BRL / mês",
    desc: "Aumente sua produtividade ao máximo",
    cta: "Fazer upgrade para Business",
    ctaStyle: "filled",
    prefix: "Tudo do Pro, incluindo:",
    features: [
      { icon: TrendingUp, text: "Mais automações de operação" },
      { icon: Sparkles, text: "Modelo de IA avançado" },
      { icon: Bot, text: "Agentes de venda ilimitados" },
      { icon: BarChart3, text: "Analytics em tempo real" },
      { icon: Store, text: "Marketplaces ilimitados" },
      { icon: Globe, text: "API access" },
      { icon: Image, text: "Automações de entrega e rastreio" },
      { icon: Brain, text: "O máximo de memória e contexto" },
      { icon: ShieldCheck, text: "Acesso antecipado a novos recursos" },
      { icon: Headphones, text: "Suporte dedicado" },
    ],
    note: "Sem limites, mas sujeito a diretrizes de uso justo.",
  },
];

const PricingSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePlanClick = (planId: string) => {
    if (loadingPlan) return;

    playSatisfyingClick();
    setLoadingPlan(planId);

    setTimeout(() => {
      if (planId === "gratis") {
        navigate(user ? "/dashboard" : "/cadastro");
      } else if (user) {
        navigate(`/checkout?plan=${planId}`);
      } else {
        navigate(`/cadastro?next=/checkout&plan=${planId}`);
      }
    }, 3000);
  };

  return (
    <section id="planos" className="relative z-[1] bg-black py-[120px]">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        {/* Header */}
        <div className="mb-12 text-center">
          <h2 className="mb-5 font-['Manrope'] text-[clamp(1.75rem,3vw,2.25rem)] font-bold tracking-[-0.02em] text-white">
            Faça upgrade do seu plano
          </h2>
          {/* Toggle */}
          <div className="inline-flex rounded-full border border-white/[0.12] bg-[#111] p-[3px]">
            <button className="rounded-full bg-white px-5 py-[7px] font-['Manrope'] text-[13px] font-semibold text-black">
              Personal
            </button>
            <button className="rounded-full px-5 py-[7px] font-['Manrope'] text-[13px] font-medium text-white/50 transition hover:text-white/80">
              Business
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
          {plans.map((plan, idx) => (
            <div
              key={plan.name}
              className={`flex flex-col border border-white/[0.08] px-7 py-8 ${
                idx === 0
                  ? "rounded-t-[20px] md:rounded-l-[20px] md:rounded-tr-none"
                  : idx === 2
                    ? "rounded-b-[20px] md:rounded-r-[20px] md:rounded-bl-none"
                    : ""
              }`}
            >
              {/* Plan name */}
              <h3 className="mb-5 font-['Manrope'] text-[1.375rem] font-bold tracking-[-0.01em] text-white">
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-1 flex items-baseline gap-[6px]">
                <span className="font-['Manrope'] text-[0.9375rem] font-medium text-white/60">
                  {plan.currency}
                </span>
                <span className="font-['Manrope'] text-[3rem] font-bold leading-none tracking-[-0.04em] text-white">
                  {plan.price}
                </span>
                <span className="font-['Manrope'] text-[0.8125rem] font-medium leading-tight text-white/40">
                  {plan.period}
                </span>
              </div>

              {/* Description */}
              <p className="mb-6 font-['Manrope'] text-[0.875rem] font-semibold leading-[1.4] text-white">
                {plan.desc}
              </p>

              {/* CTA */}
              <button
                onClick={() => handlePlanClick(plan.id)}
                disabled={loadingPlan !== null}
                className={`group relative mb-8 flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full py-[13px] font-['Manrope'] text-[0.875rem] font-semibold transition-all duration-500 disabled:cursor-wait disabled:opacity-100 ${
                  loadingPlan === plan.id ? "animate-pricing-cta-breathe" : ""
                } ${
                  plan.ctaStyle === "filled"
                    ? "border-none bg-white text-black hover:bg-white/90"
                    : "border border-white/[0.15] bg-transparent text-white/70 hover:border-white/30 hover:text-white"
                }`}
              >
                {loadingPlan === plan.id && (
                  <>
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_15%,rgba(255,255,255,0.12)_35%,rgba(255,255,255,0.48)_50%,rgba(255,255,255,0.12)_65%,transparent_85%)] opacity-90 animate-pricing-cta-sheen"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-[1px] rounded-full bg-white/8 blur-md"
                    />
                  </>
                )}

                {loadingPlan === plan.id ? (
                  <span className={`relative z-[1] flex items-center gap-3 ${plan.ctaStyle === "filled" ? "text-black" : "text-white"}`}>
                    <span aria-hidden="true" className={`pricing-cta-loader ${plan.ctaStyle === "filled" ? "text-black" : "text-white"}`}>
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className="tracking-[-0.01em]">Abrindo checkout</span>
                  </span>
                ) : (
                  <span className="relative z-[1]">{plan.cta}</span>
                )}
              </button>

              {/* Features prefix */}
              {plan.prefix && (
                <p className="mb-4 font-['Manrope'] text-[0.8125rem] font-bold text-white">
                  {plan.prefix}
                </p>
              )}

              {/* Feature list */}
              <div className="flex flex-col gap-[14px]">
                {plan.features.map((f) => (
                  <div
                    key={f.text}
                    className="flex items-center gap-3 font-['Manrope'] text-[0.8125rem] text-white/75"
                  >
                    <f.icon size={16} className="flex-shrink-0 text-white/45" strokeWidth={1.8} />
                    {f.text}
                  </div>
                ))}
              </div>

              {/* Note */}
              {plan.note && (
                <p className="mt-auto pt-8 font-['Manrope'] text-[0.75rem] text-white/35">
                  {plan.note}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
