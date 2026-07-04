import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Check, QrCode, CreditCard, Copy,
  CheckCircle2, HelpCircle, Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MP_PUBLIC_KEY } from "@/lib/mercadopago";
import { veloToast as toast } from "@/components/ui/velo-toast";
import { VeloLogo } from "@/components/VeloLogo";
import { markCompletedPayment, markReachedPayment } from "@/lib/onboardingAnalytics";
import { getReferralCode, markAffiliateReachedPayment } from "@/lib/affiliateFunnel";

type PaymentMethod = "pix" | "credit_card";
type CheckoutState = "idle" | "loading" | "pix_pending" | "success" | "error";

type PlanData = {
  name: string;
  price: string;
  description: string;
  badge?: string;
  features: string[];
};

const PLANS_DATA: Record<string, PlanData> = {
  pro: {
    name: "Pro",
    price: "R$ 99,90",
    description: "Para validar produtos, publicar com segurança e operar com IA sem complexidade.",
    badge: "Mais escolhido",
    features: [
      "Até 30 produtos publicados",
      "Até 2 marketplaces conectados",
      "Até 3 agentes IA",
      "Automações limitadas",
      "Analytics básico",
      "Monitoramento básico 24h",
      "Respostas automáticas limitadas",
      "Publicação automática",
      "Memória de operação entre sessões",
      "Relatórios financeiros",
      "Suporte prioritário",
    ],
  },
  business: {
    name: "Business",
    price: "R$ 149,90",
    description: "Para quem quer escalar catálogo, automações e análise avançada sem limites.",
    badge: "Escala",
    features: [
      "Produtos ilimitados",
      "Marketplaces ilimitados",
      "Agentes IA ilimitados",
      "Automações ilimitadas",
      "IA estratégica avançada",
      "Análise de concorrência",
      "Score de produtos",
      "Insights automáticos",
      "Analytics premium",
      "Acesso antecipado",
      "Processamento prioritário",
      "Operação sem limites",
      "Suporte dedicado",
    ],
  },
};

