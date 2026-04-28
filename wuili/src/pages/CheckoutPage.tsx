import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Check, QrCode, CreditCard, Copy,
  CheckCircle2, Loader2, Package,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { MP_PUBLIC_KEY } from "@/lib/mercadopago";
import { toast } from "sonner";
import { VeloLogo } from "@/components/VeloLogo";

type PaymentMethod = "pix" | "credit_card";
type CheckoutState = "idle" | "loading" | "pix_pending" | "success" | "error";

const PLANS_DATA: Record<string, { name: string; price: string; features: string[] }> = {
  pro: {
    name: "Pro",
    price: "R$ 99,90",
    features: [
      "IA avançada com auto-publicação",
      "Mercado Livre conectado",
      "Monitoramento de preços 24h",
      "Memória de operação entre sessões",
      "Respostas automáticas a compradores",
      "Relatórios financeiros",
    ],
  },
  business: {
    name: "Business",
    price: "R$ 149,90",
    features: [
      "Tudo do Pro",
      "Modelo de IA avançado",
      "Agentes de venda ilimitados",
      "Analytics em tempo real",
      "Múltiplas contas por marketplace",
      "Automações de entrega e rastreio",
      "Suporte prioritário dedicado",
    ],
  },
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchParams] = useSearchParams();

  const rawPlan = searchParams.get("plan") ?? "pro";
  const planId = PLANS_DATA[rawPlan] ? rawPlan : "pro";
  const plan = PLANS_DATA[planId];

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("pix");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [pixData, setPixData] = useState<{ qr_code_base64: string; copy_paste: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [promoCode, setPromoCode] = useState("");

  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [verifying, setVerifying] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Polling: a cada 5s verifica se o pagamento foi aprovado
  useEffect(() => {
    if (checkoutState !== "pix_pending" || !session) return;

    const tick = async () => {
      try {
        const { data } = await supabase.functions.invoke("mp-verify-payment");
        if (data?.status === "active") {
          setCheckoutState("success");
          toast.success("🎉 Plano ativado!");
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
    try {
      const { data } = await supabase.functions.invoke("mp-verify-payment");
      if (data?.status === "active") {
        setCheckoutState("success");
        toast.success("🎉 Plano ativado!");
        setTimeout(() => navigate("/dashboard"), 1500);
      } else {
        toast.info("Pagamento ainda não confirmado. Aguarde alguns segundos.");
      }
    } catch {
      toast.error("Erro ao verificar pagamento");
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

    try {
      const payload: Record<string, unknown> = {
        plan: planId,
        payment_method: selectedMethod,
      };

      if (selectedMethod === "credit_card") {
        if (!MP_PUBLIC_KEY || MP_PUBLIC_KEY.includes("PLACEHOLDER")) {
          toast.error("Chave pública do Mercado Pago não configurada");
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
          toast.error("Erro ao processar cartão. Verifique os dados.");
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
        toast.success("Pagamento aprovado! Plano ativado 🎉");
      } else if (data.pix_qr_code_base64) {
        setPixData({ qr_code_base64: data.pix_qr_code_base64, copy_paste: data.pix_copy_paste });
        setCheckoutState("pix_pending");
        toast.info("QR Code Pix gerado! Escaneie para pagar.");
      } else {
        setCheckoutState("error");
        toast.error("Pagamento não aprovado. Tente novamente.");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      setCheckoutState("error");
      toast.error("Erro ao processar pagamento");
    }
  };

  const copyPix = () => {
    if (pixData?.copy_paste) {
      navigator.clipboard.writeText(pixData.copy_paste);
      setCopied(true);
      toast.success("Código Pix copiado!");
      setTimeout(() => setCopied(false), 3000);
    }
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

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      {/* Header — logo left, back button left */}
      <header className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-5">
            <VeloLogo size="md" variant="dark" />
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={14} />
            Voltar
          </button>
        </div>
      </header>

      {/* Progress stepper — centered */}
      <div className="bg-white border-b border-gray-100">
        <div className="flex items-center justify-center gap-3 px-6 py-3.5 text-sm">
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500">
              <Check size={10} className="text-white" strokeWidth={3} />
            </div>
            Plano selecionado
          </div>
          <span className="text-gray-300">›</span>
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">
              2
            </div>
            Pagamento
          </div>
          <span className="text-gray-300">›</span>
          <div className="flex items-center gap-2 text-gray-400">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 text-[10px] font-bold text-gray-400">
              3
            </div>
            Confirmação
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="mx-auto max-w-5xl grid gap-5 px-6 py-8 md:grid-cols-[1fr_360px]">

        {/* LEFT — Payment options */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-5 flex items-center gap-2 text-[15px] font-semibold text-gray-900">
              <CreditCard size={17} className="text-gray-400" />
              Selecione a forma de pagamento
            </h2>

            {/* PIX option */}
            <button
              type="button"
              onClick={() => setSelectedMethod("pix")}
              className={`mb-3 flex w-full items-center justify-between rounded-xl border px-4 py-3.5 transition-colors ${
                selectedMethod === "pix"
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                  selectedMethod === "pix" ? "border-gray-900" : "border-gray-300"
                }`}>
                  {selectedMethod === "pix" && (
                    <div className="h-2 w-2 rounded-full bg-gray-900" />
                  )}
                </div>
                <span className="text-sm font-medium text-gray-800">PIX</span>
              </div>
              <QrCode size={20} className="text-green-600" />
            </button>

            {/* Credit Card option */}
            <div className={`rounded-xl border transition-colors ${
              selectedMethod === "credit_card"
                ? "border-gray-900 bg-gray-50"
                : "border-gray-200"
            }`}>
              <button
                type="button"
                onClick={() => setSelectedMethod("credit_card")}
                className="flex w-full items-center justify-between px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
                    selectedMethod === "credit_card" ? "border-gray-900" : "border-gray-300"
                  }`}>
                    {selectedMethod === "credit_card" && (
                      <div className="h-2 w-2 rounded-full bg-gray-900" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-800">Cartão de crédito</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-700 tracking-wide">VISA</span>
                  <span className="rounded border border-orange-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-orange-600 tracking-wide">MC</span>
                </div>
              </button>

              {selectedMethod === "credit_card" && (
                <div className="space-y-3 border-t border-gray-100 px-4 pb-4 pt-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Número do cartão</label>
                    <input
                      type="text"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      maxLength={19}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">Validade</label>
                      <input
                        type="text"
                        placeholder="MM/AA"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        maxLength={5}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">CVV/CVC</label>
                      <input
                        type="text"
                        placeholder="***"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        maxLength={4}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-500">Nome no cartão</label>
                    <input
                      type="text"
                      placeholder="NOME COMPLETO"
                      value={cardHolder}
                      onChange={(e) => setCardHolder(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/20"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PIX QR Code (shown after generating) */}
          {checkoutState === "pix_pending" && pixData && (
            <div className="rounded-2xl bg-white p-6 shadow-sm text-center space-y-4">
              <h3 className="text-[15px] font-semibold text-gray-900">Escaneie o QR Code para pagar</h3>
              <p className="text-sm text-gray-500">Abra o app do seu banco e escaneie o código abaixo</p>
              {pixData.qr_code_base64 && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code Pix"
                    className="h-48 w-48 rounded-xl border border-gray-100"
                  />
                </div>
              )}
              <button
                onClick={copyPix}
                className="mx-auto flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                {copied ? <CheckCircle2 size={15} className="text-green-500" /> : <Copy size={15} />}
                {copied ? "Copiado!" : "Copiar código Pix"}
              </button>
              <button
                onClick={handleManualVerify}
                disabled={verifying}
                className="mx-auto flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-black transition-colors disabled:opacity-60"
              >
                {verifying ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Já paguei — verificar agora
              </button>
              <p className="text-xs text-gray-400">Verificamos seu pagamento automaticamente a cada 5 segundos.</p>
            </div>
          )}

          {/* Pay button */}
          {checkoutState !== "pix_pending" && (
            <button
              onClick={handleCheckout}
              disabled={checkoutState === "loading"}
              className="btn-primary btn-primary--md w-full"
            >
              {checkoutState === "loading" ? (
                <><Loader2 size={16} className="animate-spin" /> Processando...</>
              ) : (
                `Pagar ${plan.price}`
              )}
            </button>
          )}
        </div>

        {/* RIGHT — Order summary */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Plano {plan.name} selecionado
                </p>
                <p className="mt-1 text-sm leading-6 text-emerald-800/80">
                  Escolha a forma de pagamento para continuar com a ativação.
                </p>
              </div>
            </div>
          </div>

          {/* Plan details */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-[15px] font-semibold text-gray-900">
              <Package size={16} className="text-gray-400" />
              Seu plano
            </h2>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-gray-900">{plan.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Cobrança mensal</p>
              </div>
              <span className="text-sm font-bold text-gray-900">{plan.price}</span>
            </div>
            <ul className="space-y-1.5 border-t border-gray-100 pt-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs text-gray-500">
                  <Check size={11} className="shrink-0 text-gray-700" strokeWidth={3} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Promo code */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Código promocional</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Digite o código"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400/20"
              />
              <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black transition-colors">
                Aplicar
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Resumo</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Plano {plan.name}</span>
                <span>{plan.price}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Desconto</span>
                <span>—</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2 text-base font-bold text-gray-900">
                <span>Total</span>
                <span>{plan.price}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
