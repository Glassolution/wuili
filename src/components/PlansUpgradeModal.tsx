import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { PremiumActionButton } from "@/components/PremiumActionButton";
import { VeloLogo } from "@/components/VeloLogo";
import { startValidaPayCheckout, type VelloPlanId } from "@/lib/validapayCheckout";



type BillingCycle = "monthly" | "annual";

type PlanId = "base" | "pro" | "business";

type PlanFeature = string | { type: "divider"; id: string };

type PlanEntry = {
  id: PlanId;
  name: string;
  iconVariant: PlanId;
  tagline: string;
  monthly: number;
  annual: number;
  originalMonthly?: number;
  ribbon?: string;
  highlighted?: boolean;
  features: PlanFeature[];
};

const PLANS: PlanEntry[] = [
  {
    id: "base",
    name: "Plano Base",
    iconVariant: "base",
    tagline: "Pra quem quer começar a vender sem travar no operacional.",
    monthly: 39.9,
    annual: 430.92,
    features: [
      "Até 50 anúncios ativos no Mercado Livre (50 publicações por mês)",
      "1 página de vendas gerada por IA por mês",
      "20 imagens de produto com IA por mês",
      "3 influencers de IA para TikTok",
      "40 mensagens por dia com o Atlas",
      { type: "divider", id: "base-limits" },
      "Acesso ao catálogo validado da Velo",
      "Personalização de título e descrição com IA",
      "Publicação de anúncios uma a uma no Mercado Livre",
      "Sem publicação em lote, variações nem sincronização automática de estoque",
      "1 marketplace conectado",
      "Sugestões de preço de venda e margem",
      { type: "divider", id: "base-store" },
      "Subdomínio grátis (seunome.velo.store)",
      "Suporte por e-mail",
    ],
  },
  {
    id: "pro",
    name: "Plano Pro",
    iconVariant: "pro",
    tagline: "Pra quem já vendeu e quer parar de fazer tudo na mão.",
    monthly: 79.8,
    annual: 861.84,
    ribbon: "Mais escolhido",
    highlighted: true,
    features: [
      "Até 300 anúncios ativos no Mercado Livre (300 publicações por mês)",
      "Publicação em lote e anúncios com variações (cor, tamanho)",
      "Sincronização automática de preço e estoque",
      "10 páginas de vendas geradas por IA",
      "3 lojas completas geradas por IA",
      "100 imagens de produto com IA por mês",
      "10 vídeos com IA por mês",
      "10 influencers de IA para TikTok",
      "150 mensagens por dia com o Atlas",
      "Cursos pra aprender a usar a plataforma e ganhar dinheiro com dropshipping",
      { type: "divider", id: "pro-limits" },
      "Acesso ao catálogo validado da Velo",
      "Personalização de título e descrição com IA",
      "Publicação de anúncios no Mercado Livre",
      "Página e template builder da Velo",
      "Edição de imagens e textos com IA",
      "Sugestões de preço de venda e margem",
      "Atualização automática de preço e estoque",
      "Templates profissionais para páginas de venda",
      "Gestão de múltiplas páginas de venda",
      { type: "divider", id: "pro-store" },
      "Domínio próprio grátis",
      "Suporte prioritário",
    ],
  },
  {
    id: "business",
    name: "Plano Business",
    iconVariant: "business",
    tagline: "Pra quem já vive disso e quer parar de contar produto.",
    monthly: 159.6,
    annual: 1723.68,
    features: [
      "Anúncios ilimitados no Mercado Livre, sem teto mensal de publicação",
      "Marketplaces ilimitados, publicação em lote e variações",
      "Páginas de vendas e lojas ilimitadas",
      "300 imagens de produto com IA por mês",
      "30 vídeos com IA por mês",
      "30 influencers de IA para TikTok",
      "400 mensagens por dia com o Atlas",
      "Cursos pra aprender a usar a plataforma e ganhar dinheiro com dropshipping",
      { type: "divider", id: "business-limits" },
      "Acesso ao catálogo validado da Velo",
      "Personalização de título e descrição com IA",
      "Publicação de anúncios no Mercado Livre",
      "Página e template builder da Velo",
      "Edição de imagens e textos com IA",
      "Sugestões de preço de venda e margem",
      "Atualização automática de preço e estoque",
      "Templates profissionais para páginas de venda",
      "Acesso a modelos avançados de loja",
      { type: "divider", id: "business-store" },
      "Operação com volume ilimitado de produtos",
      "Domínio próprio grátis em todas as lojas",
      "Suporte prioritário com atendimento dedicado",
    ],
  },
];

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);

