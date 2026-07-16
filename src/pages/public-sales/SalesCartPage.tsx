import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, Minus, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { useState } from "react";
import { formatBRL, useSalesPageData } from "./salesPageData";

/**
 * Tela 2 — Carrinho / Confirmação
 * Layout inspirado no exemplo Coralab (imagem 2 do briefing):
 * título grande, card do produto, bloco de "Pagamento seguro" e CTA total.
 */
const SalesCartPage = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useSalesPageData(slug);
  const [qty, setQty] = useState(1);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F3F3F1]">
        <Loader2 className="animate-spin text-black/40" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F3F3F1] p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-black">Página não encontrada</p>
          <p className="mt-2 text-sm text-black/60">{error ?? "Tente novamente mais tarde."}</p>
        </div>
      </div>
    );
  }

  const subtotal = data.price * qty;

  return (
    <div className="min-h-screen bg-[#F3F3F1] py-8 px-4 sm:px-6 lg:py-16" style={{ fontFamily: '"Geist", system-ui, sans-serif' }}>
      <div className="mx-auto max-w-3xl rounded-3xl bg-white p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.15)] sm:p-10">
        <div className="flex items-start justify-between">
          <div className="relative">
            <h1 className="text-[44px] font-medium leading-none tracking-tight text-black sm:text-[56px]">Carrinho</h1>
            <span className="absolute -top-2 left-full ml-1 text-[11px] font-medium text-black/60">1</span>
          </div>
          <Link to={`/loja/${slug}`} aria-label="Fechar" className="rounded-full p-2 text-black/70 transition hover:bg-black/5">
            <X size={22} />
          </Link>
        </div>

        <div className="mt-8 flex items-start gap-4 border-b border-black/[0.06] pb-8">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-black/70" />
          <div className="flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black">Pagamento seguro</p>
            <p className="mt-1 text-[13px] leading-relaxed text-black/60">
              Visa, Mastercard, Pix, cartão de crédito em até 12x. Ambiente 100% protegido pelo Mercado Pago.
            </p>
          </div>
          <span className="mt-1 inline-flex h-5 w-9 items-center rounded-full bg-black p-0.5">
            <span className="ml-auto h-4 w-4 rounded-full bg-white" />
          </span>
        </div>

        <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start">
          <div className="h-40 w-40 shrink-0 overflow-hidden rounded-2xl bg-[#E9E9E5]">
            {data.productImage ? (
              <img src={data.productImage} alt={data.productTitle} className="h-full w-full object-cover" />
            ) : null}
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[18px] font-semibold text-black">{data.productTitle}</p>
                <p className="text-[13px] text-black/50">Envio para todo o Brasil</p>
              </div>
              <p className="text-[18px] font-semibold text-black">{formatBRL(data.price)}</p>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <div className="inline-flex items-center rounded-full border border-black/[0.12]">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-9 w-9 place-items-center text-black/70 hover:text-black" aria-label="Diminuir">
                  <Minus size={14} />
                </button>
                <span className="w-8 text-center text-[14px] font-semibold text-black">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="grid h-9 w-9 place-items-center text-black/70 hover:text-black" aria-label="Aumentar">
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" onClick={() => navigate(`/loja/${slug}`)} className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-black/50 hover:text-black">
                <Trash2 size={14} /> Remover
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-black/[0.08] pt-6">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[34px] font-medium leading-none text-black">Total</p>
              <p className="mt-2 text-[12px] text-black/50">Cupons aplicados no checkout.</p>
            </div>
            <p className="text-[28px] font-medium text-black">{formatBRL(subtotal)}</p>
          </div>

          <button
            type="button"
            onClick={() => navigate(`/loja/${slug}/checkout?qty=${qty}`)}
            className="mt-6 inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-black text-[13px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-black/90"
          >
            Ir para o checkout <span className="grid h-2 w-2 place-items-center rounded-full bg-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SalesCartPage;
