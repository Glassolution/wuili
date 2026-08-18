// Checkout transparente da Velo (ValidaPay via API).
// O pagamento acontece 100% aqui, no nosso domínio e com a nossa marca:
// Pix (QR + copia e cola) e cartão de crédito são processados pela Edge Function
// `validapay-transparent-charge`. Não há redirecionamento para o checkout hospedado.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, CreditCard, Loader2, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getReferralCode } from "@/lib/affiliateFunnel";
import { VeloLogo } from "@/components/VeloLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PlanId = "base" | "pro" | "business";
type Cycle = "monthly" | "annual";

const PLANS: Record<PlanId, { name: string; monthly: number; annual: number; pitch: string }> = {
  base: { name: "Velo Base", monthly: 39.9, annual: 430.92, pitch: "Comece a vender sem travar no operacional." },
  pro: { name: "Velo Pro", monthly: 79.8, annual: 861.84, pitch: "Automatize publicações, estoque e preço." },
  business: { name: "Velo Business", monthly: 159.6, annual: 1723.68, pitch: "Volume ilimitado para quem já vive disso." },
};

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const maskDocument = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const maskCard = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ");

const maskExpiration = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 6);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
};

export default function AssinaturaCheckoutPage() {
  const navigate = useNavigate();
  const { plan: planParam } = useParams<{ plan: string }>();
  const [searchParams] = useSearchParams();

  const plan = (["base", "pro", "business"].includes(String(planParam)) ? planParam : "base") as PlanId;
  const cycle: Cycle = searchParams.get("cycle") === "annual" ? "annual" : "monthly";
  const coupon = searchParams.get("coupon");

  const amount = cycle === "annual" ? PLANS[plan].annual : PLANS[plan].monthly;

  const [method, setMethod] = useState<"pix" | "creditcard">("pix");
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiration, setCardExpiration] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [pix, setPix] = useState<{ emv: string | null; qrCodeImage: string | null } | null>(null);
  const [chargeId, setChargeId] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) {
        navigate("/entrar?next=" + encodeURIComponent(`/assinar/${plan}?cycle=${cycle}`));
        return;
      }
      setEmail(data.user.email ?? "");
      const meta = data.user.user_metadata as Record<string, unknown> | undefined;
      const metaName = (meta?.display_name ?? meta?.full_name ?? meta?.name) as string | undefined;
      if (metaName) setName(metaName);
    });
    return () => {
      active = false;
    };
  }, [navigate, plan, cycle]);

  // Polling do Pix: confirma o pagamento sem depender do webhook.
  useEffect(() => {
    if (!chargeId || method !== "pix") return;
    const check = async () => {
      const { data } = await supabase.functions.invoke("validapay-transparent-charge", {
        body: { action: "status", chargeId },
      });
      if (data?.paid) {
        if (pollRef.current) window.clearInterval(pollRef.current);
        toast.success("Pagamento confirmado! Bem-vindo à Velo.");
        navigate(`/assinatura/confirmada?plan=${plan}&cycle=${cycle}`);
      }
    };
    pollRef.current = window.setInterval(check, 5000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [chargeId, method, navigate, plan, cycle]);

  const readyToPay = useMemo(() => {
    const baseOk = name.trim().length >= 3 && document.replace(/\D/g, "").length >= 11 && !!email;
    if (method === "pix") return baseOk;
    return (
      baseOk &&
      cardNumber.replace(/\D/g, "").length >= 13 &&
      cardName.trim().length >= 3 &&
      /^\d{2}\/\d{4}$/.test(cardExpiration) &&
      cardCvv.replace(/\D/g, "").length >= 3
    );
  }, [name, document, email, method, cardNumber, cardName, cardExpiration, cardCvv]);

  const handlePay = async () => {
    if (!readyToPay || loading) return;
    setLoading(true);
    try {
      const affiliateCode = getReferralCode();
      const { data, error } = await supabase.functions.invoke("validapay-transparent-charge", {
        body: {
          action: "create",
          plan,
          cycle,
          paymentMethod: method,
          ...(coupon ? { coupon } : {}),
          ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
          customer: { name, email, document, phone },
          ...(method === "creditcard"
            ? {
                card: {
                  number: cardNumber,
                  cvv: cardCvv,
                  name: cardName,
                  expiration: cardExpiration,
                },
                installments: 1,
              }
            : {}),
        },
      });

      if (error) {
        let message = "Não foi possível processar o pagamento.";
        const context = (error as unknown as { context?: Response })?.context;
        if (context && typeof context.json === "function") {
          try {
            const body = await context.json();
            if (body?.error) message = String(body.error);
            if (body?.alreadyActive) {
              toast.success(message);
              navigate("/dashboard");
              return;
            }
          } catch {
            /* resposta não-JSON */
          }
        }
        toast.error(message);
        return;
      }

      if (data?.paid) {
        toast.success("Pagamento aprovado! Seu plano já está ativo.");
        navigate(`/assinatura/confirmada?plan=${plan}&cycle=${cycle}`);
        return;
      }

      if (data?.pix) {
        setPix(data.pix);
        setChargeId(data.chargeId);
        toast.success("Pix gerado. Escaneie o QR Code para concluir.");
      }
    } finally {
      setLoading(false);
    }
  };

  const copyPix = async () => {
    if (!pix?.emv) return;
    await navigator.clipboard.writeText(pix.emv);
    toast.success("Código Pix copiado.");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <VeloLogo size="sm" />
          <button
            type="button"
            onClick={() => navigate("/dashboard/planos")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1fr_1.2fr]">
        <aside className="h-fit rounded-2xl border bg-card p-6">
          <p className="text-sm text-muted-foreground">Assinatura</p>
          <h1 className="mt-1 text-2xl font-semibold">{PLANS[plan].name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{PLANS[plan].pitch}</p>
          <div className="mt-6 flex items-baseline gap-2">
            <span className="text-3xl font-bold">{brl(amount)}</span>
            <span className="text-sm text-muted-foreground">
              {cycle === "annual" ? "/ano" : "/mês"}
            </span>
          </div>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Cancele quando quiser</li>
            <li className="flex gap-2"><Check className="h-4 w-4 text-primary" /> Acesso liberado na hora</li>
            <li className="flex gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Pagamento processado pela ValidaPay</li>
          </ul>
        </aside>

        <section className="rounded-2xl border bg-card p-6">
          {pix ? (
            <div className="text-center">
              <h2 className="text-lg font-semibold">Pague com Pix para ativar</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Assim que o pagamento cair, liberamos seu plano automaticamente.
              </p>
              {pix.qrCodeImage && (
                <img
                  src={pix.qrCodeImage.startsWith("data:") ? pix.qrCodeImage : `data:image/png;base64,${pix.qrCodeImage}`}
                  alt="QR Code Pix para pagamento da assinatura Velo"
                  className="mx-auto mt-6 h-56 w-56 rounded-xl border bg-white p-2"
                />
              )}
              {pix.emv && (
                <div className="mt-6 text-left">
                  <Label>Pix copia e cola</Label>
                  <div className="mt-2 flex gap-2">
                    <Input readOnly value={pix.emv} className="font-mono text-xs" />
                    <Button type="button" variant="outline" onClick={copyPix}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Aguardando confirmação do pagamento...
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod("pix")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                    method === "pix" ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <QrCode className="h-4 w-4" /> Pix
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("creditcard")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                    method === "creditcard" ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <CreditCard className="h-4 w-4" /> Cartão de crédito
                </button>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="document">CPF ou CNPJ</Label>
                    <Input
                      id="document"
                      value={document}
                      onChange={(e) => setDocument(maskDocument(e.target.value))}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(maskPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
                </div>

                {method === "creditcard" && (
                  <div className="space-y-4 rounded-xl border p-4">
                    <div>
                      <Label htmlFor="cardNumber">Número do cartão</Label>
                      <Input
                        id="cardNumber"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(maskCard(e.target.value))}
                        placeholder="0000 0000 0000 0000"
                        inputMode="numeric"
                        autoComplete="cc-number"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cardName">Nome impresso no cartão</Label>
                      <Input
                        id="cardName"
                        value={cardName}
                        onChange={(e) => setCardName(e.target.value.toUpperCase())}
                        placeholder="COMO ESTÁ NO CARTÃO"
                        autoComplete="cc-name"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cardExpiration">Validade (MM/AAAA)</Label>
                        <Input
                          id="cardExpiration"
                          value={cardExpiration}
                          onChange={(e) => setCardExpiration(maskExpiration(e.target.value))}
                          placeholder="12/2030"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cardCvv">CVV</Label>
                        <Input
                          id="cardCvv"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                          placeholder="123"
                          inputMode="numeric"
                          autoComplete="cc-csc"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Button className="mt-6 w-full" size="lg" disabled={!readyToPay || loading} onClick={handlePay}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...
                  </>
                ) : method === "pix" ? (
                  `Gerar Pix de ${brl(amount)}`
                ) : (
                  `Pagar ${brl(amount)}`
                )}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                Ambiente seguro. Seus dados de pagamento não ficam armazenados na Velo.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
