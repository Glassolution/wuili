import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, ChevronLeft, CreditCard, Loader2, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { formatBRL, useSalesPageData } from "./salesPageData";

/**
 * Tela 2 — Carrinho
 * Layout inspirado no exemplo "tarlet" (imagem 2 do briefing): topbar com marca
 * e navegacao, tabela de itens à esquerda, painel "Payment Info." à direita,
 * botao azul de Check Out e rodapé com Continue Shopping + totais.
 * A submissao real do pagamento acontece na Tela 3 (checkout) — este painel
 * é apenas o resumo/coleta visual que leva o cliente para lá.
 */
const SalesCartPage = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useSalesPageData(slug);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState<"card" | "pix">("card");

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

  const subtotal = data.price * qty;
  const shipping = 0;
  const total = subtotal + shipping;

  return (
    <div className="bg-[#F5F5F5] py-8 px-4 sm:px-8" style={{ fontFamily: '"Inter", system-ui, sans-serif' }}>
      <div className="mx-auto max-w-[1200px] rounded-lg bg-white px-6 py-8 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.12)] sm:px-10 sm:py-8">

        {/* Topbar */}
        <header className="flex items-center justify-between border-b border-black/[0.05] pb-6">
          <Link to={`/loja/${slug}`} className="text-[18px] font-medium tracking-tight text-black">
            {(data.brand || "loja").toLowerCase()}
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

        <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_360px]">
          {/* Cart list */}
          <div>
            <h1 className="text-[36px] font-bold tracking-tight text-black sm:text-[40px]">Carrinho.</h1>

            <div className="mt-10 grid grid-cols-[1.6fr_1fr_1fr_40px] items-center gap-4 border-b border-black/[0.08] pb-4 text-[12px] font-medium text-black/50">
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
                  <span>Grátis</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between border-t border-black/[0.08] pt-3">
                  <span className="text-[15px] font-bold text-black">Total:</span>
                  <span className="text-[18px] font-bold text-black">{formatBRL(total)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment sidebar */}
          <aside className="rounded-md bg-[#F5F5F5] p-6 sm:p-8">
            <h2 className="text-[24px] font-bold tracking-tight text-black">Pagamento.</h2>

            <p className="mt-6 text-[11px] font-medium uppercase tracking-wider text-black/50">Forma de pagamento</p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => setMethod("card")}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition ${method === "card" ? "border-[#2563EB] bg-white" : "border-black/[0.08] bg-white/60"}`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${method === "card" ? "border-[#2563EB]" : "border-black/25"}`}>
                  {method === "card" ? <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" /> : null}
                </span>
                <CreditCard size={16} className="text-black/70" />
                <span className="text-[13px] font-medium text-black">Cartão de crédito</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod("pix")}
                className={`flex w-full items-center gap-3 rounded-md border px-3 py-3 text-left transition ${method === "pix" ? "border-[#2563EB] bg-white" : "border-black/[0.08] bg-white/60"}`}
              >
                <span className={`grid h-4 w-4 place-items-center rounded-full border-2 ${method === "pix" ? "border-[#2563EB]" : "border-black/25"}`}>
                  {method === "pix" ? <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" /> : null}
                </span>
                <span className="grid h-4 w-4 place-items-center rounded-sm bg-[#32BCAD] text-[9px] font-bold text-white">P</span>
                <span className="text-[13px] font-medium text-black">Pix</span>
              </button>
            </div>

            {method === "card" ? (
              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-[11px] font-medium text-black/50">Nome no cartão:</label>
                  <input
                    type="text"
                    placeholder="Nome impresso no cartão"
                    className="mt-1 w-full border-b border-black/20 bg-transparent pb-1 text-[13px] font-medium text-black outline-none placeholder:font-normal placeholder:text-black/30"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-black/50">Número do cartão:</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0000 0000 0000 0000"
                    className="mt-1 w-full border-b border-black/20 bg-transparent pb-1 text-[13px] font-medium tracking-wider text-black outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-black/30"
                  />
                </div>
                <div className="grid grid-cols-[1fr_1fr_60px] gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-black/50">Validade:</label>
                    <button className="mt-1 flex w-full items-center justify-between border-b border-black/20 pb-1 text-[13px] font-medium text-black/30">
                      MM <ChevronDown size={12} className="text-black/40" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-black/50">Ano:</label>
                    <button className="mt-1 flex w-full items-center justify-between border-b border-black/20 pb-1 text-[13px] font-medium text-black/30">
                      AAAA <ChevronDown size={12} className="text-black/40" />
                    </button>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-black/50">CVV:</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="000"
                      maxLength={4}
                      className="mt-1 w-full border-b border-black/20 bg-transparent pb-1 text-[13px] font-medium text-black outline-none placeholder:font-normal placeholder:text-black/30"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-md border border-dashed border-black/15 bg-white p-4 text-[12px] leading-relaxed text-black/60">
                Ao continuar, geramos um QR Code Pix. O pagamento é confirmado em segundos.
              </div>
            )}

            <button
              type="button"
              onClick={() => navigate(`/loja/${slug}/checkout?qty=${qty}&method=${method}`)}
              className="mt-8 inline-flex h-12 w-full items-center justify-center rounded-md bg-[#2563EB] text-[14px] font-semibold text-white transition hover:bg-[#1d4ed8]"
            >
              Finalizar pedido
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default SalesCartPage;
