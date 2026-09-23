import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Headphones,
  Image,
  Infinity as InfinityIcon,
  LayoutTemplate,
  Layers,
  Loader2,
  MessageCircle,
  Package,
  RefreshCw,
  Sparkle,
  Store,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { PremiumActionButton } from "@/components/PremiumActionButton";
import { VeloLogo } from "@/components/VeloLogo";
import { startValidaPayCheckout, type VelloPlanId } from "@/lib/validapayCheckout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isAdminEmail } from "@/lib/adminAccess";
import { useSandboxMode } from "@/lib/sandboxMode";
import { createLocalSandboxSubscription } from "@/lib/localSandbox";
import { VELO_PLAN_PRICES, billingCycleForPlan } from "@/lib/planPricing";
import { trackMobileHomeEvent } from "@/lib/mobileHomeTracking";



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
    monthly: VELO_PLAN_PRICES.base.monthly,
    annual: VELO_PLAN_PRICES.base.annual,
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
    monthly: VELO_PLAN_PRICES.pro.monthly,
    annual: VELO_PLAN_PRICES.pro.annual,
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
    monthly: VELO_PLAN_PRICES.business.monthly,
    annual: VELO_PLAN_PRICES.business.annual,
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

const MOBILE_HEADLINE: Record<PlanId, string> = {
  base: "Comece a vender",
  pro: "Venda no automático",
  business: "Opere sem teto",
};

const MOBILE_HIGHLIGHTS: Record<PlanId, { from: string; items: { icon: LucideIcon; text: string }[] }> = {
  base: {
    from: "Grátis",
    items: [
      { icon: Store, text: "50 anúncios ativos no Mercado Livre" },
      { icon: MessageCircle, text: "40 mensagens por dia com o Atlas" },
      { icon: Image, text: "20 imagens de produto com IA por mês" },
      { icon: LayoutTemplate, text: "1 página de vendas gerada por IA" },
      { icon: Package, text: "Acesso ao catálogo validado da Velo" },
    ],
  },
  pro: {
    from: "Base",
    items: [
      { icon: Layers, text: "300 anúncios, lote e variações" },
      { icon: RefreshCw, text: "Sincronização de preço e estoque" },
      { icon: MessageCircle, text: "150 mensagens por dia com o Atlas" },
      { icon: Image, text: "100 imagens e 10 vídeos com IA" },
      { icon: Store, text: "3 lojas completas geradas por IA" },
    ],
  },
  business: {
    from: "Pro",
    items: [
      { icon: InfinityIcon, text: "Anúncios ilimitados no Mercado Livre" },
      { icon: Layers, text: "Marketplaces ilimitados" },
      { icon: MessageCircle, text: "400 mensagens por dia com o Atlas" },
      { icon: Clapperboard, text: "300 imagens e 30 vídeos com IA" },
      { icon: Headphones, text: "Suporte dedicado" },
    ],
  },
};

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
  open: (opts?: { defaultPlan?: PlanId; origin?: string; productId?: string }) => void;
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
  const [trackingContext, setTrackingContext] = useState<{ origin?: string; productId?: string }>({});

  const value = useMemo<UpgradeCtx>(
    () => ({
      open: (opts) => {
        setDefaultPlan(opts?.defaultPlan);
        setTrackingContext({ origin: opts?.origin, productId: opts?.productId });
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
    }),
    [],
  );

  return (
    <UpgradeModalContext.Provider value={value}>
      {children}
      <PlansUpgradeModal open={isOpen} onClose={() => setIsOpen(false)} defaultPlan={defaultPlan} trackingContext={trackingContext} />
    </UpgradeModalContext.Provider>
  );
};

type ModalProps = {
  open: boolean;
  onClose: () => void;
  defaultPlan?: PlanId;
  trackingContext?: { origin?: string; productId?: string };
};

