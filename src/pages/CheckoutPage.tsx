import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Check, QrCode, CreditCard, Copy,
  CheckCircle2, HelpCircle, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MP_PUBLIC_KEY } from "@/lib/mercadopago";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { VeloLogo, VeloMark } from "@/components/VeloLogo";
import { markCompletedPayment, markReachedPayment } from "@/lib/onboardingAnalytics";
import { getReferralCode, markAffiliateReachedPayment } from "@/lib/affiliateFunnel";

type PaymentMethod = "pix" | "credit_card";
type CheckoutState = "idle" | "loading" | "pix_pending" | "success" | "error";
type BillingCycle = "monthly" | "annual";

type PlanData = {
  name: string;
  price: string;
  originalPrice?: string;
  description: string;
  badge?: string;
  features: string[];
};

const PLANS_DATA: Record<string, PlanData> = {
  base: {
    name: "Base",
    price: "R$ 97,00",
    description: "Pra quem quer começar a vender sem travar no operacional.",
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
    price: "R$ 149,90",
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
    price: "R$ 299,90",
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

const PLAN_AMOUNTS: Record<string, number> = {
  base: 97,
  pro: 149.9,
  business: 299.9,
};

const ANNUAL_PLAN_AMOUNTS: Record<string, number> = {
  base: 1047.6,   // 97 * 12 * 0.9
  pro: 1618.92,   // 149.90 * 12 * 0.9
  business: 3238.92, // 299.90 * 12 * 0.9
};

const splitPlanPrice = (price: string) => {
  const [main, cents = ""] = price.split(",");
  return { main, cents: cents ? `,${cents}` : "" };
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);

const TRIAL_AMOUNT = 29.9;
const TRIAL_DAYS = 5;
const TRIAL_AMOUNT_BRL = formatBRL(TRIAL_AMOUNT);

const parseBRL = (price: string) => Number(price.replace(/[^\d,]/g, "").replace(",", "."));

const getDisplayPrice = (planId: string, billingCycle: BillingCycle) => {
  const monthlyAmount = PLAN_AMOUNTS[planId] ?? 0;
  if (billingCycle === "annual") return formatBRL(ANNUAL_PLAN_AMOUNTS[planId] ?? monthlyAmount * 12 * 0.9);
  return PLANS_DATA[planId]?.price ?? formatBRL(monthlyAmount);
};

const getOriginalDisplayPrice = (planId: string, billingCycle: BillingCycle) => {
  // No anual, o preço "de" é o mensal x 12 — o que o usuário realmente pagaria
  // sem o desconto. É um valor praticado de verdade, não um número inflado para
  // simular promoção.
  if (billingCycle === "annual") {
    const monthlyAmount = PLAN_AMOUNTS[planId] ?? 0;
    const annualAmount = ANNUAL_PLAN_AMOUNTS[planId] ?? monthlyAmount * 12 * 0.9;
    const fullYear = monthlyAmount * 12;
    return fullYear > annualAmount ? formatBRL(fullYear) : null;
  }
  const originalPrice = PLANS_DATA[planId]?.originalPrice;
  return originalPrice ?? null;
};

const getSavingsDisplay = (originalPrice: string | null, currentPrice: string) => {
  if (!originalPrice) return null;
  const savings = parseBRL(originalPrice) - parseBRL(currentPrice);
  return savings > 0 ? formatBRL(savings) : null;
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();

  const rawPlan = searchParams.get("plan") ?? "pro";
  const initialPlanId = PLANS_DATA[rawPlan] ? rawPlan : "pro";
  // Trial de 5 dias descontinuado — todo checkout é assinatura mensal cheia.
  const isTrial = false;
  const initialBillingCycleParam = (
    searchParams.get("billing_cycle") ??
    searchParams.get("billing") ??
    searchParams.get("period") ??
    searchParams.get("cycle") ??
    ""
  ).toLowerCase();
  const initialBillingCycle: BillingCycle = ["annual", "anual", "yearly", "ano"].includes(initialBillingCycleParam)
    ? "annual"
    : "monthly";
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [showPaymentStep, setShowPaymentStep] = useState(isTrial);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
  const planId = selectedPlanId;
  const plan = PLANS_DATA[planId];
  const recurringPrice = getDisplayPrice(planId, billingCycle);
  const recurringCycleLabel = billingCycle === "annual" ? "anual" : "mensal";
  const recurringPeriodLabel = billingCycle === "annual" ? "/ ano" : "/ mês";
  const checkoutPrice = isTrial ? TRIAL_AMOUNT_BRL : recurringPrice;
  const checkoutPeriodLabel = isTrial ? `por ${TRIAL_DAYS} dias` : billingCycle === "annual" ? "por ano" : "por mês";
  const checkoutDescription = isTrial
    ? `Trial de ${TRIAL_DAYS} dias do plano Pro. Depois, sua assinatura continua automaticamente no plano Pro (R$99,90/mês).`
    : `Assinatura ${recurringCycleLabel} do plano ${plan.name}`;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("pix");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [pixData, setPixData] = useState<{ qr_code_base64: string; copy_paste: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("Brasil");
  const [address, setAddress] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
  }, [session, email]);

  useEffect(() => {
    if (!showPaymentStep || !session?.user?.id) return;
    void markReachedPayment(session.user.id, { route: "/checkout", plan: planId });
    void markAffiliateReachedPayment(
      session.user.id,
      isTrial
        ? TRIAL_AMOUNT
        : billingCycle === "annual"
          ? ANNUAL_PLAN_AMOUNTS[planId] ?? (PLAN_AMOUNTS[planId] ?? 0) * 12 * 0.9
          : PLAN_AMOUNTS[planId] ?? 0
    );
  }, [billingCycle, isTrial, planId, session?.user?.id, showPaymentStep]);

  // Polling: a cada 5s verifica se o pagamento foi aprovado
  useEffect(() => {
    if (checkoutState !== "pix_pending" || !session) return;

    const tick = async () => {
      try {
        const { data } = await supabase.functions.invoke("mp-verify-payment");
        if (data?.status === "active") {
          setCheckoutState("success");
          void markCompletedPayment(session.user.id, { route: "/checkout", plan: planId, source: "polling" });
          toast.success("Plano ativado com sucesso.");
          if (pollRef.current) window.clearInterval(pollRef.current);
          setTimeout(() => navigate("/dashboard"), 1500);
        }
      } catch (e) {
        console.error("polling error", e);
      }
    };

    tick();
    pollRef.current = window.setInterval(tick, 5000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [checkoutState, session, navigate]);

  const handleManualVerify = async () => {
    setVerifying(true);
    const toastId = toast.loading("Verificando pagamento...");
    try {
      const { data } = await supabase.functions.invoke("mp-verify-payment");
      if (data?.status === "active") {
        setCheckoutState("success");
        if (session?.user?.id) {
          void markCompletedPayment(session.user.id, { route: "/checkout", plan: planId, source: "manual_verify" });
        }
        toast.success("Plano ativado com sucesso.", { id: toastId });
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        toast.info("Pagamento ainda não confirmado. Aguarde alguns segundos.", { id: toastId });
      }
    } catch {
      toast.error("Erro ao verificar pagamento.", { id: toastId });
    } finally {
      setVerifying(false);
    }
  };

  const handleCheckout = async () => {
    if (!session) {
      toast.error("Você precisa estar logado");
      navigate("/login");
      return;
    }
    if (!acceptTerms) {
      toast.error("Você precisa aceitar os Termos de Uso.");
      return;
    }
    if (!acceptPrivacy) {
      toast.error("Você precisa aceitar a Política de Privacidade.");
      return;
    }

    setCheckoutState("loading");
    const toastId = toast.loading(selectedMethod === "pix" ? "Gerando pagamento Pix..." : "Processando pagamento...");

    try {
      const payload: Record<string, unknown> = {
        plan: planId,
        billing_cycle: billingCycle,
        payment_method: selectedMethod,
        trial: isTrial,
      };
      const referralCode = getReferralCode();
      if (referralCode) {
        payload.affiliate_ref = referralCode;
        payload.plan_price = billingCycle === "annual"
          ? ANNUAL_PLAN_AMOUNTS[planId] ?? (PLAN_AMOUNTS[planId] ?? 0) * 12 * 0.9
          : isTrial ? TRIAL_AMOUNT : PLAN_AMOUNTS[planId] ?? undefined;
      }

      if (selectedMethod === "credit_card") {
        if (!MP_PUBLIC_KEY || MP_PUBLIC_KEY.includes("PLACEHOLDER")) {
          toast.error("Chave pública do Mercado Pago não configurada.", { id: toastId });
          setCheckoutState("idle");
          return;
        }
        // @ts-ignore - MercadoPago SDK loaded via script tag
        const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });
        const [expMonth, expYear] = cardExpiry.split("/");
        const cardTokenRes = await mp.createCardToken({
          cardNumber: cardNumber.replace(/\s/g, ""),
          cardholderName: cardHolder,
          cardExpirationMonth: expMonth?.trim(),
          cardExpirationYear: expYear?.trim()?.length === 2 ? `20${expYear.trim()}` : expYear?.trim(),
          securityCode: cardCvc,
          identificationType: "CPF",
          identificationNumber: "00000000000",
        });

        if (!cardTokenRes?.id) {
          toast.error("Erro ao processar cartão. Verifique os dados.", { id: toastId });
          setCheckoutState("idle");
          return;
        }

        payload.card_token = cardTokenRes.id;
        payload.installments = 1;
      }

      const { data, error } = await supabase.functions.invoke("mp-checkout", { body: payload });
      if (error) throw error;

      if (data.status === "approved") {
        setCheckoutState("success");
        if (session?.user?.id) {
          void markCompletedPayment(session.user.id, { route: "/checkout", plan: planId, source: "checkout" });
        }
        toast.success("Pagamento aprovado. Plano ativado com sucesso.", { id: toastId });
      } else if (data.pix_qr_code_base64) {
        setPixData({ qr_code_base64: data.pix_qr_code_base64, copy_paste: data.pix_copy_paste });
        setCheckoutState("pix_pending");
        toast.info("QR Code Pix gerado. Escaneie para pagar.", { id: toastId });
      } else {
        setCheckoutState("error");
        toast.error("Pagamento não aprovado. Tente novamente.", { id: toastId });
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutState("error");
      toast.error("Erro ao processar pagamento.", { id: toastId });
    }
  };

  const copyPix = () => {
    if (pixData?.copy_paste) {
      navigator.clipboard.writeText(pixData.copy_paste);
      setCopied(true);
      toast.success("Código Pix copiado.");
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const startCheckout = (nextPlanId = selectedPlanId) => {
    setSelectedPlanId(nextPlanId);
    setShowPaymentStep(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (checkoutState === "success") {
    return (
      <div className="min-h-screen bg-[#F5F6FA] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm max-w-md w-full">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 size={36} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Pagamento aprovado!</h2>
          <p className="mt-2 mb-8 text-gray-500">Seu plano {plan.name} está ativo. Aproveite todos os recursos!</p>
          <button
            onClick={() => navigate("/dashboard/produtos")}
            className="w-full rounded-xl bg-gray-900 py-3 text-sm font-semibold text-white hover:bg-black transition-colors"
          >
            Ir para o dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!showPaymentStep) {
    const plans = Object.entries(PLANS_DATA);

    return (
      <div className="min-h-screen overflow-hidden bg-white font-['Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#111111]">
        <div className="relative min-h-screen w-full">
          <section className="min-h-screen w-full bg-white px-4 py-6 sm:px-6 lg:px-10">
            {/* Marca à esquerda e progresso do checkout ao centro. As três
                etapas espelham o fluxo real: plano -> pagamento -> confirmação;
                aqui estamos sempre na primeira. */}
            <div className="mx-auto mb-10 grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F3F2] text-black transition hover:bg-[#E9E9E7]"
                  aria-label="Voltar"
                >
                  <ArrowLeft size={18} />
                </button>
                <VeloMark size={34} />
              </div>

              <div className="flex items-center gap-2" role="presentation">
                {[0, 1, 2].map((step) => (
                  <span
                    key={step}
                    // Largura menor no mobile: com 86px fixos as três barras não
                    // cabem ao lado da marca e a última era cortada pelo
                    // overflow-hidden do container.
                    className={`h-[5px] w-[42px] rounded-full transition-colors sm:w-[86px] ${
                      step === 0 ? "bg-[#0A0A0A]" : "bg-[#E9E9E7]"
                    }`}
                  />
                ))}
              </div>

              <span aria-hidden="true" />
            </div>

            {/* Cabeçalho: título à esquerda, alternador de cobrança à direita. */}
            <div className="mx-auto flex max-w-6xl flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-[24px] font-bold tracking-[-0.015em] text-[#0A0A0A] sm:text-[27px]">
                  Escolha o plano que combina com você
                </h1>
                <p className="mt-1.5 text-[13px] leading-5 text-[#8A8A86]">
                  O checkout continua seguro via Mercado Pago.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBillingCycle((current) => (current === "monthly" ? "annual" : "monthly"))}
                className="flex w-fit shrink-0 items-center gap-2.5 text-[13px] font-medium text-[#3D3D3A] transition"
                aria-pressed={billingCycle === "annual"}
              >
                <span
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
                    billingCycle === "annual" ? "bg-[#0A0A0A]" : "bg-[#DFDEDA]"
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.20)] transition-transform duration-200 ${
                      billingCycle === "annual" ? "translate-x-[18px]" : "translate-x-0"
                    }`}
                  />
                </span>
                Cobrança anual
                <span className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                  Economize 10%
                </span>
              </button>
            </div>

            {/* Três planos lado a lado. Antes era md:grid-cols-2 com 3 planos, o
                que jogava o Business sozinho para uma segunda linha. */}
            <div className="mx-auto mt-7 grid max-w-6xl items-stretch gap-5 md:grid-cols-3">
              {plans.map(([id, currentPlan]) => {
                const isSelected = id === selectedPlanId;
                const displayPrice = getDisplayPrice(id, billingCycle);
                const priceParts = splitPlanPrice(displayPrice);
                const originalPrice = getOriginalDisplayPrice(id, billingCycle);
                const savings = getSavingsDisplay(originalPrice, displayPrice);

                // O plano em destaque ganha borda de cor e CTA sólido, como no
                // card "Most Popular" de referência.
                const isFeatured = id === "pro";

                return (
                  <article
                    key={id}
                    onClick={() => setSelectedPlanId(id)}
                    className={`relative flex cursor-pointer flex-col rounded-[16px] border bg-white p-6 transition duration-200 ${
                      isFeatured
                        ? "border-[#0A0A0A] shadow-[0_10px_36px_rgba(0,0,0,0.09)]"
                        : isSelected
                          ? "border-black/25"
                          : "border-black/10 hover:border-black/25"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Marca da Velo com tratamento tonal por plano: o plano em
                          destaque vem sólido, os demais em cinza claro. */}
                      <VeloMark size={44} tone={isFeatured ? "solid" : "soft"} />
                      {currentPlan.badge && (
                        <span
                          className={`rounded-[6px] px-2 py-[3px] text-[11px] font-semibold leading-[16px] ${
                            isFeatured ? "bg-[#F1F1EF] text-[#0A0A0A]" : "bg-[#F6F6F5] text-[#8A8A86]"
                          }`}
                        >
                          {currentPlan.badge}
                        </span>
                      )}
                    </div>

                    <h2 className="mt-5 text-[19px] font-bold tracking-[-0.015em] text-[#0A0A0A]">{currentPlan.name}</h2>
                    {/* Altura fixa: as descrições têm tamanhos diferentes e, sem
                        isso, preço e CTA saem desalinhados entre os cards. */}
                    <p className="mt-1.5 min-h-[60px] text-[13px] leading-5 text-[#777]">{currentPlan.description}</p>

                    <div className="mt-5">
                      {originalPrice && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-semibold text-[#A8A8A3] line-through">{originalPrice}</span>
                          {savings && (
                            <span className="whitespace-nowrap rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Economize {savings}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-1 flex items-end gap-1">
                        <span className="text-[32px] font-semibold tracking-[-0.045em] text-black">
                          {priceParts.main}
                          <span className="text-[#A8A8A3]">{priceParts.cents}</span>
                        </span>
                        <span className="pb-1.5 text-[14px] font-medium text-[#7A7A77]">
                          {billingCycle === "annual" ? "/ano" : "/mês"}
                        </span>
                      </div>
                    </div>

                    {/* CTA acima da lista de recursos. */}
                    <button
                      type="button"
                      onClick={() => startCheckout(id)}
                      className={`mt-5 h-11 w-full rounded-[10px] border px-5 text-[13px] font-semibold transition-colors duration-200 ${
                        isFeatured
                          ? "border-[#0A0A0A] bg-[#0A0A0A] text-white hover:bg-[#242424]"
                          : // Vazado por padrão; preenche só com o mouse sobre o
                            // próprio botão.
                            "border-black/15 bg-white text-black hover:border-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white"
                      }`}
                    >
                      Assinar {currentPlan.name}
                    </button>

                    <p className="mb-3 mt-6 text-[13px] font-semibold text-black">O que está incluído:</p>
                    <ul className="space-y-2.5">
                      {currentPlan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-[#3D3D3A]">
                          <Check size={14} className="mt-[3px] shrink-0 text-[#0A0A0A]" strokeWidth={2.6} />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </article>
                );
              })}
            </div>

            <div className="mx-auto mt-6 flex max-w-6xl flex-col items-center gap-3 rounded-[16px] border border-black/10 bg-[#FAFAFA] px-6 py-5 text-center sm:flex-row sm:justify-center sm:text-left">
              <HelpCircle size={18} strokeWidth={2.1} className="shrink-0 text-[#8A8A86]" />
              <p className="text-[13px] leading-5 text-[#5C5C58]">
                Não tem certeza de qual plano escolher?{" "}
                <span className="text-[#8A8A86]">Comece pelo Pro — dá para ajustar depois.</span>
              </p>
              <button
                type="button"
                onClick={() => startCheckout("pro")}
                className="h-9 shrink-0 rounded-[10px] border border-black/15 bg-white px-5 text-[12px] font-semibold text-black transition hover:border-black/40 hover:bg-black/[0.03] sm:ml-2"
              >
                Continuar com Pro
              </button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-['Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#111111]">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-2">
        {/* LEFT — plan summary */}
        <aside className="relative overflow-hidden border-b border-white/[0.08] bg-[#080808] px-6 py-8 text-white sm:px-10 lg:flex lg:min-h-screen lg:items-start lg:justify-end lg:border-b-0 lg:border-r lg:border-white/[0.08] lg:px-16 lg:py-12">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_15%,rgba(255,255,255,0.08),transparent_32%),linear-gradient(145deg,rgba(255,255,255,0.045),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.045] [background-image:radial-gradient(circle,rgba(255,255,255,0.65)_0.7px,transparent_0.7px)] [background-size:5px_5px]" />
          <div className="relative w-full max-w-[440px]">
          <div className="mb-12 flex items-center gap-3">
            <button
              onClick={() => setShowPaymentStep(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/42 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
            <VeloLogo size="md" variant="light" />
          </div>

          <div>
            <p className="mb-3 text-[13px] font-medium text-white/45">{isTrial ? "Iniciar trial Pro" : `Assinar plano ${plan.name}`}</p>
            <h1 className="text-[44px] font-semibold leading-none tracking-[-0.045em] text-white sm:text-[52px]">
              {checkoutPrice} {checkoutPeriodLabel}
            </h1>
            <p className="mt-4 max-w-[320px] text-[15px] font-medium leading-6 text-white/54">
              {checkoutDescription}
            </p>

            <div className="mt-12 border-y border-white/[0.08] py-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[14px] font-semibold text-white">{isTrial ? "Trial Pro" : plan.name}</p>
                  <p className="mt-1 text-[12px] text-white/42">
                    {isTrial ? `${TRIAL_DAYS} dias de trial` : `Cobrança ${recurringCycleLabel}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-white">{checkoutPrice}</p>
                  <p className="mt-1 text-[12px] text-white/42">{isTrial ? `/ ${TRIAL_DAYS} dias` : recurringPeriodLabel}</p>
                </div>
              </div>

              <ul className="mt-5 space-y-2">
                {plan.features.slice(0, 5).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-white/58">
                    <Check size={13} className="mt-0.5 shrink-0 text-white/86" strokeWidth={2.5} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-5 py-7 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-white/66">Subtotal</span>
                <span className="font-semibold text-white">{checkoutPrice}</span>
              </div>

              <div>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Adicionar código promocional"
                  className="h-10 w-full max-w-[250px] rounded-md border border-white/[0.08] bg-white/[0.045] px-3 text-[13px] text-white placeholder:text-white/32 outline-none transition focus:border-white/18 focus:bg-white/[0.07]"
                />
              </div>

              <div className="border-t border-white/[0.08] pt-6">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white/66">
                    {isTrial ? "Depois do trial" : billingCycle === "annual" ? "Total anual" : "Total mensal"}
                  </span>
                  <span className="font-semibold text-white">{isTrial ? "R$ 99,90/mês" : checkoutPrice}</span>
                </div>
                <div className="mt-7 flex items-center justify-between">
                  <span className="font-semibold text-white/66">Total devido hoje</span>
                  <span className="font-semibold text-white">{checkoutPrice}</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </aside>

        {/* RIGHT — payment form */}
        <main className="bg-white px-6 py-8 sm:px-10 lg:flex lg:min-h-screen lg:items-start lg:px-16 lg:py-12">
          <div className="mx-auto w-full max-w-[430px]">
            <button
              type="button"
              onClick={() => setSelectedMethod("pix")}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#00C853] px-4 text-[15px] font-semibold text-white transition hover:bg-[#00b94d]"
            >
              Pagar com Pix
              <QrCode size={17} />
            </button>

            <div className="my-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-gray-100" />
              <span className="text-[11px] font-semibold uppercase text-gray-400">OU</span>
              <div className="h-px flex-1 bg-gray-100" />
            </div>

            <h2 className="mb-5 text-[21px] font-semibold tracking-[-0.03em] text-gray-950">
              Insira os dados de pagamento
            </h2>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-gray-700">E-mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                />
              </label>

              <div>
                <p className="mb-2 text-[13px] font-semibold text-gray-700">Método de pagamento</p>
                <div className="overflow-hidden rounded-md border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("pix")}
                    className={`flex h-12 w-full items-center justify-between border-b border-gray-100 px-3 text-left transition ${
                      selectedMethod === "pix" ? "bg-gray-50" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-gray-800">
                      <QrCode size={15} className="text-green-600" />
                      Pix
                    </span>
                    <span className={`h-4 w-4 rounded-full border ${selectedMethod === "pix" ? "border-gray-900 bg-gray-900 shadow-[inset_0_0_0_4px_white]" : "border-gray-300"}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedMethod("credit_card")}
                    className={`flex h-12 w-full items-center justify-between px-3 text-left transition ${
                      selectedMethod === "credit_card" ? "bg-gray-50" : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-[14px] font-semibold text-gray-800">
                      <CreditCard size={15} className="text-blue-600" />
                      Cartão
                    </span>
                    <span className={`h-4 w-4 rounded-full border ${selectedMethod === "credit_card" ? "border-gray-900 bg-gray-900 shadow-[inset_0_0_0_4px_white]" : "border-gray-300"}`} />
                  </button>
                </div>
              </div>

              {selectedMethod === "credit_card" && (
                <div className="rounded-md border border-gray-200 p-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-gray-700">Número do cartão</span>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="1234 1234 1234 1234"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        maxLength={19}
                        className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 pr-20 text-[14px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      />
                      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                        <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-blue-700">VISA</span>
                        <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-orange-600">MC</span>
                      </div>
                    </div>
                  </label>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-gray-700">Data de validade</span>
                      <input
                        type="text"
                        placeholder="MM / AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        maxLength={5}
                        className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-[13px] font-medium text-gray-700">Código de segurança</span>
                      <input
                        type="text"
                        placeholder="CVC"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        maxLength={4}
                        className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                      />
                    </label>
                  </div>
                </div>
              )}

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-gray-700">Nome completo</span>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  placeholder="Seu nome completo"
                  className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-gray-700">País ou região</span>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none transition focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                >
                  <option>Brasil</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[13px] font-semibold text-gray-700">Endereço</span>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Rua, número, complemento"
                  className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
                />
              </label>
            </div>

            {checkoutState === "pix_pending" && pixData && (
              <div className="mt-6 rounded-md border border-gray-200 bg-white p-5 text-center">
                <h3 className="text-[15px] font-semibold text-gray-900">Escaneie o QR Code para pagar</h3>
                <p className="mt-1 text-[13px] text-gray-500">Abra o app do seu banco e escaneie o código abaixo.</p>
                {pixData.qr_code_base64 && (
                  <div className="mt-4 flex justify-center">
                    <img
                      src={`data:image/png;base64,${pixData.qr_code_base64}`}
                      alt="QR Code Pix"
                      className="h-44 w-44 rounded-md border border-gray-100"
                    />
                  </div>
                )}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                  <button
                    onClick={copyPix}
                    className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-200 px-4 py-2.5 text-[13px] font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {copied ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                    {copied ? "Copiado!" : "Copiar código Pix"}
                  </button>
                  <button
                    onClick={handleManualVerify}
                    disabled={verifying}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-black disabled:opacity-60"
                  >
                    {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Já paguei
                  </button>
                </div>
                <p className="mt-3 text-[12px] text-gray-400">Verificamos seu pagamento automaticamente a cada 5 segundos.</p>
              </div>
            )}

            {checkoutState !== "pix_pending" && (
              <>
                <div className="mt-6 space-y-2.5 text-[12.5px] leading-[1.55] text-white/70">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-[3px] h-4 w-4 shrink-0 cursor-pointer accent-white"
                    />
                    <span>
                      Li e aceito os{" "}
                      <Link to="/termos" target="_blank" className="text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">
                        Termos de Uso
                      </Link>
                      .
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={acceptPrivacy}
                      onChange={(e) => setAcceptPrivacy(e.target.checked)}
                      className="mt-[3px] h-4 w-4 shrink-0 cursor-pointer accent-white"
                    />
                    <span>
                      Li e aceito a{" "}
                      <Link to="/privacidade" target="_blank" className="text-white underline decoration-white/30 underline-offset-2 hover:decoration-white">
                        Política de Privacidade
                      </Link>
                      .
                    </span>
                  </label>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={checkoutState === "loading" || !acceptTerms || !acceptPrivacy}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-[15px] font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {checkoutState === "loading" ? (
                    <><Loader2 size={16} className="animate-spin" /> Processando...</>
                  ) : (
                    `Pagar ${checkoutPrice}`
                  )}
                </button>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CheckoutPage;