const PLAN_AMOUNTS: Record<string, number> = {
  pro: 99.9,
  business: 149.9,
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();

  const rawPlan = searchParams.get("plan") ?? "pro";
  const initialPlanId = PLANS_DATA[rawPlan] ? rawPlan : "pro";
  const [selectedPlanId, setSelectedPlanId] = useState(initialPlanId);
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const planId = selectedPlanId;
  const plan = PLANS_DATA[planId];

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("pix");
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
    void markAffiliateReachedPayment(session.user.id, PLAN_AMOUNTS[planId] ?? 0);
  }, [planId, session?.user?.id, showPaymentStep]);

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

    setCheckoutState("loading");
    const toastId = toast.loading(selectedMethod === "pix" ? "Gerando pagamento Pix..." : "Processando pagamento...");

    try {
      const payload: Record<string, unknown> = {
        plan: planId,
        payment_method: selectedMethod,
      };
      const referralCode = getReferralCode();
      if (referralCode) {
        payload.affiliate_ref = referralCode;
        payload.plan_price = PLAN_AMOUNTS[planId] ?? undefined;
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
      <div className="min-h-screen overflow-hidden bg-[#0A0A0A] px-4 py-6 font-['Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#111111] sm:px-6 lg:px-10">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.14),transparent_26%),radial-gradient(circle_at_82%_8%,rgba(180,180,180,0.18),transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent_38%)]" />
        <div className="pointer-events-none fixed inset-0 opacity-[0.055] [background-image:radial-gradient(circle,rgba(255,255,255,0.8)_0.7px,transparent_0.8px)] [background-size:7px_7px]" />

        <div className="relative mx-auto flex min-h-[calc(100vh-48px)] max-w-6xl items-center justify-center">
          <section className="w-full rounded-[34px] bg-white p-5 shadow-[0_34px_120px_rgba(0,0,0,0.42)] sm:p-7 lg:p-10">
            <div className="mb-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F3F2] text-black transition hover:bg-[#E9E9E7]"
                aria-label="Voltar"
              >
                <ArrowLeft size={18} />
              </button>
              <VeloLogo size="md" variant="dark" />
              <span className="h-10 w-10" aria-hidden="true" />
            </div>

            <div className="mx-auto max-w-2xl text-center">
              <p className="mx-auto mb-3 w-fit rounded-full bg-[#F5F5F4] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8B8B88]">
                Planos Velo
              </p>
              <h1 className="text-[34px] font-semibold leading-none tracking-[-0.055em] text-black sm:text-[44px]">
                Escolha o plano para crescer
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-[14px] leading-6 text-[#8A8A86]">
                Antes do pagamento, selecione o plano que combina com o seu momento. O checkout continua seguro via Mercado Pago.
              </p>
            </div>

            <div className="mx-auto mt-8 grid max-w-4xl items-stretch gap-4 rounded-[28px] bg-[#F4F3F1] p-3 md:grid-cols-2">
              {plans.map(([id, currentPlan]) => {
                const isRecommended = id === "pro";

                return (
                  <article
                    key={id}
                    className={`relative flex min-h-[430px] flex-col rounded-[24px] p-6 transition duration-200 ${
                      isRecommended
                        ? "bg-white shadow-[0_18px_60px_rgba(0,0,0,0.10)]"
                        : "bg-transparent hover:bg-white/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        isRecommended
                          ? "bg-black text-white"
                          : "border border-black/12 bg-white text-black"
                      }`}>
                        <Check size={18} strokeWidth={2.5} />
                      </div>
                      {currentPlan.badge && (
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                          isRecommended ? "bg-black text-white" : "bg-white/80 text-[#777]"
                        }`}>
                          {currentPlan.badge}
                        </span>
                      )}
                    </div>

                    <div className="mt-8">
                      <h2 className="text-[22px] font-semibold tracking-[-0.03em] text-black">{currentPlan.name}</h2>
                      <p className="mt-1 min-h-[42px] text-[13px] leading-5 text-[#777]">{currentPlan.description}</p>
                    </div>

                    <div className="mt-7 flex items-end gap-1">
                      <span className="text-[38px] font-semibold tracking-[-0.06em] text-black">{currentPlan.price}</span>
                      <span className="pb-2 text-[12px] font-medium text-[#7A7A77]">/mês</span>
                    </div>

                    <div className="my-6 h-px bg-black/10" />

                    <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-[#8A8A86]">Inclui</p>
                    <ul className="space-y-2.5">
                      {currentPlan.features.slice(0, 5).map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-[#3D3D3A]">
                          <Check size={14} className="mt-0.5 shrink-0 text-black" strokeWidth={2.4} />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={() => startCheckout(id)}
                      className="mt-auto h-11 w-full rounded-full bg-black px-5 text-[13px] font-semibold text-white shadow-[0_12px_28px_rgba(0,0,0,0.20)] transition hover:bg-[#1A1A1A]"
                    >
                      Assinar {currentPlan.name}
                    </button>
                  </article>
                );
              })}
            </div>

            <div className="mx-auto mt-5 max-w-4xl overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_16%_22%,rgba(255,239,164,0.88),transparent_26%),radial-gradient(circle_at_48%_18%,rgba(255,184,229,0.76),transparent_30%),radial-gradient(circle_at_86%_48%,rgba(139,218,255,0.82),transparent_32%),linear-gradient(135deg,#F8F1CB,#F8DDF1_46%,#BDEEFF)] px-6 py-7 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.70),0_18px_50px_rgba(0,0,0,0.08)]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
                <HelpCircle size={24} strokeWidth={2.1} />
              </div>
              <p className="mt-4 text-[15px] font-semibold text-black">Não tem certeza de qual plano escolher?</p>
              <p className="mx-auto mt-1 max-w-md text-[12px] font-medium leading-5 text-black/56">
                Comece pelo Pro. Você pode ajustar o plano depois sem mudar o fluxo de checkout.
              </p>
              <button
                type="button"
                onClick={() => startCheckout("pro")}
                className="mx-auto mt-4 h-10 rounded-full bg-black px-7 text-[12px] font-semibold text-white shadow-[0_14px_30px_rgba(0,0,0,0.22)] transition hover:bg-[#1A1A1A]"
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
            <p className="mb-3 text-[13px] font-medium text-white/45">Assinar plano {plan.name}</p>
            <h1 className="text-[44px] font-semibold leading-none tracking-[-0.045em] text-white sm:text-[52px]">
              {plan.price} por mês
            </h1>
            <p className="mt-4 max-w-[320px] text-[15px] font-medium leading-6 text-white/54">
              Assinatura mensal do plano {plan.name}
            </p>

            <div className="mt-12 border-y border-white/[0.08] py-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[14px] font-semibold text-white">{plan.name}</p>
                  <p className="mt-1 text-[12px] text-white/42">Cobrança mensal</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-white">{plan.price}</p>
                  <p className="mt-1 text-[12px] text-white/42">/ mês</p>
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
                <span className="font-semibold text-white">{plan.price}</span>
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
                  <span className="font-semibold text-white/66">Total mensal</span>
                  <span className="font-semibold text-white">{plan.price}</span>
                </div>
                <div className="mt-7 flex items-center justify-between">
                  <span className="font-semibold text-white/66">Total devido hoje</span>
                  <span className="font-semibold text-white">{plan.price}</span>
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
              <button
                onClick={handleCheckout}
                disabled={checkoutState === "loading"}
                className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-gray-950 px-4 text-[15px] font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
              >
                {checkoutState === "loading" ? (
                  <><Loader2 size={16} className="animate-spin" /> Processando...</>
                ) : (
                  `Pagar ${plan.price}`
                )}
              </button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default CheckoutPage;
