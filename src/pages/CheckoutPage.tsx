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
import { VeloMark } from "@/components/VeloLogo";
import { markCompletedPayment, markReachedPayment } from "@/lib/onboardingAnalytics";
import { getReferralCode, markAffiliateReachedPayment } from "@/lib/affiliateFunnel";
import { startValidaPayCheckout, type VelloPlanId } from "@/lib/validapayCheckout";


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
    price: "R$ 39,90",
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
    price: "R$ 79,80",
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
    price: "R$ 159,60",
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
  base: 39.9,
  pro: 79.8,
  business: 159.6,
};

const ANNUAL_PLAN_AMOUNTS: Record<string, number> = {
  base: 430.92,   // 39.90 * 12 * 0.9
  pro: 861.84,    // 79.80 * 12 * 0.9
  business: 1723.68, // 159.60 * 12 * 0.9
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
  // Destaque visual (borda preta, sombra, logo sólido) segue o hover do mouse,
  // não mais o plano selecionado. A seleção continua no clique e alimenta o
  // resumo/checkout ao lado.
  const [hoveredPlanId, setHoveredPlanId] = useState<string | null>(null);
  const skipSelect = searchParams.get("skipSelect") === "1";
  const directPaymentStep = searchParams.get("step") === "payment";
  const [showPaymentStep, setShowPaymentStep] = useState(isTrial || skipSelect || directPaymentStep);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
  const planId = selectedPlanId;
  const plan = PLANS_DATA[planId];
  const recurringPrice = getDisplayPrice(planId, billingCycle);
  const recurringCycleLabel = billingCycle === "annual" ? "anual" : "mensal";
  const recurringPeriodLabel = billingCycle === "annual" ? "/ ano" : "/ mês";
  const checkoutPrice = isTrial ? TRIAL_AMOUNT_BRL : recurringPrice;
  const checkoutPeriodLabel = isTrial ? `por ${TRIAL_DAYS} dias` : billingCycle === "annual" ? "por ano" : "por mês";
  const checkoutDescription = isTrial
    ? `Trial de ${TRIAL_DAYS} dias do plano Pro. Depois, sua assinatura continua automaticamente no plano Pro (R$79,80/mês).`
    : `Assinatura ${recurringCycleLabel} do plano ${plan.name}`;

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("credit_card");
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
  const [referralDiscount, setReferralDiscount] = useState(0);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (session?.user?.email && !email) setEmail(session.user.email);
  }, [session, email]);

  // Detecta se o usuário tem desconto de indicação disponível (convidado ou convidador com reward).
  useEffect(() => {
    const userId = session?.user?.id;
    const userEmail = session?.user?.email;
    if (!userId) return;
    let cancelled = false;
    (async () => {
      // Se já tem assinatura paga ativa, não aplica.
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("plan,status")
        .eq("user_id", userId);
      const hasPaid = (subs ?? []).some((s) => {
        const p = String(s.plan ?? "").toLowerCase();
        return p && p !== "gratis" && p !== "free" && s.status === "active";
      });

      // 1) Convidado com desconto — só se veio pelo link do convite (invited_user_id preenchido via /convite/:token)
      if (!hasPaid) {
        const nowIso = new Date().toISOString();
        const { data: ref } = await supabase
          .from("referrals")
          .select("id,expires_at,invited_rewarded,status")
          .eq("invited_user_id", userId)
          .eq("status", "linked")
          .eq("invited_rewarded", false)
          .gt("expires_at", nowIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!cancelled && ref) {
          setReferralDiscount(15);
          return;
        }
      }

      // 2) Convidador com recompensa disponível
      const { data: rewardRef } = await supabase
        .from("referrals")
        .select("id")
        .eq("inviter_id", userId)
        .eq("status", "subscribed")
        .eq("inviter_rewarded", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled && rewardRef) setReferralDiscount(15);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.user?.email]);

  const applyReferral = (brl: string) => {
    if (!referralDiscount) return brl;
    const n = parseBRL(brl);
    return formatBRL(n * (1 - referralDiscount / 100));
  };
  const hasReferralDiscount = referralDiscount > 0;
  const originalCheckoutPrice = checkoutPrice;
  const finalCheckoutPrice = hasReferralDiscount ? applyReferral(checkoutPrice) : checkoutPrice;

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
    const toastId = toast.loading("Abrindo checkout seguro...");

    // Gateway atual da Velo: ValidaPay (Pix + cartão em até 12x) no checkout
    // hospedado. O antigo mp-checkout ficou com token inválido e derrubava o
    // pagamento antes mesmo de gerar a cobrança.
    const validapay = await startValidaPayCheckout(
      planId as VelloPlanId,
      billingCycle === "annual" ? "annual" : "monthly",
    );
    if (validapay.ok) {
      toast.success("Redirecionando para o pagamento...", { id: toastId });
      return;
    }
    toast.error(validapay.error ?? "Não foi possível gerar o pagamento.", { id: toastId });
    setCheckoutState("idle");
    return;

    // eslint-disable-next-line no-unreachable
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


            {hasReferralDiscount && (
              <div className="mx-auto mt-4 flex max-w-6xl items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-800">
                🎉 Você tem 15% de desconto por indicação — já aplicado nos preços abaixo.
              </div>
            )}


            {/* Três planos lado a lado. Antes era md:grid-cols-2 com 3 planos, o
                que jogava o Business sozinho para uma segunda linha. */}
            <div className="mx-auto mt-7 grid max-w-6xl items-stretch gap-5 md:grid-cols-3">
              {plans.map(([id, currentPlan]) => {
                const isSelected = id === selectedPlanId;
                const rawDisplayPrice = getDisplayPrice(id, billingCycle);
                const displayPrice = hasReferralDiscount ? applyReferral(rawDisplayPrice) : rawDisplayPrice;
                const priceParts = splitPlanPrice(displayPrice);
                const originalPrice = hasReferralDiscount
                  ? rawDisplayPrice
                  : getOriginalDisplayPrice(id, billingCycle);
                const savings = hasReferralDiscount ? null : getSavingsDisplay(originalPrice, displayPrice);

                // O destaque (borda preta, ícone sólido, sombra, elevação) segue o
                // card sob o mouse — não mais o plano selecionado.
                const isFeatured = hoveredPlanId === id;

                return (
                  <article
                    key={id}
                    onClick={() => setSelectedPlanId(id)}
                    onMouseEnter={() => setHoveredPlanId(id)}
                    onMouseLeave={() => setHoveredPlanId((cur) => (cur === id ? null : cur))}
                    className={`relative flex cursor-pointer flex-col rounded-[16px] border bg-white p-6 transition-all duration-300 ease-out will-change-transform ${
                      isFeatured
                        ? "-translate-y-1.5 border-[#0A0A0A] shadow-[0_16px_44px_rgba(0,0,0,0.12)]"
                        : "translate-y-0 border-black/10 shadow-none"
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
                          {hasReferralDiscount ? (
                            <span className="whitespace-nowrap rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              -15% indicação
                            </span>
                          ) : savings ? (
                            <span className="whitespace-nowrap rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                              Economize {savings}
                            </span>
                          ) : null}
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
                      className="mt-5 h-11 w-full rounded-[10px] border border-[#0A0A0A] bg-[#0A0A0A] px-5 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-[#242424]"
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

  const summaryIconTone = planId === "business" ? "dark" : planId === "pro" ? "violet" : "solid";

  return (
    <div className="min-h-screen bg-[#F7F7F5] font-['Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#0A0A0A]">
      <main className="mx-auto min-h-screen w-full max-w-[1180px] px-6 py-10 lg:px-10 lg:py-12">
        <VeloMark size={34} tone="dark" />

        <div className="mt-12 flex items-center gap-5">
          <button
            type="button"
            onClick={() => setShowPaymentStep(false)}
            className="grid h-9 w-9 place-items-center rounded-full text-black transition hover:bg-black/[0.05]"
            aria-label="Voltar"
          >
            <ArrowLeft size={24} strokeWidth={2.1} />
          </button>
          <h1 className="text-[30px] font-semibold tracking-[-0.035em] sm:text-[34px]">Configure o seu plano</h1>
        </div>

        <div className="mt-14 grid items-start gap-14 lg:grid-cols-[minmax(0,560px)_390px] lg:justify-center">
          <section>
            <h2 className="mb-5 text-[17px] font-semibold tracking-[-0.015em]">Pagar com</h2>
            <button
              type="button"
              onClick={() => setSelectedMethod("pix")}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-[16px] bg-black px-5 text-[18px] font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.10)] transition hover:bg-[#1C1C1C]"
            >
              <QrCode size={20} />
              Pix
            </button>

            <div className="my-7 flex items-center gap-5">
              <div className="h-px flex-1 bg-black/10" />
              <span className="text-[14px] font-semibold text-[#8A8A86]">Ou</span>
              <div className="h-px flex-1 bg-black/10" />
            </div>

            <div
              className={`rounded-[18px] border p-6 transition ${
                selectedMethod === "credit_card" ? "border-black/15 bg-white shadow-[0_18px_45px_rgba(0,0,0,0.07)]" : "border-black/10 bg-[#EEEEEC]"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedMethod("credit_card")}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="flex items-center gap-4 text-[17px] font-semibold text-[#202020]">
                  <CreditCard size={18} />
                  Cartão
                </span>
                <span className={`h-5 w-5 rounded-full border-2 ${selectedMethod === "credit_card" ? "border-black bg-white shadow-[inset_0_0_0_5px_black]" : "border-[#C9C9C5]"}`} />
              </button>

              <div className="mt-14 space-y-10">
                <label className="block">
                  <span className="sr-only">Número do cartão</span>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Número do cartão"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      maxLength={19}
                      className="h-12 w-full border-0 bg-transparent pr-32 text-[19px] font-medium text-black outline-none placeholder:text-[#9B9B97]"
                    />
                    <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-2">
                      <span className="rounded-[4px] bg-[#0E5AA7] px-2 py-1 text-[10px] font-black text-white">VISA</span>
                      <span className="flex items-center gap-[-4px]">
                        <span className="block h-6 w-6 rounded-full bg-[#EB001B]" />
                        <span className="-ml-2 block h-6 w-6 rounded-full bg-[#F79E1B] mix-blend-multiply" />
                      </span>
                      <span className="rounded-[4px] bg-white px-1.5 py-1 text-[9px] font-black text-[#1D1D1B] shadow-sm">DISC</span>
                    </div>
                  </div>
                </label>

                <div className="grid grid-cols-2 gap-8">
                  <input
                    type="text"
                    placeholder="Data de validade"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    maxLength={5}
                    className="h-12 border-0 bg-transparent text-[18px] font-medium text-black outline-none placeholder:text-[#9B9B97]"
                  />
                  <input
                    type="text"
                    placeholder="Código de segurança"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value)}
                    maxLength={4}
                    className="h-12 border-0 bg-transparent text-[18px] font-medium text-black outline-none placeholder:text-[#9B9B97]"
                  />
                </div>

                <label className="flex cursor-pointer items-start gap-3 text-[15px] leading-6 text-[#575754]">
                  <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 rounded border-black/20 accent-black" />
                  <span>Salvar dados de pagamento para compras futuras na Velo.</span>
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMethod("pix")}
              className={`mt-3 flex h-[72px] w-full items-center justify-between rounded-[18px] border px-6 text-left transition ${
                selectedMethod === "pix" ? "border-black/15 bg-white shadow-[0_14px_34px_rgba(0,0,0,0.06)]" : "border-black/10 bg-[#EEEEEC]"
              }`}
            >
              <span className="flex items-center gap-4 text-[17px] font-semibold text-[#535350]">
                <QrCode size={20} className="text-[#02B894]" />
                Pix
              </span>
              <span className={`h-5 w-5 rounded-full border-2 ${selectedMethod === "pix" ? "border-black bg-white shadow-[inset_0_0_0_5px_black]" : "border-[#C9C9C5]"}`} />
            </button>

            <div className="mt-6 overflow-hidden rounded-[16px] border border-black/10 bg-white">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail"
                className="h-14 w-full border-b border-black/5 bg-transparent px-5 text-[15px] text-black outline-none placeholder:text-[#999]"
              />
              <input
                type="text"
                value={cardHolder}
                onChange={(e) => setCardHolder(e.target.value)}
                placeholder="Nome completo"
                className="h-14 w-full border-b border-black/5 bg-transparent px-5 text-[15px] text-black outline-none placeholder:text-[#999]"
              />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Endereço"
                className="h-14 w-full bg-transparent px-5 text-[15px] text-black outline-none placeholder:text-[#999]"
              />
            </div>

            <div className="mt-6 flex items-center gap-3 rounded-[16px] border border-black/10 bg-white px-5 py-4 text-[14px] text-[#6B6B68] shadow-[0_10px_28px_rgba(0,0,0,0.04)]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#00AEEF] text-[11px] font-black text-white">
                MP
              </span>
              <span>Pagamento processado pelo</span>
              <span className="font-bold text-[#111]">Mercado Pago</span>
            </div>
          </section>

          <aside className="rounded-[28px] border border-black/10 bg-white p-8 shadow-[0_24px_70px_rgba(0,0,0,0.08)]">
            <div className="flex items-start gap-4">
              <VeloMark size={36} tone={summaryIconTone} />
              <div>
                <h2 className="text-[28px] font-semibold tracking-[-0.045em]">Plano {plan.name}</h2>
                <p className="mt-3 text-[15px] leading-6 text-[#666]">{plan.description}</p>
              </div>
            </div>

            <h3 className="mt-8 text-[16px] font-semibold">Principais recursos</h3>
            <ul className="mt-5 space-y-5">
              {plan.features.slice(0, 5).map((feature) => (
                <li key={feature} className="flex items-start gap-4 text-[15px] leading-6 text-[#555]">
                  <Check size={17} className="mt-1 shrink-0 text-[#2563EB]" strokeWidth={2.5} />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-9 space-y-4 border-t border-black/10 pt-7 text-[15px]">
              <div className="flex items-center justify-between text-[#6F6F6A]">
                <span>{billingCycle === "annual" ? "Anual assinatura" : "Mensal assinatura"}</span>
                <span>{originalCheckoutPrice}</span>
              </div>
              {hasReferralDiscount && (
                <div className="flex items-center justify-between text-emerald-700">
                  <span>Desconto por indicação</span>
                  <span>- {formatBRL(parseBRL(originalCheckoutPrice) * 0.15)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-[17px] font-bold">
                <span>A pagar hoje</span>
                <span>{finalCheckoutPrice}</span>
              </div>
            </div>

            {checkoutState === "pix_pending" && pixData ? (
              <div className="mt-7 rounded-[18px] border border-black/10 bg-[#F7F7F5] p-5 text-center">
                <h3 className="text-[15px] font-semibold text-gray-900">Escaneie o QR Code para pagar</h3>
                {pixData.qr_code_base64 && (
                  <div className="mt-4 flex justify-center">
                    <img
                      src={`data:image/png;base64,${pixData.qr_code_base64}`}
                      alt="QR Code Pix"
                      className="h-44 w-44 rounded-md border border-gray-100"
                    />
                  </div>
                )}
                <div className="mt-4 grid gap-2">
                  <button
                    onClick={copyPix}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-3 text-[13px] font-semibold text-gray-700 transition hover:bg-gray-50"
                  >
                    {copied ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                    {copied ? "Copiado!" : "Copiar código Pix"}
                  </button>
                  <button
                    onClick={handleManualVerify}
                    disabled={verifying}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-[13px] font-semibold text-white transition hover:bg-[#222] disabled:opacity-60"
                  >
                    {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                    Já paguei
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-7 space-y-3 text-[14px] leading-5 text-[#666]">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-black"
                    />
                    <span>
                      Aceito os{" "}
                      <Link to="/termos" target="_blank" className="font-medium text-black underline underline-offset-2">
                        Termos de Uso
                      </Link>
                      .
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={acceptPrivacy}
                      onChange={(e) => setAcceptPrivacy(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-black"
                    />
                    <span>
                      Aceito a{" "}
                      <Link to="/privacidade" target="_blank" className="font-medium text-black underline underline-offset-2">
                        Política de Privacidade
                      </Link>
                      .
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={checkoutState === "loading" || !acceptTerms || !acceptPrivacy}
                  className="mt-7 flex h-16 w-full items-center justify-center gap-2 rounded-full bg-black px-5 text-[18px] font-semibold text-white transition hover:bg-[#222] disabled:cursor-not-allowed disabled:bg-[#D7D7D4] disabled:text-white"
                >
                  {checkoutState === "loading" ? (
                    <>
                      <Loader2 size={18} className="animate-spin" /> Processando...
                    </>
                  ) : (
                    "Assinar"
                  )}
                </button>
              </>
            )}
          </aside>
        </div>

        <p className="ml-auto mt-8 max-w-[390px] text-[13px] leading-5 text-[#777]">
          Renovação {recurringCycleLabel} até cancelar. Cobraremos {finalCheckoutPrice}
          {billingCycle === "monthly" ? "/mês" : "/ano"}.{" "}
          <button type="button" className="font-medium text-black underline underline-offset-2">
            Cancele quando quiser
          </button>{" "}
          em Configurações. Ao assinar, você concorda com os{" "}
          <Link to="/termos" target="_blank" className="font-medium text-black underline underline-offset-2">
            Termos de Uso
          </Link>{" "}
          e com a{" "}
          <Link to="/privacidade" target="_blank" className="font-medium text-black underline underline-offset-2">
            Política de Privacidade
          </Link>
          .
        </p>
      </main>
    </div>
  );
};

export default CheckoutPage;
