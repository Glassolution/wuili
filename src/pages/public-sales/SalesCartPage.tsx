import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, CreditCard, Loader2, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { formatBRL, useSalesPageData } from "./salesPageData";

/**
 * Tela · Carrinho
 * Segue o design system do template AERO STEP (creme #f5f2ea, verde musgo
 * #3d4a2a/#1a3c2a, dourado #c8a24a) para manter o mesmo idioma visual da Home,
 * Catálogo e Produto. O Checkout mantém o layout dele separadamente.
 */
const SalesCartPage = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useSalesPageData(slug);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<"card" | "pix">("card");

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea]">
        <Loader2 className="animate-spin text-[#3d4a2a]" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea] p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-[#1a1a1a]">Página não encontrada</p>
          <p className="mt-2 text-sm text-[#1a1a1a]/60">{error ?? "Tente novamente mais tarde."}</p>
        </div>
      </div>
    );
  }

  const subtotal = data.price * qty;
  const shipping = 0;
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-[#1a1a1a]" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
      {/* Topbar (mesmo padrão do Catálogo/Produto) */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1a1a1a]/8 px-6 py-5 md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d4a2a] text-[11px] font-semibold text-[#f5f2ea]">
            {(data.brand || "L").slice(0, 1).toUpperCase()}
          </span>
          <Link to={`/loja/${slug}`} className="text-[15px] font-semibold tracking-tight text-[#1a1a1a]">
            {(data.brand || "loja").toLowerCase()}
          </Link>
        </div>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-[#1a1a1a]/75 md:flex">
          <Link to={`/loja/${slug}`} className="hover:text-[#3d4a2a]">Loja</Link>
          <Link to={`/loja/${slug}/catalogo`} className="hover:text-[#3d4a2a]">Catálogo</Link>
          <a href="#" className="hover:text-[#3d4a2a]">Sobre</a>
          <a href="#" className="hover:text-[#3d4a2a]">Contato</a>
        </nav>
        <div className="flex items-center gap-3 text-[#1a1a1a]/75">
          <button aria-label="Buscar" className="hover:text-[#3d4a2a]"><Search size={18} /></button>
          <span className="inline-flex items-center gap-2 rounded-full bg-[#3d4a2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea]">
            <ShoppingBag size={14} strokeWidth={2} />
            Carrinho
            <span className="ml-0.5 rounded-full bg-[#c8a24a] px-1.5 text-[10px] font-bold text-[#3d4a2a]">{qty}</span>
          </span>
          <button aria-label="Menu" className="hover:text-[#3d4a2a] md:hidden"><Menu size={20} /></button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-6 py-12 md:px-10 md:py-16">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#3d4a2a]">
              Seu pedido
            </span>
            <h1 className="mt-3 text-[36px] font-bold tracking-tight text-[#1a1a1a] sm:text-[44px]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>
              Carrinho.
            </h1>
          </div>
          <Link to={`/loja/${slug}/catalogo`} className="hidden items-center gap-2 text-[13px] font-semibold text-[#3d4a2a] hover:text-[#2c3620] md:inline-flex">
            <ChevronLeft size={16} /> Continuar comprando
          </Link>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_380px]">
          {/* Itens */}
          <section className="rounded-3xl border border-[#1a1a1a]/8 bg-white/70 p-6 shadow-[0_20px_60px_-40px_rgba(26,60,42,0.35)] sm:p-8">
            <div className="grid grid-cols-[1.6fr_1fr_1fr_40px] items-center gap-4 border-b border-[#1a1a1a]/8 pb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3d4a2a]/70">
              <span>Produto</span>
              <span>Quantidade</span>
              <span>Total</span>
              <span />
            </div>

            <div className="grid grid-cols-[1.6fr_1fr_1fr_40px] items-center gap-4 border-b border-[#1a1a1a]/6 py-6">
              <div className="flex items-center gap-4">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-[#e8ecd6]">
                  {data.productImage ? (
                    <img src={data.productImage} alt={data.productTitle} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-[#1a1a1a]">{data.productTitle}</p>
                  <p className="mt-0.5 text-[12px] text-[#1a1a1a]/55">Envio para todo o Brasil</p>
                </div>
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#1a1a1a]/10 bg-white px-3 py-1.5 text-[#1a1a1a]/80 w-fit">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="text-[16px] leading-none text-[#3d4a2a] hover:text-[#1a3c2a]" aria-label="Diminuir">−</button>
                <span className="w-6 text-center text-[13px] font-semibold text-[#1a1a1a]">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="text-[16px] leading-none text-[#3d4a2a] hover:text-[#1a3c2a]" aria-label="Aumentar">+</button>
              </div>
              <p className="text-[15px] font-bold text-[#1a3c2a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>{formatBRL(subtotal)}</p>
              <button type="button" onClick={() => navigate(`/loja/${slug}/catalogo`)} className="justify-self-end text-[#1a1a1a]/40 hover:text-[#3d4a2a]" aria-label="Remover">
                <X size={16} />
              </button>
            </div>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <Link to={`/loja/${slug}/catalogo`} className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#3d4a2a] hover:text-[#1a3c2a]">
                <ChevronLeft size={16} /> Continuar comprando
              </Link>
              <div className="min-w-[240px] space-y-2 text-[13px]">
                <div className="flex justify-between text-[#1a1a1a]/60">
                  <span>Subtotal</span>
                  <span>{formatBRL(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#1a1a1a]/60">
                  <span>Frete</span>
                  <span className="text-[#3d4a2a] font-semibold">Grátis</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-[#1a1a1a]/10 pt-3">
                  <span className="text-[14px] font-bold text-[#1a1a1a]">Total</span>
                  <span className="text-[20px] font-bold text-[#1a3c2a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>{formatBRL(total)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Pagamento */}
          <aside className="rounded-3xl border border-[#1a1a1a]/8 bg-[#1a3c2a] p-6 text-[#f5f2ea] shadow-[0_28px_80px_-40px_rgba(26,60,42,0.55)] sm:p-8">
            <span className="inline-flex items-center rounded-full bg-[#c8a24a]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c8a24a]">
              Pagamento
            </span>
            <h2 className="mt-3 text-[26px] font-bold tracking-tight" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>
              Finalize com segurança.
            </h2>

            <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f5f2ea]/60">Forma de pagamento</p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setMethod("card")}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${method === "card" ? "border-[#c8a24a] bg-[#f5f2ea]/10" : "border-white/10 bg-transparent hover:border-white/20"}`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${method === "card" ? "border-[#c8a24a]" : "border-white/30"}`}>
                  {method === "card" ? <span className="h-1.5 w-1.5 rounded-full bg-[#c8a24a]" /> : null}
                </span>
                <CreditCard size={16} className="text-[#f5f2ea]/80" />
                <span className="text-[13px] font-medium">Cartão de crédito</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod("pix")}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${method === "pix" ? "border-[#c8a24a] bg-[#f5f2ea]/10" : "border-white/10 bg-transparent hover:border-white/20"}`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${method === "pix" ? "border-[#c8a24a]" : "border-white/30"}`}>
                  {method === "pix" ? <span className="h-1.5 w-1.5 rounded-full bg-[#c8a24a]" /> : null}
                </span>
                <span className="grid h-4 w-4 place-items-center rounded-sm bg-[#c8a24a] text-[9px] font-bold text-[#1a3c2a]">P</span>
                <span className="text-[13px] font-medium">Pix</span>
              </button>
            </div>

            <div className="mt-6 rounded-2xl bg-[#f5f2ea]/5 p-4 text-[12.5px] leading-relaxed text-[#f5f2ea]/75">
              {method === "card"
                ? "Você preencherá os dados do cartão no próximo passo, com criptografia ponta a ponta."
                : "Ao continuar, geramos um QR Code Pix. O pagamento é confirmado em segundos."}
            </div>

            <div className="mt-6 space-y-1.5 border-t border-white/10 pt-5 text-[13px] text-[#f5f2ea]/80">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(subtotal)}</span></div>
              <div className="flex justify-between"><span>Frete</span><span className="text-[#c8a24a] font-semibold">Grátis</span></div>
              <div className="mt-3 flex items-baseline justify-between border-t border-white/10 pt-3 text-[#f5f2ea]">
                <span className="text-[13px] font-semibold uppercase tracking-[0.18em]">Total</span>
                <span className="text-[22px] font-bold" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>{formatBRL(total)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate(`/loja/${slug}/checkout?qty=${qty}&method=${method}`)}
              className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#c8a24a] text-[13.5px] font-bold text-[#1a3c2a] transition hover:bg-[#b8922e]"
            >
              Finalizar pedido
            </button>
            <p className="mt-3 text-center text-[11px] text-[#f5f2ea]/50">
              Pagamento 100% seguro · Entrega em todo o Brasil
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default SalesCartPage;