const splitBRL = (value: number) => {
  const formatted = formatBRL(value).replace(/\u00a0/g, " ");
  const [main, cents = "00"] = formatted.split(",");
  return { main, cents: `,${cents}` };
};

const PLAN_ICON_CLASSES: Record<PlanId, string> = {
  base: "border-white/85 bg-gradient-to-br from-[#fbfbfa] via-[#ececea] to-[#c8c8c4] text-[#383835] shadow-[0_20px_28px_-23px_rgba(15,23,42,0.58),0_9px_20px_-19px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-9px_16px_rgba(10,10,10,0.08)]",
  pro: "border-white/75 bg-gradient-to-br from-[#9287ff] via-[#6953ef] to-[#4925df] text-white shadow-[0_20px_30px_-23px_rgba(15,23,42,0.55),0_9px_22px_-19px_rgba(15,23,42,0.25),inset_0_1px_0_rgba(255,255,255,0.38),inset_0_-10px_18px_rgba(38,20,134,0.28)]",
  business: "border-white/70 bg-gradient-to-br from-[#313131] via-[#181818] to-[#050505] text-white shadow-[0_20px_29px_-23px_rgba(15,23,42,0.62),0_9px_21px_-19px_rgba(15,23,42,0.30),inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-10px_18px_rgba(0,0,0,0.40)]",
};

