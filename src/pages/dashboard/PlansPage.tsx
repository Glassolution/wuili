import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Check, CreditCard, QrCode, Loader2, Copy, CheckCircle2 } from "lucide-react";
import { MP_PUBLIC_KEY } from "@/lib/mercadopago";
import { veloToast as toast } from "@/components/ui/velo-toast";

const PLANS = [
  {
    id: "gratis",
    name: "Grátis",
    price: "R$ 0",
    period: "/mês",
    features: [
      "Exploração do catálogo",
      "Dashboard demonstrativo",
      "IA básica de teste",
      "1 marketplace conectado",
      "Sem publicação de produtos",
      "Sem automações operacionais",
    ],
    current: true,
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 79,80",
    period: "/mês",
    features: [
      "Até 30 produtos publicados",
      "Até 2 marketplaces",
      "Até 3 agentes IA",
      "Automações limitadas",
      "Analytics básico",
      "Monitoramento básico 24h",
      "Respostas automáticas limitadas",
      "Publicação automática",
      "Relatórios financeiros",
      "Suporte prioritário",
      "Memória operacional",
    ],
  },
  {
    id: "business",
    name: "Business",
    price: "R$ 159,60",
    period: "/mês",
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
      "Suporte dedicado",
      "Operação sem limites",
    ],
    highlight: true,
  },
];

type PaymentMethod = "pix" | "credit_card";
type CheckoutState = "idle" | "loading" | "pix_pending" | "success" | "error";

