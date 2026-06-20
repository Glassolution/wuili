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
  highlight?: boolean;
};

const plans: Plan[] = [
  {
    id: "gratis",
    name: "Grátis",
    price: "0",
    currency: "R$",
    period: "BRL / mês",
    desc: "Modo teste para conhecer a Velo",
    cta: "Desbloquear operação completa",
    ctaStyle: "outlined",
    features: [
      { icon: Image, text: "Exploração do catálogo" },
      { icon: BarChart3, text: "Dashboard demonstrativo" },
      { icon: MessageSquare, text: "IA básica de teste" },
      { icon: Store, text: "1 marketplace conectado" },
      { icon: ShieldCheck, text: "Sem publicação de produtos" },
      { icon: Mic, text: "Sem automações operacionais" },
    ],
    note: "Criado para explorar, sem operação real.",
  },
  {
    id: "pro",
    name: "Pro",
    price: "99,90",
    currency: "R$",
    period: "BRL / mês",
    desc: "Para operação casual e intermediária",
    cta: "Assinar Pro",
    ctaStyle: "filled",
    features: [
      { icon: Zap, text: "Até 30 produtos publicados" },
      { icon: Globe, text: "Até 2 marketplaces conectados" },
      { icon: Bot, text: "Até 3 agentes IA" },
      { icon: RefreshCw, text: "Automações limitadas" },
      { icon: BarChart3, text: "Analytics básico" },
      { icon: RefreshCw, text: "Monitoramento de preços 24h" },
      { icon: MessageSquare, text: "Respostas automáticas limitadas" },
      { icon: Brain, text: "Memória de operação entre sessões" },
      { icon: Layers, text: "Suporte prioritário" },
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "149,90",
    currency: "R$",
    period: "BRL / mês",
    desc: "Operação profissional sem limites",
    cta: "Assinar Business",
    ctaStyle: "filled",
    prefix: "Tudo ilimitado, incluindo:",
    features: [
      { icon: Zap, text: "Produtos ilimitados" },
      { icon: Store, text: "Marketplaces ilimitados" },
      { icon: Bot, text: "Agentes IA ilimitados" },
      { icon: RefreshCw, text: "Automações ilimitadas" },
      { icon: Sparkles, text: "IA estratégica avançada" },
      { icon: TrendingUp, text: "Análise de concorrência e score de produtos" },
      { icon: BarChart3, text: "Insights automáticos e analytics premium" },
      { icon: Brain, text: "Processamento prioritário" },
      { icon: ShieldCheck, text: "Acesso antecipado a novos recursos" },
      { icon: Headphones, text: "Suporte dedicado" },
    ],
    note: "A camada superior da Velo para operação sem limites.",
    highlight: true,
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
        navigate(user ? "/checkout?plan=pro" : "/login");
      } else if (user) {
        navigate(`/checkout?plan=${planId}`);
      } else {
        navigate("/login");
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
          {plans.map((plan, idx) => {
            const highlighted = !!plan.highlight;
            const primaryText = highlighted ? "text-black" : "text-white";
            const secondaryText = highlighted ? "text-black/55" : "text-white/60";
            const mutedText = highlighted ? "text-black/40" : "text-white/40";
            return (
              <div
                key={plan.name}
                className={`relative flex flex-col border px-7 py-8 transition duration-300 hover:-translate-y-1 ${
                  highlighted
                    ? "z-[1] border-white bg-white shadow-[0_28px_90px_rgba(255,255,255,0.14)] md:-mt-5 md:rounded-[24px] md:py-10"
                    : "border-white/[0.08]"
                } ${
                  idx === 0
                    ? "rounded-t-[20px] md:rounded-l-[20px] md:rounded-tr-none"
                    : idx === 2
                      ? highlighted
                        ? "rounded-b-[20px] md:rounded-[24px]"
                        : "rounded-b-[20px] md:rounded-r-[20px] md:rounded-bl-none"
                      : ""
                }`}
              >
                {highlighted && (
                  <div className="absolute right-6 top-6 rounded-full bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                    Superior
                  </div>
                )}
              {/* Plan name */}
              <h3 className={`mb-5 font-['Manrope'] text-[1.375rem] font-bold tracking-[-0.01em] ${primaryText}`}>
                {plan.name}
              </h3>

              {/* Price */}
              <div className="mb-1 flex items-baseline gap-[6px]">
                <span className={`font-['Manrope'] text-[0.9375rem] font-medium ${secondaryText}`}>
                  {plan.currency}
                </span>
                <span className={`font-['Manrope'] text-[3rem] font-bold leading-none tracking-[-0.04em] ${primaryText}`}>
                  {plan.price}
                </span>
                <span className={`font-['Manrope'] text-[0.8125rem] font-medium leading-tight ${mutedText}`}>
                  {plan.period}
                </span>
              </div>

              {/* Description */}
              <p className={`mb-6 font-['Manrope'] text-[0.875rem] font-semibold leading-[1.4] ${primaryText}`}>
                {plan.desc}
              </p>

              {/* CTA */}
              <button
                onClick={() => handlePlanClick(plan.id)}
                disabled={loadingPlan !== null}
                className={`group relative mb-8 flex w-full cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-full py-[13px] font-['Manrope'] text-[0.875rem] font-semibold transition-all duration-500 disabled:cursor-wait disabled:opacity-100 ${
                  loadingPlan === plan.id ? "animate-pricing-cta-breathe" : ""
                } ${
                  highlighted
                    ? "border-none bg-black text-white hover:bg-black/85"
                    : plan.ctaStyle === "filled"
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
                  <span className={`relative z-[1] flex items-center gap-3 ${highlighted ? "text-white" : plan.ctaStyle === "filled" ? "text-black" : "text-white"}`}>
                    <span aria-hidden="true" className={`pricing-cta-loader ${highlighted ? "text-white" : plan.ctaStyle === "filled" ? "text-black" : "text-white"}`}>
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
                <p className={`mb-4 font-['Manrope'] text-[0.8125rem] font-bold ${primaryText}`}>
                  {plan.prefix}
                </p>
              )}

              {/* Feature list */}
              <div className="flex flex-col gap-[14px]">
                {plan.features.map((f) => (
                  <div
                    key={f.text}
                    className={`flex items-center gap-3 font-['Manrope'] text-[0.8125rem] ${highlighted ? "text-black/70" : "text-white/75"}`}
                  >
                    <f.icon size={16} className={`flex-shrink-0 ${highlighted ? "text-emerald-600" : "text-white/45"}`} strokeWidth={1.8} />
                    {f.text}
                  </div>
                ))}
              </div>

              {/* Note */}
              {plan.note && (
                <p className={`mt-auto pt-8 font-['Manrope'] text-[0.75rem] ${highlighted ? "text-black/35" : "text-white/35"}`}>
                  {plan.note}
                </p>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
