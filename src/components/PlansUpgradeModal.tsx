import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Check, X } from "lucide-react";
import PromoCountdown from "@/components/PromoCountdown";
import { VeloMark } from "@/components/VeloLogo";
import { PRIMARY_BUTTON_STYLE } from "@/lib/buttonStyles";
import {
  PLAN_ANNUAL_AMOUNTS,
  PLAN_MONTHLY_AMOUNTS,
  PLAN_ORIGINAL_MONTHLY_AMOUNTS,
  formatBRL,
  type PlanId,
} from "@/lib/plans";

type BillingCycle = "monthly" | "annual";

// Conteúdo textual dos planos. Os PREÇOS não ficam aqui — vêm de `@/lib/plans`
// (fonte única), para que alterar o valor lá atualize todas as telas.
type PlanData = {
  name: string;
  description: string;
  badge?: string;
  features: string[];
};

const PLANS_DATA: Record<PlanId, PlanData> = {
  base: {
    name: "Base",
    description: "Pra quem quer começar a vender sem travar no operacional.",
    badge: "Promo 19h",
    features: [
      "Importação automática de até 50 produtos por mês pro Mercado Livre",
      "1 página de vendas gerada por IA por mês",
      "Loja completa: não incluída neste plano",
      "Acesso completo ao catálogo validado da Velo",
      "Subdomínio grátis (seunome.velo.store)",
    ],
  },
  pro: {
    name: "Pro",
    description: "Pra quem já vendeu e quer parar de fazer tudo na mão.",
    badge: "Mais escolhido",
    features: [
      "Importação automática de até 200 produtos por mês pro Mercado Livre",
      "5 páginas de vendas geradas por IA por mês",
      "3 lojas completas geradas por IA — dá pra separar por nicho, se quiser",
      "Domínio próprio grátis",
      "Atualização automática de preço e estoque nos produtos publicados",
      "Suporte prioritário",
    ],
  },
  business: {
    name: "Business",
    description: "Pra quem já vive disso e quer parar de contar produto.",
    badge: "Escala",
    features: [
      "Importação ilimitada de produtos pro Mercado Livre",
      "Páginas de vendas ilimitadas",
      "Lojas completas ilimitadas",
      "Domínio próprio grátis em todas as lojas",
      "Suporte prioritário com atendimento dedicado",
    ],
  },
};

const PLAN_ORDER: PlanId[] = ["base", "pro", "business"];

const parseBRL = (price: string) => Number(price.replace(/[^\d,]/g, "").replace(",", "."));

const splitPlanPrice = (price: string) => {
  const [main, cents = ""] = price.split(",");
  return { main, cents: cents ? `,${cents}` : "" };
};

const getDisplayPrice = (planId: PlanId, billingCycle: BillingCycle) => {
  const monthlyAmount = PLAN_MONTHLY_AMOUNTS[planId] ?? 0;
  if (billingCycle === "annual") return formatBRL(PLAN_ANNUAL_AMOUNTS[planId] ?? monthlyAmount * 12 * 0.9);
  return formatBRL(monthlyAmount);
};

const getOriginalDisplayPrice = (planId: PlanId, billingCycle: BillingCycle) => {
  const monthlyAmount = PLAN_MONTHLY_AMOUNTS[planId] ?? 0;
  if (billingCycle === "annual") {
    const annualAmount = PLAN_ANNUAL_AMOUNTS[planId] ?? monthlyAmount * 12 * 0.9;
    const fullYear = monthlyAmount * 12;
    return fullYear > annualAmount ? formatBRL(fullYear) : null;
  }
  const original = PLAN_ORIGINAL_MONTHLY_AMOUNTS[planId];
  return original ? formatBRL(original) : null;
};

const getSavingsDisplay = (originalPrice: string | null, currentPrice: string) => {
  if (!originalPrice) return null;
  const savings = parseBRL(originalPrice) - parseBRL(currentPrice);
  return savings > 0 ? formatBRL(savings) : null;
};

// Easing "ease-out expo" — mesma curva usada no onboarding, dá a sensação de
// entrada suave em vez do modal "aparecer seco".
const EASE = [0.22, 1, 0.36, 1] as const;

