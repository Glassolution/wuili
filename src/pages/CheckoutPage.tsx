import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Check, QrCode, CreditCard, Copy,
  CheckCircle2, Loader2,
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
      "Até 2 marketplaces",
      "Monitoramento de preços 24h",
      "Memória de operação entre sessões",
      "Respostas automáticas a compradores",
      "Relatórios financeiros",
      "Suporte prioritário",
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
      "Marketplaces ilimitados",
      "API access",
      "Automações de entrega e rastreio",
      "Suporte dedicado",
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
    <div className="min-h-screen bg-white font-['Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif] text-[#111111]">
      <div className="mx-auto grid min-h-screen w-full max-w-[1180px] grid-cols-1 lg:grid-cols-2">
        {/* LEFT — plan summary */}
        <aside className="border-b border-gray-100 px-6 py-8 sm:px-10 lg:border-b-0 lg:border-r lg:px-14 lg:py-10">
          <div className="mb-10 flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-900"
              aria-label="Voltar"
            >
              <ArrowLeft size={16} />
            </button>
            <VeloLogo size="md" variant="dark" />
          </div>

          <div className="max-w-[420px]">
            <p className="mb-2 text-[13px] font-medium text-gray-500">Plano {plan.name}</p>
            <h1 className="text-[42px] font-semibold leading-none tracking-[-0.04em] text-gray-950">
              {plan.price} por mês
            </h1>
            <p className="mt-3 max-w-[320px] text-[15px] font-medium leading-6 text-gray-600">
              Assinatura mensal do plano {plan.name}
            </p>

            <div className="mt-12 border-y border-gray-100 py-6">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[14px] font-semibold text-gray-950">{plan.name}</p>
                  <p className="mt-1 text-[12px] text-gray-500">Cobrança mensal</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold text-gray-950">{plan.price}</p>
                  <p className="mt-1 text-[12px] text-gray-500">/ mês</p>
                </div>
              </div>

              <ul className="mt-5 space-y-2">
                {plan.features.slice(0, 5).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-[13px] leading-5 text-gray-600">
                    <Check size={13} className="mt-0.5 shrink-0 text-gray-900" strokeWidth={2.5} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-5 py-7 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-700">Subtotal</span>
                <span className="font-semibold text-gray-950">{plan.price}</span>
              </div>

              <div>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Adicionar código promocional"
                  className="h-10 w-full max-w-[250px] rounded-md border border-gray-100 bg-gray-50 px-3 text-[13px] text-gray-700 placeholder:text-gray-400 outline-none transition focus:border-gray-300 focus:bg-white"
                />
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Total mensal</span>
                  <span className="font-semibold text-gray-950">{plan.price}</span>
                </div>
                <div className="mt-7 flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Total devido hoje</span>
                  <span className="font-semibold text-gray-950">{plan.price}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT — payment form */}
        <main className="px-6 py-8 sm:px-10 lg:px-16 lg:py-12">
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
