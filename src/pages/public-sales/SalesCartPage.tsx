import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { formatBRL, useSalesPageData } from "./salesPageData";
import { ProfitPill } from "./ProfitPill";

/**
 * Tela 2 — Carrinho.
 * Layout inspirado na referência "tarlet" da tela 2. Todos os textos, cores,
 * logo e valores respeitam o objeto `checkout` salvo em user_projects.metadata,
 * permitindo que o dono personalize sem tocar em código. Quando o dono abre
 * a página em modo preview aparece o pill de lucro (só visível para ele).
 */
const SalesCartPage = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useSalesPageData(slug);
  const [qty, setQty] = useState(1);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F5F5F5]">
        <Loader2 className="animate-spin text-black/40" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F5F5F5] p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-black">Página não encontrada</p>
          <p className="mt-2 text-sm text-black/60">{error ?? "Tente novamente mais tarde."}</p>
        </div>
      </div>
    );
  }

  const c = data.checkout;
  const subtotal = data.price * qty;
  const freightValue = typeof c.freightValue === "number" && c.freightValue > 0 ? c.freightValue : 0;
  const total = subtotal + freightValue;
  const freightLabel = c.freightLabel || (freightValue > 0 ? formatBRL(freightValue) : "Grátis");
  const cartTitle = c.cartTitle || "Carrinho.";
  const ctaLabel = c.cartCtaLabel || "Finalizar pedido";
  const accent = data.accent || "#2563EB";

  return (
    <div className="bg-[#F5F5F5] py-8 px-4 sm:px-8" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
      <div className="mx-auto max-w-[1200px] rounded-lg bg-white px-6 py-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.12)] sm:px-10 sm:py-8">
        {/* Topbar */}
        <header className="flex items-center justify-between border-b border-black/[0.05] pb-6">
          <Link to={`/loja/${slug}`} className="flex items-center gap-2 text-[18px] font-medium tracking-tight text-black">
            {data.logoImage ? (
              <img src={data.logoImage} alt={data.brand} className="h-7 w-7 rounded-md object-cover" />
            ) : null}
            <span>{(data.brand || "loja").toLowerCase()}</span>
          </Link>
          <nav className="hidden items-center gap-10 text-[14px] text-black/70 md:flex">
            <Link to={`/loja/${slug}`} className="hover:text-black">Loja</Link>
            <a href="#" className="hover:text-black">Novidades</a>
            <a href="#" className="hover:text-black">Sobre</a>
            <a href="#" className="hover:text-black">Contato</a>
          </nav>
          <div className="flex items-center gap-5 text-black/70">
            <button aria-label="Buscar" className="hover:text-black"><Search size={18} /></button>
            <div className="flex items-center gap-2">
              <ShoppingBag size={18} />
              <span className="text-[13px] font-medium text-black">{qty}</span>
            </div>
            <button aria-label="Menu" className="hover:text-black"><Menu size={20} /></button>
          </div>
        </header>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Cart list */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-[36px] font-bold tracking-tight text-black sm:text-[40px]">{cartTitle}</h1>
              <ProfitPill price={data.price} cost={data.ownerCostPrice} visible={data.isOwnerPreview} />
            </div>

            <div className="mt-8 grid grid-cols-[1.6fr_1fr_1fr_40px] items-center gap-4 border-b border-black/[0.08] pb-4 text-[12px] font-medium text-black/50">
              <span>Produto</span>
              <span>Quantidade</span>
              <span>Total</span>
              <span />
            </div>

            <div className="grid grid-cols-[1.6fr_1fr_1fr_40px] items-center gap-4 border-b border-black/[0.06] py-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-[#EDEDEA]">
                  {data.productImage ? (
                    <img src={data.productImage} alt={data.productTitle} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-black">{data.productTitle}</p>
                  <p className="mt-0.5 text-[12px] text-black/50">Envio para todo o Brasil</p>
                </div>
              </div>
              <div className="flex items-center gap-3 text-black/70">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="text-[16px] leading-none hover:text-black" aria-label="Diminuir">−</button>
                <span className="w-6 text-center text-[14px] font-medium text-black">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="text-[16px] leading-none hover:text-black" aria-label="Aumentar">+</button>
              </div>
              <p className="text-[14px] font-medium text-black">{formatBRL(subtotal)}</p>
              <button type="button" onClick={() => navigate(`/loja/${slug}`)} className="justify-self-end text-black/40 hover:text-black" aria-label="Remover">
                <X size={16} />
              </button>
            </div>

            <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <Link to={`/loja/${slug}`} className="inline-flex items-center gap-2 text-[14px] font-semibold text-black hover:text-black/70">
                <ChevronLeft size={16} /> Continuar comprando
              </Link>
              <div className="min-w-[220px] space-y-2 text-[13px]">
                <div className="flex justify-between text-black/60">
                  <span>Subtotal</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>
                <div className="flex justify-between text-black/60">
                  <span>Frete</span>
                  <span>{freightLabel}</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-black/[0.08] pt-3">
                  <span className="text-[15px] font-bold text-black">Total:</span>
                  <span className="text-[18px] font-bold text-black">{formatBRL(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resumo → checkout */}
          <aside className="rounded-md bg-[#F5F5F5] p-6 sm:p-8">
            <h2 className="text-[24px] font-bold tracking-tight text-black">Resumo.</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-black/55">
              Continue para o checkout para preencher os dados de entrega e pagamento (Pix ou cartão).
            </p>

            <div className="mt-6 space-y-3 text-[13px]">
              <div className="flex justify-between text-black/60">
                <span>Itens ({qty})</span>
                <span>{formatBRL(subtotal)}</span>
              </div>
              <div className="flex justify-between text-black/60">
                <span>Frete</span>
                <span>{freightLabel}</span>
              </div>
              <div className="flex justify-between border-t border-black/[0.08] pt-3">
                <span className="text-[14px] font-semibold text-black">Total</span>
                <span className="text-[16px] font-bold text-black">{formatBRL(total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/loja/${slug}/checkout?qty=${qty}`)}
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-md text-[14px] font-semibold text-white transition hover:opacity-90"
              style={{ backgroundColor: accent }}
            >
              {ctaLabel}
            </button>
            <p className="mt-3 text-center text-[11px] text-black/45">Pagamento processado com Mercado Pago.</p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SalesCartPage;