/** Placeholder animado exibido enquanto os planos "carregam". */
const SkeletonPlanCard = () => (
  <div className="rounded-[16px] border border-[#EAEAE8] bg-white p-5">
    <div className="flex items-center gap-3">
      <div className="h-[38px] w-[38px] shrink-0 animate-pulse rounded-[11px] bg-[#EDEDEB]" />
      <div className="h-4 w-20 animate-pulse rounded-full bg-[#EDEDEB]" />
    </div>
    <div className="mt-4 h-[28px] w-32 animate-pulse rounded-lg bg-[#EDEDEB]" />
    <div className="mt-4 h-[46px] w-full animate-pulse rounded-[10px] bg-[#E7E7E5]" />
    <div className="mt-4 space-y-2.5 border-t border-black/[0.06] pt-4">
      {[92, 78, 88, 70, 84, 64].map((width, index) => (
        <div key={width} className="flex items-center gap-2.5">
          <div
            className="h-[18px] w-[18px] shrink-0 animate-pulse rounded-full bg-[#EDEDEB]"
            style={{ animationDelay: `${index * 70}ms` }}
          />
          <div
            className="h-3 animate-pulse rounded-full bg-[#F0F0EE]"
            style={{ width: `${width}%`, animationDelay: `${index * 70}ms` }}
          />
        </div>
      ))}
    </div>
  </div>
);

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
  // Começa FECHADO. O modal é sempre disparado sob demanda via `open()` — hoje,
  // principalmente pelo step 3 do ImportProductModal, quando o usuário grátis
  // tenta publicar. Deixar `true` aqui faz ele abrir em toda página que estiver
  // dentro do provider (App.tsx), inclusive a home.
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
  const reduce = useReducedMotion();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPlanId, setSelectedPlanId] = useState<PlanId>(defaultPlan ?? "pro");

  // Ao reabrir com um plano padrão diferente, sincroniza a seleção.
  useEffect(() => {
    if (open) setSelectedPlanId(defaultPlan ?? "pro");
  }, [open, defaultPlan]);

  // Fecha com Esc e trava o scroll do body enquanto o modal está aberto.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Skeleton curto ao abrir: o conteúdo aparece carregando em vez de "pipocar"
  // pronto de uma vez.
  const [showSkeleton, setShowSkeleton] = useState(true);
  useEffect(() => {
    if (!open) return;
    setShowSkeleton(true);
    const timer = window.setTimeout(() => setShowSkeleton(false), reduce ? 0 : 620);
    return () => window.clearTimeout(timer);
  }, [open, reduce]);

  // Dispara o fluxo normal de checkout (Mercado Pago), indo direto ao passo de
  // pagamento. A lógica de preços/desconto continua no CheckoutPage.
  const handleChoose = (planId: PlanId) => {
    onClose();
    const params = new URLSearchParams({
      plan: planId,
      billing_cycle: billingCycle,
      skipSelect: "1",
    });
    navigate(`/checkout?${params.toString()}`);
  };

  const cardsContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.07 } },
  };

  const cardItem: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 16 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0.001 : 0.34, ease: EASE } },
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="plans-modal"
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 font-['Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] sm:p-6 md:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="Escolha o plano que combina com você"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.001 : 0.22, ease: EASE }}
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
          />

          <motion.div
            className="relative flex max-h-[88vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-[24px] bg-white text-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.28)]"
            initial={reduce ? false : { opacity: 0, y: 34, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.99 }}
            transition={{ duration: reduce ? 0.001 : 0.44, ease: EASE }}
          >
        {/* CABEÇALHO FIXO — banner de promoção no topo, título e toggle. */}
        <div className="shrink-0 px-6 pb-5 pt-5 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="absolute right-4 top-4 z-[1] flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X size={19} />
          </button>

          {/* Contador vem antes do título: é a informação com prazo, então
              ocupa a primeira linha que o usuário lê ao abrir o modal. */}
          <div className="pr-12">
            <PromoCountdown variant="clean" />
          </div>

          <div className="mt-5 px-8 text-center sm:px-10">
            <h2 className="text-[19px] font-extrabold leading-tight tracking-[-0.03em] text-[#0A0A0A] sm:text-[22px]">
              Escolha o plano que combina com você
            </h2>
            <p className="mt-1.5 text-[13px] leading-[18px] text-[#8A8A86]">
              O checkout continua seguro via Mercado Pago.
            </p>
          </div>

          {/* Alternador de cobrança em pílula segmentada, centralizado. */}
          <div className="mt-5 flex justify-center">
            <div className="inline-flex items-center rounded-full bg-[#F1F1EF] p-1">
              <button
                type="button"
                onClick={() => setBillingCycle("monthly")}
                aria-pressed={billingCycle === "monthly"}
                className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                  billingCycle === "monthly" ? "bg-white text-[#0A0A0A] shadow-sm" : "text-[#8A8A86] hover:text-[#3D3D3A]"
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle("annual")}
                aria-pressed={billingCycle === "annual"}
                className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${
                  billingCycle === "annual" ? "bg-white text-[#0A0A0A] shadow-sm" : "text-[#8A8A86] hover:text-[#3D3D3A]"
                }`}
              >
                Anual
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  −10%
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* CORPO ROLÁVEL — apenas a lista de planos rola quando não couber. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1 sm:px-8">
          {/* `mode="wait"` faz o skeleton terminar de sumir antes dos cards
              entrarem — sem isso os dois ocupam o grid ao mesmo tempo e a altura
              do modal dá um salto. */}
          <AnimatePresence mode="wait" initial={false}>
          {showSkeleton ? (
            <motion.div
              key="skeleton"
              className="grid items-stretch gap-4 md:grid-cols-3"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0.001 : 0.18, ease: EASE }}
            >
              {PLAN_ORDER.map((id) => (
                <SkeletonPlanCard key={id} />
              ))}
            </motion.div>
          ) : (
          <motion.div
            key="plans"
            className="grid items-stretch gap-4 md:grid-cols-3"
            variants={cardsContainer}
            initial="hidden"
            animate="show"
          >
            {PLAN_ORDER.map((id) => {
              const currentPlan = PLANS_DATA[id];
              const isSelected = id === selectedPlanId;
              const displayPrice = getDisplayPrice(id, billingCycle);
              const priceParts = splitPlanPrice(displayPrice);
              const originalPrice = getOriginalDisplayPrice(id, billingCycle);
              // Percentual de desconto (só apresentação — deriva dos mesmos
              // valores). Em BRL o texto "Economize R$X" é largo demais para caber
              // na linha do preço; o percentual (estilo "% OFF" da referência)
              // mantém tudo numa linha só.
              const percentOff = originalPrice
                ? Math.round(((parseBRL(originalPrice) - parseBRL(displayPrice)) / parseBRL(originalPrice)) * 100)
                : 0;

              // O plano do meio (Pro) segue sendo o destaque, mas só pelo badge
              // e pelo ícone sólido — sem contorno colorido.
              const isFeatured = id === "pro";

              return (
                <motion.article
                  key={id}
                  variants={cardItem}
                  onClick={() => setSelectedPlanId(id)}
                  className={`relative flex cursor-pointer flex-col rounded-[16px] border bg-white p-5 transition duration-200 ${
                    isSelected ? "border-black/20" : "border-[#EAEAE8] hover:border-black/20"
                  }`}
                >
                  {/* Ícone + nome + badge na mesma linha (como na referência),
                      sem parágrafo de descrição, para os benefícios subirem. */}
                  <div className="flex items-center gap-3">
                    <VeloMark size={38} tone={isFeatured ? "solid" : "soft"} />
                    <h3 className="text-[17px] font-bold tracking-[-0.02em] text-[#0A0A0A]">{currentPlan.name}</h3>
                    {currentPlan.badge && (
                      <span
                        className={`ml-auto whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none ${
                          isFeatured ? "bg-indigo-100 text-indigo-700" : "bg-[#F4F4F3] text-[#9A9A96]"
                        }`}
                      >
                        {currentPlan.badge}
                      </span>
                    )}
                  </div>

                  {/* Preço em UMA linha: riscado (menor/cinza) + preço grande +
                      badge "% OFF" + sufixo, tudo alinhado horizontalmente. */}
                  {/* Tudo numa linha só (como na referência). Os tamanhos aqui são
                      calibrados pra caber "R$ 39,90 R$ 29,90 25% OFF /mês" na
                      largura da coluna — em BRL isso é bem mais largo que o
                      "$39 $20" do design original. */}
                  {/* Preço numa linha só, na proporção da referência: o riscado
                      fica ~0.8x do preço cheio, ambos na MESMA cor sólida (os
                      centavos não são acinzentados — era o que mais destoava). */}
                  <div className="mt-4 flex min-h-[36px] flex-nowrap items-center gap-x-1.5 whitespace-nowrap">
                    {originalPrice && (
                      <span className="text-[16px] font-medium text-[#9CA3AF] line-through">{originalPrice}</span>
                    )}
                    <span className="text-[21px] font-extrabold leading-none tracking-[-0.03em] text-[#0A0A0A]">
                      {priceParts.main}
                      {priceParts.cents}
                    </span>
                    {percentOff > 0 && (
                      <span className="whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2 py-[3px] text-[11px] font-semibold leading-none text-emerald-600">
                        {percentOff}% OFF
                      </span>
                    )}
                    <span className="text-[12.5px] font-medium text-[#9CA3AF]">
                      {billingCycle === "annual" ? "/ano" : "/mês"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChoose(id);
                    }}
                    style={PRIMARY_BUTTON_STYLE}
                    className="mt-4 h-[46px] w-full rounded-[10px] px-4 text-[14px] font-semibold text-white transition-opacity duration-200 hover:opacity-90"
                  >
                    Assinar {currentPlan.name}
                  </button>

                  <ul className="mt-4 space-y-2.5 border-t border-black/[0.06] pt-4">
                    {currentPlan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-[#3D3D3A]">
                        <span className="mt-[1px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#111827]">
                          <Check size={11} className="text-white" strokeWidth={3} />
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </motion.article>
              );
            })}
          </motion.div>
          )}
          </AnimatePresence>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PlansUpgradeModal;