const PlanIconTopHighlight = ({ variant }: { variant: PlanId }) => {
  const blurId = `plan-icon-top-glow-blur-${variant}`;
  const strokeGradientId = `plan-icon-top-glow-stroke-${variant}`;
  const horizontalMaskId = `plan-icon-top-glow-mask-x-${variant}`;
  const maskId = `plan-icon-top-glow-fade-${variant}`;
  const clipId = `plan-icon-top-glow-clip-${variant}`;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[1]"
      viewBox="0 0 48 48"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id={blurId} x="-8%" y="-18%" width="116%" height="54%">
          <feGaussianBlur stdDeviation="0.32" />
        </filter>
        <linearGradient id={strokeGradientId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.1" stopColor="white" stopOpacity="0.14" />
          <stop offset="0.24" stopColor="white" stopOpacity="0.22" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.28" />
          <stop offset="0.76" stopColor="white" stopOpacity="0.22" />
          <stop offset="0.9" stopColor="white" stopOpacity="0.14" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={horizontalMaskId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="white" stopOpacity="0" />
          <stop offset="0.12" stopColor="white" stopOpacity="0.78" />
          <stop offset="0.5" stopColor="white" stopOpacity="1" />
          <stop offset="0.88" stopColor="white" stopOpacity="0.78" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id={maskId}>
          <rect width="48" height="48" fill={`url(#${horizontalMaskId})`} />
        </mask>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="48" height="18.4" />
        </clipPath>
      </defs>
      <path
        d="M7.5 17.2v-1.6c0-5.9 4.8-10.7 10.7-10.7h11.6c5.9 0 10.7 4.8 10.7 10.7v1.6"
        fill="none"
        stroke={`url(#${strokeGradientId})`}
        strokeLinecap="round"
        strokeWidth="1.45"
        filter={`url(#${blurId})`}
        mask={`url(#${maskId})`}
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
};

const PLAN_CLOUD_FILLS: Record<PlanId, { main: string; mid: string; low: string; shade: string; glow: string }> = {
  base: { main: "#4A4A46", mid: "#343431", low: "#232320", shade: "#111111", glow: "#FFFFFF" },
  pro: { main: "#FFFFFF", mid: "#F2F5FF", low: "#DDE5FF", shade: "#AEBBFF", glow: "#FFFFFF" },
  business: { main: "#FFFFFF", mid: "#F4F4F1", low: "#D8D8D2", shade: "#A7A7A0", glow: "#FFFFFF" },
};

const PlanCloudIcon = ({ variant }: { variant: PlanId }) => {
  const colors = PLAN_CLOUD_FILLS[variant];
  const gradientId = `plan-cloud-fill-${variant}`;
  const glowId = `plan-cloud-glow-${variant}`;
  const shadowOpacity = variant === "pro" ? 0.22 : 0.18;

  return (
    <svg
      width="27"
      height="27"
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.18)]"
    >
      <defs>
        <linearGradient id={gradientId} x1="8" x2="23" y1="7" y2="26" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={colors.main} />
          <stop offset="0.52" stopColor={colors.mid} />
          <stop offset="1" stopColor={colors.low} />
        </linearGradient>
        <radialGradient id={glowId} cx="37%" cy="22%" r="62%">
          <stop offset="0" stopColor={colors.glow} stopOpacity="0.9" />
          <stop offset="0.48" stopColor={colors.glow} stopOpacity="0.28" />
          <stop offset="1" stopColor={colors.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {variant === "business" ? (
        <path
          d="M10.4 22.9h12.2c2.7 0 4.8-1.92 4.8-4.45 0-2.38-1.76-4.2-4.13-4.42-.78-3.44-3.36-5.58-6.61-5.58-2.66 0-4.86 1.46-5.92 3.7-3.04.18-5.33 2.43-5.33 5.42 0 3.06 2.25 5.33 5 5.33Z"
          fill={colors.shade}
          opacity="0.32"
          transform="translate(0 -2)"
        />
      ) : null}

      <path
        d={
          variant === "base"
            ? "M10.7 23.3h11.85c2.76 0 4.95-2.02 4.95-4.64 0-2.52-1.92-4.46-4.42-4.64-.88-3.18-3.5-5.18-6.72-5.18-2.77 0-5.03 1.5-6.05 3.9-3.12.2-5.45 2.47-5.45 5.45 0 2.96 2.48 5.11 5.84 5.11Z"
            : variant === "pro"
            ? "M10.15 23.15h12.25c2.86 0 5.14-2.07 5.14-4.77 0-2.54-1.87-4.45-4.4-4.72-.9-3.36-3.56-5.56-6.9-5.56-2.82 0-5.18 1.58-6.25 4.02-3.2.16-5.53 2.52-5.53 5.54 0 3.15 2.32 5.49 5.69 5.49Z"
            : "M9.8 23.25h13c2.88 0 5.2-2.03 5.2-4.78 0-2.62-1.96-4.58-4.58-4.78-.9-3.28-3.67-5.44-7.04-5.44-2.7 0-4.86 1.27-6.05 3.38-3.56.04-6.08 2.4-6.08 5.62 0 3.34 2.28 6 5.55 6Z"
        }
        fill={`url(#${gradientId})`}
      />
      <path
        d={
          variant === "pro"
            ? "M9.9 15.28c1.18-2.2 3.12-3.42 5.44-3.42 2.48 0 4.52 1.28 5.62 3.52.22.46-.3.86-.7.54-1.18-.94-2.68-1.46-4.46-1.46-1.8 0-3.54.56-5.1 1.58-.48.3-1.08-.26-.8-.76Z"
            : "M10.35 15.42c1.08-2.02 2.9-3.1 5.06-3.1 2.18 0 3.98 1.04 5.08 2.94.24.42-.24.84-.64.56-1.16-.82-2.55-1.22-4.18-1.22-1.62 0-3.12.44-4.52 1.28-.45.27-1.04 0-.8-.46Z"
        }
        fill={`url(#${glowId})`}
      />
      {variant === "business" ? (
        <path
          d="M11.5 19.4h9.85c1.45 0 2.56-.95 2.56-2.27 0-1.22-.9-2.12-2.14-2.26-.54-1.72-1.9-2.75-3.65-2.75-1.45 0-2.62.67-3.3 1.85-1.86.06-3.16 1.24-3.16 2.9 0 1.5 1.1 2.53 2.62 2.53Z"
          fill={colors.glow}
          opacity="0.22"
        />
      ) : null}
      <path
        d="M9.6 23.3h12.9"
        stroke={colors.shade}
        strokeOpacity={shadowOpacity}
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * Selo do plano, com o mesmo acabamento em toda a Velo.
 *
 * Exportado porque a tela de Configurações mostra os mesmos três planos: se
 * cada lugar desenhasse o próprio ícone, eles voltariam a divergir na primeira
 * mudança de arte.
 */
export const PlanBadgeIcon = ({ variant, className = "" }: { variant: PlanId; className?: string }) => (
  <span
    className={`relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[14px] border ${PLAN_ICON_CLASSES[variant]} ${className}`}
    aria-hidden="true"
  >
    <PlanIconTopHighlight variant={variant} />
    <PlanCloudIcon variant={variant} />
  </span>
);

export type PlanBadgeId = PlanId;

type UpgradeCtx = {
  open: (opts?: { defaultPlan?: PlanId }) => void;
  close: () => void;
};

const UpgradeModalContext = createContext<UpgradeCtx | null>(null);

export const useUpgradeModal = () => {
  const ctx = useContext(UpgradeModalContext);
  if (!ctx) throw new Error("useUpgradeModal must be used within UpgradeModalProvider");
  return ctx;
};

export const UpgradeModalProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [defaultPlan, setDefaultPlan] = useState<PlanId | undefined>();

  const value = useMemo<UpgradeCtx>(
    () => ({
      open: (opts) => {
        setDefaultPlan(opts?.defaultPlan);
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [],
  );

  return (
    <UpgradeModalContext.Provider value={value}>
      {children}
      <PlansUpgradeModal open={isOpen} onClose={() => setIsOpen(false)} defaultPlan={defaultPlan} />
    </UpgradeModalContext.Provider>
  );
};

type ModalProps = {
  open: boolean;
  onClose: () => void;
  defaultPlan?: PlanId;
};

const PlansUpgradeModal = ({ open, onClose, defaultPlan }: ModalProps) => {
  const navigate = useNavigate();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [checkingOutPlanId, setCheckingOutPlanId] = useState<PlanId | null>(null);


  useEffect(() => {
    if (!open) return;
    setLoadingPlans(true);
    const timer = window.setTimeout(() => setLoadingPlans(false), 720);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  const handleChoose = async (planId: PlanId) => {
    if (checkingOutPlanId) return;
    setCheckingOutPlanId(planId);
    try {
      const res = await startValidaPayCheckout(planId as VelloPlanId, cycle);
      if (res.ok) return; // redirect acontece pelo navegador
      setCheckingOutPlanId(null);
      toast.error(res.error ?? "Não foi possível gerar o pagamento.");
    } catch (e) {
      console.error("checkout error", e);
      setCheckingOutPlanId(null);
      toast.error("Não foi possível gerar o pagamento.");
    }
  };


  const skeletonCard = (index: number) => (
    <div key={index} className="rounded-[16px] border border-black/10 bg-white p-5">
      <div className="h-11 w-11 animate-pulse rounded-[12px] bg-[#ececea]" />
      <div className="mt-4 h-6 w-24 animate-pulse rounded-full bg-[#ececea]" />
      <div className="mt-3 h-4 w-4/5 animate-pulse rounded-full bg-[#eeeeec]" />
      <div className="mt-2 h-4 w-2/3 animate-pulse rounded-full bg-[#eeeeec]" />
      <div className="mt-8 h-10 w-44 animate-pulse rounded-full bg-[#ececea]" />
      <div className="mt-4 h-11 w-full animate-pulse rounded-[10px] bg-[#0a0a0a]/20" />
      <div className="mt-5 space-y-2.5">
        {[0, 1, 2, 3, 4].map((line) => (
          <div key={line} className="flex items-center gap-3">
            <div className="h-4 w-4 animate-pulse rounded-full bg-[#ececea]" />
            <div className="h-4 flex-1 animate-pulse rounded-full bg-[#eeeeec]" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-0 sm:p-6">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
      />

      <div className="relative h-full w-full overflow-y-auto bg-white px-5 py-7 shadow-[0_40px_120px_rgba(0,0,0,0.28)] sm:h-auto sm:max-h-[94vh] sm:max-w-[1040px] sm:rounded-[18px] sm:px-9 sm:py-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar modal"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-[#6f7785] transition hover:bg-[#f1f1ef] hover:text-[#111827]"
        >
          <X size={18} />
        </button>

        <div className="mx-auto flex max-w-[980px] items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onClose}
              className="grid h-11 w-11 place-items-center rounded-full bg-[#f3f3f1] text-black transition hover:bg-[#e9e9e7]"
              aria-label="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <VeloLogo size="md" variant="dark" />
          </div>

          <div className="hidden items-center gap-2 sm:flex" aria-hidden="true">
            {[0, 1, 2].map((step) => (
              <span key={step} className={`h-[5px] w-[74px] rounded-full ${step === 0 ? "bg-black" : "bg-[#e9e9e7]"}`} />
            ))}
          </div>

          <span aria-hidden="true" className="hidden w-[86px] sm:block" />
        </div>

        <div className="mx-auto mt-7 flex max-w-[980px] flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-[26px] font-bold tracking-[-0.02em] text-[#0A0A0A] sm:text-[30px]">
              Escolha o plano que combina com você
            </h2>
            <p className="mt-2 text-[14px] leading-5 text-[#8A8A86]">
              O checkout continua seguro via Mercado Pago.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCycle((current) => (current === "monthly" ? "annual" : "monthly"))}
            className="flex w-fit shrink-0 items-center gap-3 text-[14px] font-semibold text-[#3D3D3A]"
            aria-pressed={cycle === "annual"}
          >
            <span className={`relative h-6 w-11 rounded-full transition-colors ${cycle === "annual" ? "bg-black" : "bg-[#dfdeda]"}`}>
              <span className={`absolute left-1 top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.20)] transition-transform ${cycle === "annual" ? "translate-x-[18px]" : "translate-x-0"}`} />
            </span>
            Cobrança anual
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              Economize 10%
            </span>
          </button>
        </div>

        <div className="mx-auto mt-5 grid max-w-[980px] items-stretch gap-5 lg:grid-cols-3">
          {loadingPlans ? [0, 1, 2].map(skeletonCard) : PLANS.map((plan) => {
            const price = cycle === "monthly" ? plan.monthly : plan.annual / 12;
            const priceParts = splitBRL(price);
            const originalPrice = cycle === "annual" ? formatBRL(plan.monthly) : null;
            const savings = originalPrice ? Math.round((1 - price / plan.monthly) * 100) : 0;
            const isHighlighted = plan.id === defaultPlan || (!defaultPlan && plan.highlighted);

            return (
              <article
                key={plan.id}
                className={`relative flex flex-col overflow-hidden rounded-[16px] border bg-white p-5 transition-all duration-300 ${
                  isHighlighted
                    ? "border-[#2563EB] shadow-[0_26px_70px_rgba(37,99,235,0.18),0_12px_32px_rgba(10,10,10,0.10)] md:-translate-y-2"
                    : "border-black/10 shadow-[0_10px_28px_rgba(10,10,10,0.05)] hover:-translate-y-1 hover:border-black/25 hover:shadow-[0_18px_46px_rgba(10,10,10,0.10)]"
                }`}
              >
                {isHighlighted ? (
                  <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#1E3A8A] via-[#2563EB] to-[#7C3AED]" />
                ) : null}

                <div className="flex items-start gap-4">
                  <PlanBadgeIcon variant={plan.id} />

                  <div className="min-w-0 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[20px] font-bold tracking-[-0.015em] text-[#0A0A0A]">
                        {plan.name.replace("Plano ", "")}
                      </h3>
                      {plan.ribbon && (
                        <span className="rounded-full border border-[#2563EB]/15 bg-[#EEF4FF] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] shadow-[0_4px_12px_rgba(37,99,235,0.12)]">
                          {plan.ribbon}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="sr-only">{plan.tagline}</p>

                <div className="mt-6">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-['Manrope','Inter',ui-sans-serif,system-ui]">
                    {originalPrice ? (
                      <span className="text-[17px] font-semibold leading-none text-[#9CA3AF] line-through decoration-2">
                        {originalPrice}
                      </span>
                    ) : null}
                    <span className="text-[26px] font-bold leading-none tracking-[-0.02em] text-black">
                      {priceParts.main}
                      <span className="text-[#9CA3AF]">{priceParts.cents}</span>
                    </span>
                    {originalPrice ? (
                      <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-[0_2px_5px_rgba(16,185,129,0.10)]">
                        {savings}% OFF
                      </span>
                    ) : null}
                    <span className="text-[16px] font-medium tracking-[-0.01em] text-[#6B7280]">/mês</span>
                  </div>
                </div>

                <PremiumActionButton
                  type="button"
                  onClick={() => void handleChoose(plan.id)}
                  disabled={checkingOutPlanId !== null}
                  className="-mx-1 mt-5 h-9 w-[calc(100%+0.5rem)] rounded-[7px] px-5 text-[14px] disabled:opacity-80"
                >
                  {checkingOutPlanId === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Redirecionando...
                    </span>
                  ) : (
                    <>Assinar {plan.name.replace("Plano ", "")}</>
                  )}
                </PremiumActionButton>


                <p className="mb-3 mt-6 border-t border-black/[0.08] pt-5 text-[14px] font-semibold text-black">O que está incluído:</p>
                <ul className="space-y-2.5">
                  {plan.features.map((feature) => {
                    if (typeof feature !== "string") {
                      return <li key={feature.id} aria-hidden="true" className="h-px bg-black/[0.08]" />;
                    }

                    return (
                      <li key={feature} className="flex items-start gap-3 text-[14px] leading-6 text-[#3D3D3A]">
                        <span className="mt-[5px] grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full bg-black">
                          <Check size={11} className="text-white" strokeWidth={3} />
                        </span>
                        <span>{feature}</span>
                      </li>
                    );
                  })}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PlansUpgradeModal;