const MobilePlansSheet = ({
  cycle,
  setCycle,
  selectedPlanId,
  setSelectedPlanId,
  loadingPlans,
  checkingOutPlanId,
  sandboxPurchaseEnabled,
  onChoose,
  onClose,
}: {
  cycle: BillingCycle;
  setCycle: (value: BillingCycle | ((current: BillingCycle) => BillingCycle)) => void;
  selectedPlanId: PlanId;
  setSelectedPlanId: (id: PlanId) => void;
  loadingPlans: boolean;
  checkingOutPlanId: PlanId | null;
  sandboxPurchaseEnabled: boolean;
  onChoose: (id: PlanId) => void;
  onClose: () => void;
}) => {
  const plan = PLANS.find((item) => item.id === selectedPlanId) ?? PLANS[0];
  const highlights = MOBILE_HIGHLIGHTS[plan.id];
  const price = cycle === "annual" ? plan.annual / 12 : plan.monthly;
  const priceParts = splitBRL(price);
  const temDescontoAnual = cycle === "annual" && plan.annual / 12 < plan.monthly - 0.01;
  const originalPrice = temDescontoAnual ? formatBRL(plan.monthly) : null;
  const nomeDoPlano = plan.name.replace("Plano ", "");
  const escolherPlano = (id: PlanId) => {
    setSelectedPlanId(id);
  };

  return (
    <div className="relative flex h-full w-full flex-col overflow-y-auto bg-[#E8ECF2] px-4 pb-[calc(24px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] text-[#111111] antialiased sm:hidden">
      <div className="flex items-start justify-between gap-4">
        <h2 className="min-w-0 flex-1 text-[22px] font-semibold leading-tight tracking-[-0.03em]">
          Experimente o {nomeDoPlano}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-black/40"
        >
          <X size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="mt-5 flex rounded-full bg-black/[0.06] p-[3px]">
        {PLANS.map((item) => {
          const ativo = item.id === selectedPlanId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => escolherPlano(item.id)}
              className={`h-9 flex-1 rounded-full text-[13px] font-medium transition-colors ${
                ativo ? "bg-white text-[#111111] shadow-[0_1px_2px_rgba(15,23,42,0.10)]" : "bg-transparent text-black/35"
              }`}
            >
              {item.name.replace("Plano ", "")}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex rounded-full bg-black/[0.06] p-[3px]">
        {([
          { id: "monthly" as BillingCycle, label: "Mensal" },
          { id: "annual" as BillingCycle, label: "Anual" },
        ]).map((opcao) => {
          const ativo = cycle === opcao.id;
          return (
            <button
              key={opcao.id}
              type="button"
              onClick={() => setCycle(opcao.id)}
              aria-pressed={ativo}
              className={`h-9 flex-1 rounded-full text-[13px] font-medium transition-colors ${
                ativo ? "bg-white text-[#111111] shadow-[0_1px_2px_rgba(15,23,42,0.10)]" : "bg-transparent text-black/35"
              }`}
            >
              {opcao.label}
            </button>
          );
        })}
      </div>

      <div className="relative mt-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[3px] rounded-[25px]"
          style={{
            padding: "4px",
            background: "linear-gradient(180deg, #C8E0FF 0%, #4C8DFF 34%, #6BA4FF 70%, #B7D0F2 100%)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            maskComposite: "exclude",
            filter: "blur(7px)",
            opacity: 0.88,
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-px rounded-[23px]"
          style={{
            padding: "1.5px",
            background: "linear-gradient(180deg, #F7FBFF 0%, #8EBBFF 16%, #3B82F6 46%, #7EB0FF 78%, #D4E6FF 100%)",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            maskComposite: "exclude",
            filter: "blur(1.5px)",
          }}
        />
        <div
          className="relative overflow-hidden rounded-[22px] bg-white"
          style={{
            boxShadow: "0 0 0 1px rgba(91,156,255,0.28), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 18px 36px rgba(191,219,254,0.18)",
          }}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent 8%, rgba(255,255,255,0.95) 50%, transparent 92%)",
            }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[22px]"
            style={{
              boxShadow: "inset 0 0 0 1px rgba(110,168,255,0.42)",
            }}
          />
          <div className="relative px-[18px] pb-5 pt-[18px]">
            {loadingPlans ? (
              <div className="space-y-4 py-2">
                <div className="h-5 w-28 animate-pulse rounded-full bg-black/[0.05]" />
                <div className="h-8 w-48 animate-pulse rounded-full bg-black/[0.05]" />
                <div className="h-4 w-full animate-pulse rounded-full bg-black/[0.05]" />
                <div className="h-12 w-full animate-pulse rounded-full bg-black/[0.05]" />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[16px] font-medium tracking-[-0.02em] text-[#111111]">{nomeDoPlano}</p>
                  {plan.ribbon ? (
                    <span className="rounded-full border border-[#5B9CFF]/45 bg-[#F3F8FF]/80 px-2.5 py-[5px] text-[10px] font-semibold uppercase tracking-[0.06em] text-[#2B6DE8]">
                      {plan.ribbon}
                    </span>
                  ) : null}
                </div>

                <h3 className="mt-5 text-[28px] font-semibold leading-[1.08] tracking-[-0.038em] text-[#111111]">
                  {MOBILE_HEADLINE[plan.id]}
                </h3>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-[1.45] text-[#8A8F98]">{plan.tagline}</p>

                <div className="mt-6 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  {originalPrice ? (
                    <span className="text-[20px] font-medium text-[#C5C7CC] line-through decoration-[1.5px]">{originalPrice}</span>
                  ) : null}
                  <span className="text-[36px] font-semibold leading-none tracking-[-0.05em] text-[#111111]">
                    {sandboxPurchaseEnabled ? "R$ 0" : priceParts.main}
                    <span className="text-[24px] font-semibold tracking-[-0.04em]">
                      {sandboxPurchaseEnabled ? ",00" : priceParts.cents}
                    </span>
                  </span>
                  <span className="text-[15px] text-[#9AA0A8]">/mês</span>
                </div>

                <p className="mt-2 text-[13px] font-medium text-[#2B6DE8]">
                  {cycle === "annual"
                    ? `Cobrança anual de ${formatBRL(plan.annual)}`
                    : "Cobrança mensal"}
                </p>

                <button
                  type="button"
                  onClick={() => onChoose(plan.id)}
                  disabled={checkingOutPlanId !== null}
                  className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold text-white transition-opacity disabled:opacity-70"
                  style={{
                    background: "linear-gradient(180deg, #6BA4FF 0%, #4C8DFF 48%, #3B7EFF 100%)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.32), 0 6px 16px rgba(59,130,246,0.28)",
                  }}
                >
                  {checkingOutPlanId === plan.id ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {sandboxPurchaseEnabled ? "Ativando..." : "Redirecionando..."}
                    </span>
                  ) : (
                    <>
                      <Sparkle className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                      {sandboxPurchaseEnabled ? "Testar" : "Assinar"} {nomeDoPlano}
                    </>
                  )}
                </button>

                <p className="mt-6 text-[15px] font-semibold tracking-[-0.02em] text-[#111111]">Tudo do {highlights.from}, e:</p>
                <ul className="mt-3.5 space-y-3.5">
                  {highlights.items.map((item) => {
                    const Icone = item.icon;
                    return (
                      <li key={item.text} className="flex items-start gap-3 text-[15px] leading-snug text-[#3F4650]">
                        <Icone className="mt-px h-[18px] w-[18px] shrink-0 text-[#7BA3E8]" strokeWidth={1.6} />
                        <span>{item.text}</span>
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-6 text-[12px] leading-relaxed text-[#9AA0A8]">
                  {sandboxPurchaseEnabled
                    ? "Sandbox ligado: este plano é ativado sem cobrança real."
                    : plan.id === "business"
                      ? "Cobrança anual. Cancele quando quiser."
                      : "Cancele quando quiser. O checkout continua seguro via Mercado Pago."}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PlansUpgradeModal = ({ open, onClose, defaultPlan, trackingContext }: ModalProps) => {
  const { session, role } = useAuth();
  const [cycle, setCycle] = useState<BillingCycle>(billingCycleForPlan(defaultPlan ?? "base"));
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(defaultPlan ?? "base");
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [checkingOutPlanId, setCheckingOutPlanId] = useState<PlanId | null>(null);
  const [sandboxEnabled] = useSandboxMode(session?.user?.id ?? session?.user?.email ?? null);
  const sandboxPurchaseEnabled = sandboxEnabled && (role === "admin" || isAdminEmail(session?.user?.email));
  const openedAt = useRef(Date.now());

  const closeWithTracking = () => {
    trackMobileHomeEvent(session?.user?.id, "plans_exit", {
      productId: trackingContext?.productId,
      detail: trackingContext?.origin ?? "unknown",
      elapsedMs: Date.now() - openedAt.current,
    });
    onClose();
  };


  useEffect(() => {
    if (!open) return;
    openedAt.current = Date.now();
    trackMobileHomeEvent(session?.user?.id, "plans_open", { productId: trackingContext?.productId, detail: trackingContext?.origin ?? "unknown" });
    setLoadingPlans(true);
    setSelectedPlanId(defaultPlan ?? "base");
    setCycle(billingCycleForPlan(defaultPlan ?? "base"));
    const timer = window.setTimeout(() => setLoadingPlans(false), 720);
    return () => window.clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  // Fluxo Velo v1: cria a sessão e segue direto para o checkout hospedado da ValidaPay.
  const handleChoose = async (planId: PlanId) => {
    if (checkingOutPlanId) return;
    const checkoutCycle = billingCycleForPlan(planId);
    setCheckingOutPlanId(planId);
    trackMobileHomeEvent(session?.user?.id, "plan_checkout_clicked", { productId: trackingContext?.productId, detail: `${trackingContext?.origin ?? "unknown"}:${planId}:${checkoutCycle}` });
    try {
      if (sandboxPurchaseEnabled) {
        try {
          const { data, error } = await supabase.functions.invoke("admin-sandbox-subscription", {
            body: { plan: planId, cycle: checkoutCycle },
          });
          if (error || !data?.success) throw new Error(data?.error || data?.message || "Função Sandbox indisponível.");
        } catch (error) {
          if (!import.meta.env.DEV) throw error;
          createLocalSandboxSubscription(session?.user?.id ?? session?.user?.email ?? null, planId, checkoutCycle);
        }
        toast.success("Assinatura Sandbox ativada sem cobrança.");
        setCheckingOutPlanId(null);
        closeWithTracking();
        return;
      }

      const res = await startValidaPayCheckout(planId as VelloPlanId, checkoutCycle);
      if (res.ok) return;
      setCheckingOutPlanId(null);
      toast.error(res.error ?? "Não foi possível gerar o pagamento.");
    } catch (error) {
      console.error("checkout error", error);
      setCheckingOutPlanId(null);
      toast.error(sandboxPurchaseEnabled ? "Não foi possível ativar o Sandbox." : "Não foi possível gerar o pagamento.");
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
    <div className="fixed inset-0 z-[80] flex items-stretch justify-center p-0 sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Fechar"
        onClick={closeWithTracking}
        className="absolute inset-0 hidden bg-black/55 backdrop-blur-[3px] sm:block"
      />

      <MobilePlansSheet
        cycle={cycle}
        setCycle={setCycle}
        selectedPlanId={selectedPlanId}
        setSelectedPlanId={setSelectedPlanId}
        loadingPlans={loadingPlans}
        checkingOutPlanId={checkingOutPlanId}
        sandboxPurchaseEnabled={sandboxPurchaseEnabled}
        onChoose={(planId) => void handleChoose(planId)}
        onClose={closeWithTracking}
      />

      <div className="relative hidden h-full w-full overflow-y-auto bg-white px-5 py-7 shadow-[0_40px_120px_rgba(0,0,0,0.28)] sm:block sm:h-auto sm:max-h-[94vh] sm:max-w-[1040px] sm:rounded-[18px] sm:px-9 sm:py-6">
        <button
          type="button"
          onClick={closeWithTracking}
          aria-label="Fechar modal"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-[#6f7785] transition hover:bg-[#f1f1ef] hover:text-[#111827]"
        >
          <X size={18} />
        </button>

        <div className="mx-auto flex max-w-[980px] items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={closeWithTracking}
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
              {sandboxPurchaseEnabled
                ? "Sandbox ligado: escolha um plano de teste sem cobrança real."
                : "O checkout continua seguro via Mercado Pago."}
            </p>
          </div>
        </div>

        <div className="mx-auto mt-5 grid max-w-[980px] items-stretch gap-5 lg:grid-cols-3">
          {loadingPlans ? [0, 1, 2].map(skeletonCard) : PLANS.map((plan) => {
            const planCycle = billingCycleForPlan(plan.id);
            const price = planCycle === "annual" ? plan.annual / 12 : plan.monthly;
            const priceParts = splitBRL(price);
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
                    <span className="text-[26px] font-bold leading-none tracking-[-0.02em] text-black">
                      {sandboxPurchaseEnabled ? "R$ 0" : priceParts.main}
                      <span className="text-[#9CA3AF]">{sandboxPurchaseEnabled ? ",00" : priceParts.cents}</span>
                    </span>
                    <span className="text-[16px] font-medium tracking-[-0.01em] text-[#6B7280]">/mês</span>
                  </div>
                  {plan.id === "business" ? (
                    <p className="mt-1.5 text-[12px] font-medium text-[#2563EB]">Cobrança anual</p>
                  ) : null}
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
                      {sandboxPurchaseEnabled ? "Ativando..." : "Redirecionando..."}
                    </span>
                  ) : (
                    <>{sandboxPurchaseEnabled ? "Testar" : "Assinar"} {plan.name.replace("Plano ", "")}</>
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
