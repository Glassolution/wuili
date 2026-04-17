import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
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
    id: "go",
    name: "Go",
    price: "39,99",
    currency: "R$",
    period: "BRL / mês",
    desc: "Continue vendendo com o acesso expandido",
    cta: "Começar com o Go",
    ctaStyle: "outlined",
    features: [
      { icon: Sparkles, text: "IA para criação de anúncios" },
      { icon: MessageSquare, text: "Chat com IA ilimitado" },
      { icon: Store, text: "1 marketplace conectado" },
      { icon: Image, text: "Tratamento de fotos" },
      { icon: Mic, text: "Suporte por e-mail" },
    ],
    note: "Ideal para quem está começando.",
  },
  {
    id: "plus",
    name: "Plus",
    price: "1,00",
    currency: "R$",
    period: "BRL / mês",
    desc: "Desbloqueie a experiência completa",
    cta: "Fazer upgrade para o Plus",
    ctaStyle: "filled",
    features: [
      { icon: Zap, text: "IA avançada com auto-publicação" },
      { icon: Globe, text: "ML + Shopee + AliExpress" },
      { icon: RefreshCw, text: "Monitoramento de preços 24h" },
      { icon: Brain, text: "Memória de operação entre sessões" },
      { icon: Bot, text: "Respostas automáticas a compradores" },
      { icon: BarChart3, text: "Pesquisa de nicho aprofundada" },
      { icon: Layers, text: "Projetos e lojas personalizadas" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "525",
    currency: "R$",
    period: "BRL / mês",
    desc: "Aumente sua produtividade ao máximo",
    cta: "Fazer upgrade para o Pro",
    ctaStyle: "filled",
    prefix: "Tudo do Plus, incluindo:",
    features: [
      { icon: TrendingUp, text: "5 vezes mais uso que o Plus" },
      { icon: Sparkles, text: "Modelo de IA avançado" },
      { icon: Bot, text: "Agentes de venda ilimitados" },
      { icon: BarChart3, text: "Analytics em tempo real" },
      { icon: Store, text: "Múltiplas contas por marketplace" },
      { icon: Image, text: "Criação de imagens ilimitada" },
      { icon: Brain, text: "O máximo de memória e contexto" },
      { icon: ShieldCheck, text: "Acesso antecipado a novos recursos" },
      { icon: Headphones, text: "Suporte prioritário dedicado" },
    ],
    note: "Sem limites, mas sujeito a diretrizes de uso justo.",
  },
];

const PricingSection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handlePlanClick = (planId: string) => {
    setLoadingPlan(planId);
    setTimeout(() => {
      if (user) {
        navigate(`/checkout?plan=${planId}`);
      } else {
        navigate(`/cadastro?next=/checkout&plan=${planId}`);
      }
    }, 500);
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
                className={`mb-8 flex w-full cursor-pointer items-center justify-center gap-2 rounded-full py-[13px] font-['Manrope'] text-[0.875rem] font-semibold transition-all disabled:opacity-70 ${
                  plan.ctaStyle === "filled"
                    ? "border-none bg-white text-black hover:bg-white/90"
                    : "border border-white/[0.15] bg-transparent text-white/70 hover:border-white/30 hover:text-white"
                }`}
              >
                {loadingPlan === plan.id ? (
                  <><Loader2 size={15} className="animate-spin" /> Abrindo...</>
                ) : (
                  plan.cta
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
