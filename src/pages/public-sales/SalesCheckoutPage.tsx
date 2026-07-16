import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Loader2, Copy, Check, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL, useSalesPageData } from "./salesPageData";

/**
 * Tela 3 — Checkout
 * Layout inspirado na imagem 3 do briefing (Configure your plan / ChatGPT):
 * duas colunas, formulário à esquerda, resumo do pedido à direita.
 * Suporta Pix (QR Code) e cartão de crédito (dados básicos — o tokenizador
 * real do Mercado Pago pode ser plugado depois; por ora envia apenas os dados
 * e cai no fluxo Pix como fallback se não houver token gerado).
 */
type PayMethod = "pix" | "credit_card";

const SalesCheckoutPage = () => {
  const { slug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const qty = Math.max(1, Math.min(10, Number(searchParams.get("qty") ?? 1)));

  const { data, loading, error } = useSalesPageData(slug);
  const [method, setMethod] = useState<PayMethod>("pix");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | {
    orderId: string;
    status: string;
    pixQr?: string | null;
    pixQrBase64?: string | null;
  }>(null);
  const [copied, setCopied] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: "",
    zip: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const total = useMemo(() => (data ? data.price * qty : 0), [data, qty]);

  const handleSubmit = async () => {
    if (!data) return;
    setFormError(null);
    if (!form.name.trim() || !form.email.trim()) {
      setFormError("Nome e e-mail são obrigatórios.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email)) {
      setFormError("E-mail inválido.");
      return;
    }
    setSubmitting(true);
    try {
      const { data: resp, error: fnErr } = await supabase.functions.invoke("public-sales-checkout", {
        body: {
          slug,
          payment_method: method,
          quantity: qty,
          buyer: {
            name: form.name,
            email: form.email,
            phone: form.phone || undefined,
            cpf: form.cpf || undefined,
          },
          shipping: {
            zip: form.zip,
            street: form.street,
            number: form.number,
            complement: form.complement,
            neighborhood: form.neighborhood,
            city: form.city,
            state: form.state,
          },
        },
      });
      if (fnErr || !resp) throw new Error(fnErr?.message || "erro no checkout");
      if ((resp as { error?: string }).error) throw new Error((resp as { error: string }).error);
      const r = resp as { order_id: string; status: string; pix_qr_code?: string | null; pix_qr_code_base64?: string | null };
      setResult({ orderId: r.order_id, status: r.status, pixQr: r.pix_qr_code, pixQrBase64: r.pix_qr_code_base64 });
      if (r.status === "approved") {
        navigate(`/loja/${slug}/obrigado?order=${r.order_id}`);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao processar pagamento");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="animate-spin text-black/40" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-white p-6 text-center">
        <p className="text-lg font-semibold text-black">Página não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Geist", system-ui, sans-serif' }}>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-[13px] font-medium text-black/70 hover:text-black">
          <ArrowLeft size={16} /> Configure seu pedido
        </button>

        <div className="mt-4 flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-full bg-black text-white text-xs font-bold">V</div>
        </div>

        <h1 className="mt-2 text-[28px] font-medium tracking-tight text-black">Finalizar compra</h1>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_400px]">
          {/* Coluna esquerda - formulário */}
          <div className="space-y-8">
            <section>
              <h2 className="text-[18px] font-semibold text-black">Forma de pagamento</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod("pix")}
                  className={`h-16 rounded-2xl border px-4 text-left transition ${method === "pix" ? "border-black bg-black/[0.03]" : "border-black/10 bg-[#F7F7F5]"}`}
                >
                  <p className="text-[13px] font-semibold text-black">Pix</p>
                  <p className="text-[11px] text-black/50">Aprovação imediata</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMethod("credit_card")}
                  className={`h-16 rounded-2xl border px-4 text-left transition ${method === "credit_card" ? "border-black bg-black/[0.03]" : "border-black/10 bg-[#F7F7F5]"}`}
                >
                  <p className="text-[13px] font-semibold text-black">Cartão de crédito</p>
                  <p className="text-[11px] text-black/50">Visa · Master · Amex</p>
                </button>
              </div>

              {method === "credit_card" && (
                <div className="mt-4 grid gap-3">
                  <div className="h-14 rounded-2xl bg-[#F5F5F3] px-4 py-3 text-[13px] text-black/40">Número do cartão</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-14 rounded-2xl bg-[#F5F5F3] px-4 py-3 text-[13px] text-black/40">Validade</div>
                    <div className="h-14 rounded-2xl bg-[#F5F5F3] px-4 py-3 text-[13px] text-black/40">CVV</div>
                  </div>
                  <p className="text-[11px] text-black/50">
                    Nesta versão o cartão está em modo demo — use Pix para concluir uma cobrança real.
                  </p>
                </div>
              )}
            </section>

            <section>
              <h2 className="text-[18px] font-semibold text-black">Seus dados</h2>
              <div className="mt-4 space-y-3">
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" className="h-14 w-full rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="E-mail" type="email" className="h-14 w-full rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Telefone (WhatsApp)" className="h-14 w-full rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                </div>
                <input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="CPF" className="h-14 w-full rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
              </div>
            </section>

            <section>
              <h2 className="text-[18px] font-semibold text-black">Endereço de entrega</h2>
              <div className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                  <input value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} placeholder="CEP" className="h-14 rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                  <input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="Rua" className="h-14 rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="Número" className="h-14 rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                  <input value={form.complement} onChange={(e) => setForm({ ...form, complement: e.target.value })} placeholder="Complemento" className="h-14 rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                  <input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} placeholder="Bairro" className="h-14 rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="Cidade" className="h-14 rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                  <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="UF" maxLength={2} className="h-14 rounded-2xl bg-[#F5F5F3] px-4 text-[14px] text-black outline-none focus:ring-2 focus:ring-black/20" />
                </div>
              </div>
            </section>
          </div>

          {/* Coluna direita - resumo */}
          <aside className="h-fit rounded-3xl border border-black/[0.08] p-7">
            <h2 className="text-[22px] font-medium text-black">Resumo</h2>

            <div className="mt-6 flex items-start gap-3 border-b border-black/[0.06] pb-6">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-[#F0F0EC]">
                {data.productImage ? <img src={data.productImage} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[13px] font-semibold text-black">{data.productTitle}</p>
                <p className="text-[11px] text-black/50">Qtd. {qty}</p>
              </div>
              <p className="text-[13px] font-semibold text-black">{formatBRL(total)}</p>
            </div>

            <dl className="mt-4 space-y-2 text-[13px]">
              <div className="flex justify-between text-black/60">
                <dt>Subtotal</dt>
                <dd>{formatBRL(total)}</dd>
              </div>
              <div className="flex justify-between text-black/60">
                <dt>Frete</dt>
                <dd>Grátis</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-black/[0.06] pt-3 text-[16px] font-semibold text-black">
                <dt>Total</dt>
                <dd>{formatBRL(total)}</dd>
              </div>
            </dl>

            {result?.pixQrBase64 ? (
              <div className="mt-6 rounded-2xl bg-[#F7F7F5] p-4 text-center">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-black/70">Pague com Pix</p>
                <img src={`data:image/png;base64,${result.pixQrBase64}`} alt="QR Code Pix" className="mx-auto mt-3 h-40 w-40 rounded-xl bg-white p-2" />
                <button
                  type="button"
                  onClick={() => {
                    if (result.pixQr) {
                      navigator.clipboard.writeText(result.pixQr);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1600);
                    }
                  }}
                  className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-[12px] font-semibold text-white"
                >
                  {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar código Pix</>}
                </button>
                <p className="mt-2 text-[11px] text-black/50">O pedido é confirmado assim que o pagamento cai.</p>
              </div>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-full bg-black text-[14px] font-semibold text-white transition hover:bg-black/90 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : "Pagar agora"}
              </button>
            )}

            {formError && <p className="mt-3 text-center text-[12px] text-red-500">{formError}</p>}
            <p className="mt-4 text-center text-[10px] leading-relaxed text-black/45">
              Ao concluir você concorda com os termos de uso. Pagamento processado pelo Mercado Pago.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SalesCheckoutPage;
