import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Lock, QrCode, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { startValidaPayCheckout, type VelloBillingCycle, type VelloPlanId } from "@/lib/validapayCheckout";

/**
 * Checkout da Velo (tela própria, 100% sob nosso controle visual: logo, cores e
 * textos podem ser alterados aqui). O cliente confere o plano e informa os
 * dados; ao clicar em pagar, ele segue para a ValidaPay, que processa Pix e
 * cartão exatamente como antes.
 */

const PLANS: Record<VelloPlanId, { name: string; monthly: number; annual: number; perks: string[] }> = {
  base: {
    name: "Velo Base",
    monthly: 39.9,
    annual: 430.92,
    perks: ["Até 50 anúncios publicados", "Catálogo validado da Velo", "Publicação no Mercado Livre", "Suporte por chamado"],
  },
  pro: {
    name: "Velo Pro",
    monthly: 79.8,
    annual: 861.84,
    perks: ["Até 300 anúncios publicados", "Sincronização automática de estoque", "Imagens e textos com IA", "Suporte prioritário"],
  },
  business: {
    name: "Velo Business",
    monthly: 159.6,
    annual: 1723.68,
    perks: ["Anúncios ilimitados", "IA sem limites diários", "Todos os recursos do Pro", "Atendimento dedicado"],
  },
};

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const maskDocument = (value: string) => {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

const maskPhone = (value: string) => {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
};

const AssinaturaCheckoutPage = () => {
  const navigate = useNavigate();
  const { plan: planParam } = useParams();
  const [searchParams] = useSearchParams();

  const planId = (["base", "pro", "business"].includes(String(planParam)) ? planParam : "base") as VelloPlanId;
  const cycle: VelloBillingCycle = searchParams.get("cycle") === "annual" ? "annual" : "monthly";
  const plan = PLANS[planId];

  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [phone, setPhone] = useState("");
  const [method, setMethod] = useState<"pix" | "credit_card">("pix");
  const [coupon, setCoupon] = useState(searchParams.get("cupom") ?? "");
  const [showCoupon, setShowCoupon] = useState(Boolean(searchParams.get("cupom")));
  const [loading, setLoading] = useState(false);

  const amount = useMemo(() => (cycle === "annual" ? plan.annual : plan.monthly), [plan, cycle]);
  const cycleLabel = cycle === "annual" ? "anual" : "mensal";

  const handlePay = async () => {
    if (loading) return;
    if (name.trim().length < 3) {
      toast.error("Informe seu nome completo.");
      return;
    }
    const doc = onlyDigits(document);
    if (doc.length !== 11 && doc.length !== 14) {
      toast.error("Informe um CPF ou CNPJ válido.");
      return;
    }
    setLoading(true);
    const res = await startValidaPayCheckout(planId, cycle, coupon.trim() || null, {
      name: name.trim(),
      document: doc,
      phone: onlyDigits(phone) || undefined,
      method,
    });
    if (res.ok) return; // o navegador segue para a ValidaPay
    setLoading(false);
    toast.error(res.error ?? "Não foi possível abrir o pagamento.");
  };

  return (
    <div className="min-h-screen bg-white text-[#111111]">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* Resumo do pedido — identidade Velo */}
        <aside className="border-b border-black/10 px-6 py-10 sm:px-10 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#F3F3F2] transition hover:bg-[#E9E9E7]"
              aria-label="Voltar"
            >
              <ArrowLeft size={18} />
            </button>
            <img src="/logo.png" alt="Velo" className="h-10 w-10 rounded-xl object-contain" />
            <span className="text-lg font-semibold tracking-tight">Velo</span>
          </div>

          <h1 className="mt-10 text-2xl font-bold tracking-tight">Assinar {plan.name} — {cycleLabel}</h1>
          <p className="mt-3 text-4xl font-extrabold tracking-tight">
            {brl(amount)} <span className="text-base font-medium text-[#6B7280]">/{cycleLabel}</span>
          </p>

          <div className="mt-8 space-y-3 border-t border-black/10 pt-6 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#4B5563]">{plan.name} — {cycleLabel}</span>
              <span className="font-semibold">{brl(amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#4B5563]">Subtotal</span>
              <span className="font-semibold">{brl(amount)}</span>
            </div>

            {showCoupon ? (
              <input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="Código promocional"
                className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none focus:border-black"
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowCoupon(true)}
                className="rounded-xl bg-[#F3F3F2] px-4 py-2.5 text-sm font-medium text-[#111] transition hover:bg-[#E9E9E7]"
              >
                Adicionar código promocional
              </button>
            )}

            <div className="flex items-center justify-between border-t border-black/10 pt-4 text-base">
              <span className="font-bold">Valor da compra</span>
              <span className="font-bold">{brl(amount)}</span>
            </div>
          </div>

          <ul className="mt-8 space-y-2.5 text-sm text-[#4B5563]">
            {plan.perks.map((perk) => (
              <li key={perk} className="flex items-start gap-2">
                <Check size={16} className="mt-0.5 shrink-0 text-[#2563EB]" />
                {perk}
              </li>
            ))}
          </ul>
        </aside>

        {/* Dados do cliente */}
        <section className="px-6 py-10 sm:px-10">
          <h2 className="text-3xl font-light tracking-tight text-[#374151]">Informações pessoais</h2>

          <div className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-medium text-[#374151]">Nome completo *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3.5 text-sm outline-none transition focus:border-black"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-[#374151]">CPF/CNPJ *</label>
                <input
                  value={document}
                  onChange={(e) => setDocument(maskDocument(e.target.value))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3.5 text-sm outline-none transition focus:border-black"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-[#374151]">Telefone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(maskPhone(e.target.value))}
                  placeholder="(00) 00000-0000"
                  inputMode="numeric"
                  className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3.5 text-sm outline-none transition focus:border-black"
                />
              </div>
            </div>

            <div>
              <span className="text-sm font-medium text-[#374151]">Forma de pagamento:</span>
              <div className="mt-3 grid grid-cols-2 gap-4">
                {([
                  { id: "pix", label: "Pix", icon: QrCode },
                  { id: "credit_card", label: "Cartão de crédito", icon: CreditCard },
                ] as const).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMethod(id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl border px-4 py-5 text-sm font-medium transition ${
                      method === id ? "border-black bg-[#F7F7F6]" : "border-black/10 hover:border-black/30"
                    }`}
                  >
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handlePay()}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] py-4 text-base font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-70"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Abrindo pagamento...
                </>
              ) : (
                <>
                  <Lock size={18} /> {method === "pix" ? "Pagar com Pix" : "Pagar com cartão"}
                </>
              )}
            </button>

            <p className="text-center text-xs text-[#6B7280]">
              Pagamento processado com segurança pela ValidaPay. Você será direcionado para concluir a compra.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default AssinaturaCheckoutPage;
