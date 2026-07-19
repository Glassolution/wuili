import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, X, Rocket, Sparkles, Crown } from "lucide-react";
import PromoCountdown from "@/components/PromoCountdown";

type BillingCycle = "monthly" | "annual";

type PlanId = "base" | "pro" | "business";

type PlanEntry = {
  id: PlanId;
  name: string;
  icon: typeof Rocket;
  iconBg: string;
  iconColor: string;
  tagline: string;
  monthly: number;
  annual: number;
  originalMonthly?: number;
  ribbon?: string;
  highlighted?: boolean;
  features: string[];
};

const PLANS: PlanEntry[] = [
  {
    id: "base",
    name: "Plano Base",
    icon: Rocket,
    iconBg: "bg-slate-100",
    iconColor: "text-slate-600",
    tagline: "Pra quem quer começar a vender sem travar no operacional.",
    monthly: 29.9,
    originalMonthly: 39.9,
    annual: 322.92,
    features: [
      "Importação automática de até 50 produtos por mês pro Mercado Livre",
      "1 página de vendas gerada por IA por mês",
      "Acesso completo ao catálogo validado da Velo",
      "Subdomínio grátis (seunome.velo.store)",
      "Suporte por e-mail",
    ],
  },
  {
    id: "pro",
    name: "Plano Pro",
    icon: Sparkles,
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
    tagline: "Pra quem já vendeu e quer parar de fazer tudo na mão.",
    monthly: 79.8,
    annual: 861.84,
    ribbon: "Mais escolhido",
    highlighted: true,
    features: [
      "Importação automática de até 200 produtos por mês pro Mercado Livre",
      "5 páginas de vendas geradas por IA por mês",
      "3 lojas completas geradas por IA",
      "Domínio próprio grátis",
      "Atualização automática de preço e estoque",
      "Suporte prioritário",
    ],
  },
  {
    id: "business",
    name: "Plano Business",
    icon: Crown,
    iconBg: "bg-amber-100",
    iconColor: "text-amber-600",
    tagline: "Pra quem já vive disso e quer parar de contar produto.",
    monthly: 159.6,
    annual: 1723.68,
    features: [
      "Importação ilimitada de produtos pro Mercado Livre",
      "Páginas de vendas ilimitadas",
      "Lojas completas ilimitadas",
      "Domínio próprio grátis em todas as lojas",
      "Suporte prioritário com atendimento dedicado",
    ],
  },
];

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);

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

  if (!open) return null;

  const handleChoose = (planId: PlanId) => {
    onClose();
    const params = new URLSearchParams({
      plan: planId,
      billing_cycle: cycle,
      skipSelect: "1",
    });
    navigate(`/checkout?${params.toString()}`);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
      />

      <div className="relative w-full max-w-[1120px] max-h-[92vh] overflow-y-auto rounded-[24px] bg-white shadow-[0_40px_120px_rgba(0,0,0,0.35)] px-6 py-8 sm:px-10 sm:py-10">
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar modal"
          className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          <X size={18} />
        </button>

        <div className="text-center">
          <h2 className="text-[26px] font-bold tracking-[-0.01em] text-zinc-950 sm:text-[30px]">
            Fazer upgrade do plano
          </h2>
          <p className="mt-2 text-[14px] text-zinc-500">
            Comprometa-se e leve seu negócio ao próximo nível.
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full bg-zinc-100 p-1">
            <button
              type="button"
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-5 py-2 text-[13px] font-semibold transition ${
                cycle === "monthly" ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Mensal
            </button>
            <button
              type="button"
              onClick={() => setCycle("annual")}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-[13px] font-semibold transition ${
                cycle === "annual" ? "bg-zinc-900 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              Anual
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                2 MESES GRÁTIS
              </span>
            </button>
          </div>
        </div>

        <div className="mt-6">
          <PromoCountdown />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon;
            const price = cycle === "monthly" ? plan.monthly : plan.annual / 12;
            const originalMonthly = cycle === "annual"
              ? (plan.originalMonthly ?? plan.monthly)
              : plan.originalMonthly ?? null;
            const isHighlighted = plan.highlighted || plan.id === defaultPlan;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-[18px] border-2 bg-white p-6 transition ${
                  isHighlighted
                    ? "border-indigo-500 shadow-[0_20px_60px_rgba(79,70,229,0.18)]"
                    : "border-zinc-200"
                }`}
              >
                {plan.ribbon && (
                  <span className="absolute -top-3 right-5 rounded-full bg-indigo-500 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white shadow-sm">
                    {plan.ribbon}
                  </span>
                )}

                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${plan.iconBg}`}>
                    <Icon size={22} className={plan.iconColor} strokeWidth={2.2} />
                  </div>
                  <h3 className="text-[17px] font-bold text-zinc-900">{plan.name}</h3>
                </div>

                <p className="mt-3 text-[13px] leading-5 text-zinc-500">{plan.tagline}</p>

                <div className="mt-5 flex items-end gap-2">
                  {originalMonthly && (
                    <span className="pb-2 text-[15px] font-medium text-zinc-400 line-through">
                      {formatBRL(originalMonthly)}
                    </span>
                  )}
                  <span className="text-[34px] font-extrabold tracking-[-0.02em] text-zinc-950">
                    {formatBRL(price)}
                  </span>
                  <span className="pb-2 text-[13px] font-medium text-zinc-500">/mês</span>
                </div>
                {cycle === "annual" && (
                  <p className="mt-1 text-[11px] font-semibold text-emerald-600">
                    Cobrado {formatBRL(plan.annual)} por ano
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => handleChoose(plan.id)}
                  className={`mt-5 w-full rounded-xl py-3 text-[14px] font-semibold transition ${
                    isHighlighted
                      ? "bg-zinc-900 text-white hover:bg-black"
                      : "bg-zinc-900 text-white hover:bg-black"
                  }`}
                >
                  Escolher plano
                </button>

                <div className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-2.5 text-[13px] text-zinc-700">
                      <span className="mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <Check size={11} className="text-emerald-600" strokeWidth={3} />
                      </span>
                      <span className="leading-5">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-[12px] text-zinc-400">
          O checkout continua seguro via Mercado Pago. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
};

export default PlansUpgradeModal;