const PlansPage = () => {
  const { user, session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const planFromUrl = searchParams.get("plan");
  const [currentPlan, setCurrentPlan] = useState("gratis");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("pix");
  const [checkoutState, setCheckoutState] = useState<CheckoutState>("idle");
  const [pixData, setPixData] = useState<{ qr_code_base64: string; copy_paste: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const autoStartedRef = useRef(false);

  // Card fields
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardHolder, setCardHolder] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      supabase.from("profiles").select("plano").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan,status")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([profileResult, subResult]) => {
      if (!active) return;
      const sub = subResult.data as { plan?: string | null; status?: string | null } | null;
      // Prefer active subscription plan over profiles.plano (fica desatualizado
      // se o webhook do MP não sincronizar o perfil).
      if (sub?.plan && sub.status === "active") {
        const p = sub.plan === "plus" ? "pro" : sub.plan;
        setCurrentPlan(String(p));
        return;
      }
      if (profileResult.data?.plano) {
        setCurrentPlan(profileResult.data.plano === "plus" ? "pro" : profileResult.data.plano);
      }
    });
    return () => { active = false; };
  }, [user]);

  // When arriving from landing CTA, show toast and clear param
  useEffect(() => {
    if (planFromUrl && !autoStartedRef.current) {
      autoStartedRef.current = true;
      if (planFromUrl === "pro" || planFromUrl === "business") {
        toast.info(`Selecione a forma de pagamento e confirme para ativar o ${planFromUrl === "pro" ? "Pro" : "Business"}.`);
      }
      // remove the ?plan param from URL
      const next = new URLSearchParams(searchParams);
      next.delete("plan");
      setSearchParams(next, { replace: true });
    }
  }, [planFromUrl, searchParams, setSearchParams]);

  const handleCheckout = async (plan: string) => {
    if (!session) {
      toast.error("Você precisa estar logado");
      return;
    }

    setCheckoutState("loading");
    const toastId = toast.loading(selectedMethod === "pix" ? "Gerando pagamento Pix..." : "Processando pagamento...");

    try {
      const payload: Record<string, unknown> = {
        plan,
        payment_method: selectedMethod,
      };

      // For credit card, generate token via MP SDK
      if (selectedMethod === "credit_card") {
        if (!MP_PUBLIC_KEY || MP_PUBLIC_KEY.includes("PLACEHOLDER")) {
          toast.error("Chave pública do Mercado Pago não configurada.", { id: toastId });
          setCheckoutState("idle");
          return;
        }
        // @ts-ignore - MercadoPago SDK loaded via script
        const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });

        const [expMonth, expYear] = cardExpiry.split("/");
        const cardTokenRes = await mp.createCardToken({
          cardNumber: cardNumber.replace(/\s/g, ""),
          cardholderName: cardHolder,
          cardExpirationMonth: expMonth?.trim(),
          cardExpirationYear: expYear?.trim()?.length === 2 ? `20${expYear.trim()}` : expYear?.trim(),
          securityCode: cardCvc,
          identificationType: "CPF",
          identificationNumber: "00000000000", // placeholder
        });

        if (!cardTokenRes?.id) {
          toast.error("Erro ao processar cartão. Verifique os dados.", { id: toastId });
          setCheckoutState("idle");
          return;
        }

        payload.card_token = cardTokenRes.id;
        payload.installments = 1;
      }

      const { data, error } = await supabase.functions.invoke("mp-checkout", {
        body: payload,
      });

      if (error) throw error;

      if (data.status === "approved") {
        setCheckoutState("success");
        setCurrentPlan(plan);
        toast.success("Pagamento aprovado. Plano ativado com sucesso.", { id: toastId });
      } else if (data.pix_qr_code_base64) {
        setPixData({
          qr_code_base64: data.pix_qr_code_base64,
          copy_paste: data.pix_copy_paste,
        });
        setCheckoutState("pix_pending");
        toast.info("QR Code Pix gerado. Escaneie para pagar.", { id: toastId });
      } else {
        setCheckoutState("error");
        toast.error("Pagamento não aprovado. Tente novamente.", { id: toastId });
      }
    } catch (err: unknown) {
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

  return (
    <div className="space-y-6">
      <div className="card-wuili p-6">
        <h2 className="text-2xl font-semibold text-foreground">Planos</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Escolha o plano ideal para o seu negócio.
        </p>
      </div>

      {/* Plans grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrentPlan = currentPlan === plan.id;
          return (
            <div
              key={plan.id}
              className={`card-wuili p-6 relative ${
                plan.highlight
                  ? "ring-2 ring-black dark:ring-white"
                  : ""
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 left-4 rounded-full bg-black px-3 py-1 text-xs font-normal text-white dark:bg-white dark:text-black">
                  Recomendado
                </span>
              )}
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold text-foreground">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check size={14} className="text-black shrink-0 dark:text-white" />
                    {f}
                  </li>
                ))}
              </ul>
              {isCurrentPlan ? (
                <div className="flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                  <CheckCircle2 size={16} /> Plano atual
                </div>
              ) : plan.id !== "gratis" ? (
                <button
                  onClick={() => handleCheckout(plan.id)}
                  disabled={checkoutState === "loading"}
                  className="btn-primary btn-primary--md w-full"
                >
                  {checkoutState === "loading" ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 size={16} className="animate-spin" /> Processando...
                    </span>
                  ) : (
                    "Assinar agora"
                  )}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Payment method selector */}
      {currentPlan === "gratis" && (
        <div className="card-wuili p-6 space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Forma de pagamento</h3>
          <div className="flex gap-3">
            <button
              onClick={() => setSelectedMethod("pix")}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                selectedMethod === "pix"
                  ? "border-black bg-zinc-100 text-black dark:border-white dark:bg-zinc-800 dark:text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <QrCode size={18} /> Pix
            </button>
            <button
              onClick={() => setSelectedMethod("credit_card")}
              className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                selectedMethod === "credit_card"
                  ? "border-black bg-zinc-100 text-black dark:border-white dark:bg-zinc-800 dark:text-white"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              <CreditCard size={18} /> Cartão de crédito
            </button>
          </div>

          {/* Credit card form */}
          {selectedMethod === "credit_card" && (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Número do cartão</label>
                <input
                  type="text"
                  placeholder="0000 0000 0000 0000"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                  maxLength={19}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Nome no cartão</label>
                <input
                  type="text"
                  placeholder="NOME COMPLETO"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Validade</label>
                <input
                  type="text"
                  placeholder="MM/AA"
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                  maxLength={5}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">CVV</label>
                <input
                  type="text"
                  placeholder="123"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-black/10 dark:focus:ring-white/10"
                  maxLength={4}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* PIX QR Code modal */}
      {checkoutState === "pix_pending" && pixData && (
        <div className="card-wuili p-6 space-y-4 text-center">
          <h3 className="text-lg font-semibold text-foreground">Escaneie o QR Code para pagar</h3>
          <p className="text-sm text-muted-foreground">Abra o app do seu banco e escaneie o código abaixo</p>
          {pixData.qr_code_base64 && (
            <div className="flex justify-center">
              <img
                src={`data:image/png;base64,${pixData.qr_code_base64}`}
                alt="QR Code Pix"
                className="h-52 w-52 rounded-xl"
              />
            </div>
          )}
          <button
            onClick={copyPix}
            className="mx-auto flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
          >
            {copied ? <CheckCircle2 size={16} className="text-black dark:text-white" /> : <Copy size={16} />}
            {copied ? "Copiado!" : "Copiar código Pix"}
          </button>
          <p className="text-xs text-muted-foreground">
            Após o pagamento, seu plano será ativado automaticamente.
          </p>
        </div>
      )}

      {/* Success state */}
      {checkoutState === "success" && (
        <div className="card-wuili p-6 text-center space-y-2">
          <CheckCircle2 size={48} className="mx-auto text-black dark:text-white" />
          <h3 className="text-lg font-semibold text-foreground">Pagamento aprovado!</h3>
          <p className="text-sm text-muted-foreground">Seu plano está ativo. Aproveite!</p>
        </div>
      )}
    </div>
  );
};

export default PlansPage;
