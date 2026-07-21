import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { formatBRL, useSalesPageData } from "./salesPageData";

/**
 * Tela · Carrinho
 * Layout inspirado no template "E-Markets" (breadcrumb + stepper +
 * lista + cupom + resumo), adaptado ao design system AERO STEP
 * (creme #f5f2ea, verde musgo #1a3c2a/#3d4a2a, dourado #c8a24a).
 */
const SalesCartPage = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useSalesPageData(slug);
  const [qty, setQty] = useState(1);
  const [delivery, setDelivery] = useState<"delivery" | "pickup">("delivery");
  const [tip, setTip] = useState<number>(4);
  const [useCredits, setUseCredits] = useState(true);
  const [coupon, setCoupon] = useState("");

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

  const unitPrice = data.price;
  const oldPrice = Math.round(unitPrice * 1.25);
  const subtotal = unitPrice * qty;
  const deliveryFee = delivery === "delivery" ? 9.9 : 0;
  const serviceFee = 1.5;
  const tax = 3.5;
  const credits = useCredits ? 5 : 0;
  const total = Math.max(0, subtotal + deliveryFee + serviceFee + tax + tip - credits);

  // Somente lojas (loja_completa) usam o design personalizado AERO STEP.
  // Páginas de vendas (pagina_venda) usam um layout branco/neutro padrão.
  const isStore = data.tipoProjeto === "loja_completa";
  const t = isStore
    ? {
        bg: "#f5f2ea", surface: "rgba(255,255,255,0.8)", border: "rgba(26,26,26,0.08)",
        text: "#1a1a1a", muted: "rgba(26,26,26,0.6)", accent: "#3d4a2a", accentDark: "#1a3c2a",
        accentText: "#f5f2ea", gold: "#c8a24a", cta: "#c8442a", ctaHover: "#a83820",
        thumbBg: "#e8ecd6",
        bodyFont: '"Inter", system-ui, sans-serif',
        displayFont: '"Fraunces", "Playfair Display", serif',
      }
    : {
        bg: "#ffffff", surface: "#ffffff", border: "rgba(15,23,42,0.10)",
        text: "#0f172a", muted: "rgba(15,23,42,0.55)", accent: "#0f172a", accentDark: "#0f172a",
        accentText: "#ffffff", gold: "#0f172a", cta: "#0f172a", ctaHover: "#1e293b",
        thumbBg: "#f1f5f9",
        bodyFont: 'Inter, system-ui, -apple-system, sans-serif',
        displayFont: 'Inter, system-ui, -apple-system, sans-serif',
      };

  const Step = ({ label, active }: { label: string; active?: boolean }) => (
    <span className="text-[12px] tracking-[0.24em] uppercase" style={{ color: active ? t.text : t.muted, fontWeight: active ? 600 : 400 }}>{label}</span>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: t.bg, color: t.text, fontFamily: t.bodyFont }}>
      {/* Topbar */}
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

      <main className="mx-auto max-w-[1240px] px-6 py-10 md:px-10 md:py-14">
        {/* Breadcrumb */}
        <nav className="text-[12px] text-[#1a1a1a]/55">
          <Link to={`/loja/${slug}`} className="hover:text-[#3d4a2a]">Início</Link>
          <span className="mx-2">›</span>
          <span className="text-[#1a1a1a]/80">Loja</span>
        </nav>

        {/* Stepper */}
        <div className="mt-6 flex items-center justify-center gap-6 text-center">
          <Step label="Carrinho" active />
          <span className="h-px w-16 bg-[#1a1a1a]/15" />
          <Step label="Entrega" />
          <span className="h-px w-16 bg-[#1a1a1a]/15" />
          <Step label="Pagamento" />
        </div>

        <h1 className="mt-10 text-[36px] font-bold tracking-tight text-[#1a1a1a] sm:text-[44px]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>
          Meu carrinho
        </h1>
        <div className="mt-3 h-px bg-[#1a1a1a]/10" />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Itens */}
          <section className="rounded-2xl border border-[#1a1a1a]/8 bg-white/80 p-6 shadow-[0_20px_60px_-40px_rgba(26,60,42,0.25)] sm:p-8">
            <div className="flex items-baseline justify-between border-b border-[#1a1a1a]/10 pb-4">
              <h2 className="text-[18px] font-semibold text-[#1a1a1a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>
                Meu carrinho ({qty})
              </h2>
              <Link to={`/loja/${slug}/catalogo`} className="hidden items-center gap-1 text-[12px] font-semibold text-[#3d4a2a] hover:text-[#1a3c2a] sm:inline-flex">
                <ChevronLeft size={14} /> Continuar comprando
              </Link>
            </div>

            <div className="grid grid-cols-[96px_1fr_auto] items-center gap-5 border-b border-[#1a1a1a]/8 py-6">
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-[#e8ecd6]">
                {data.productImage ? (
                  <img src={data.productImage} alt={data.productTitle} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-[#1a1a1a]">{data.productTitle}</p>
                <p className="mt-0.5 text-[12px] text-[#1a1a1a]/55">{data.brand || "Marca"}</p>
                <p className="mt-1 text-[12px] text-[#1a1a1a]/55">
                  Cor: <span className="font-medium text-[#1a1a1a]/80">Padrão</span>
                  <span className="mx-2 text-[#1a1a1a]/25">|</span>
                  Tamanho: <span className="font-medium text-[#1a1a1a]/80">Único</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[12px] text-[#1a1a1a]/40 line-through">{formatBRL(oldPrice)}</span>
                  <span className="text-[16px] font-bold text-[#1a1a1a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>{formatBRL(unitPrice)}</span>
                  <span className="text-[11px] font-bold text-[#c8442a]">20% OFF</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-1 rounded-md border border-[#1a1a1a]/15 bg-white text-[#1a1a1a]/80">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-8 w-8 place-items-center bg-[#1a3c2a] text-[#f5f2ea] hover:bg-[#0f2b1c] rounded-l-md" aria-label="Diminuir">−</button>
                  <span className="w-8 text-center text-[13px] font-semibold text-[#1a1a1a]">{qty}</span>
                  <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="grid h-8 w-8 place-items-center bg-[#1a3c2a] text-[#f5f2ea] hover:bg-[#0f2b1c] rounded-r-md" aria-label="Aumentar">+</button>
                </div>
                <button type="button" onClick={() => navigate(`/loja/${slug}/catalogo`)} className="inline-flex items-center gap-1 text-[12px] text-[#1a1a1a]/55 hover:text-[#c8442a]">
                  <X size={13} /> Remover
                </button>
              </div>
            </div>

            <Link to={`/loja/${slug}/catalogo`} className="mt-6 inline-flex items-center gap-1 text-[12px] font-semibold text-[#3d4a2a] hover:text-[#1a3c2a] sm:hidden">
              <ChevronLeft size={14} /> Continuar comprando
            </Link>
          </section>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Cupons */}
            <section className="rounded-2xl border border-[#1a1a1a]/8 bg-white/80 p-6 shadow-[0_20px_60px_-40px_rgba(26,60,42,0.25)]">
              <h3 className="text-[15px] font-semibold text-[#1a1a1a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>Cupons</h3>
              <div className="mt-4 flex overflow-hidden rounded-md border border-[#1a1a1a]/15 bg-white">
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Código do cupom"
                  className="flex-1 bg-transparent px-3 py-2 text-[13px] outline-none placeholder:text-[#1a1a1a]/35"
                />
                <button type="button" className="bg-[#1a3c2a] px-4 text-[11px] font-bold uppercase tracking-wider text-[#f5f2ea] hover:bg-[#0f2b1c]">
                  Aplicar
                </button>
              </div>
            </section>

            {/* Seu Pedido */}
            <section className="rounded-2xl border border-[#1a1a1a]/8 bg-white/80 p-6 shadow-[0_20px_60px_-40px_rgba(26,60,42,0.25)]">
              <h3 className="text-[15px] font-semibold text-[#1a1a1a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>Seu pedido</h3>

              <div className="mt-4 flex justify-between text-[13px]">
                <span className="text-[#1a1a1a]/60">Subtotal ({qty} {qty === 1 ? "item" : "itens"})</span>
                <span className="font-semibold text-[#1a1a1a]">{formatBRL(subtotal)}</span>
              </div>

              <div className="my-4 border-t border-dashed border-[#1a1a1a]/15" />

              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a1a]/55">Entrega</p>
              <div className="mt-2 space-y-2 text-[13px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={delivery === "delivery"} onChange={() => setDelivery("delivery")} className="h-4 w-4 accent-[#c8a24a]" />
                  <span>Entrega: <span className="font-semibold">{formatBRL(9.9)}</span></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} className="h-4 w-4 accent-[#c8a24a]" />
                  <span>Retirar na loja</span>
                </label>
              </div>

              <div className="my-4 border-t border-dashed border-[#1a1a1a]/15" />

              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#1a1a1a]/55">Gorjeta</p>
              <div className="mt-2 flex gap-2 text-[12px]">
                {[2, 4, 7].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTip(v)}
                    className={`flex-1 rounded-md border px-2 py-2 font-semibold transition ${tip === v ? "border-[#c8a24a] bg-[#c8a24a]/15 text-[#1a3c2a]" : "border-[#1a1a1a]/15 bg-white text-[#1a1a1a]/70 hover:border-[#1a1a1a]/30"}`}
                  >
                    {formatBRL(v)}
                  </button>
                ))}
              </div>

              <div className="my-4 border-t border-dashed border-[#1a1a1a]/15" />

              <div className="flex justify-between text-[13px]">
                <span className="text-[#1a1a1a]/60">Taxa de serviço</span>
                <span className="font-semibold text-[#1a1a1a]">{formatBRL(serviceFee)}</span>
              </div>
              <div className="mt-2 flex justify-between text-[13px]">
                <span className="text-[#1a1a1a]/60">Impostos</span>
                <span className="font-semibold text-[#1a1a1a]">{formatBRL(tax)}</span>
              </div>

              <label className="mt-3 flex items-center justify-between gap-2 text-[13px] cursor-pointer">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={useCredits} onChange={(e) => setUseCredits(e.target.checked)} className="h-4 w-4 accent-[#c8a24a]" />
                  Usar créditos Velo
                </span>
                <span className="font-semibold text-[#1a3c2a]">{formatBRL(5)}</span>
              </label>

              <div className="mt-5 flex items-baseline justify-between border-t border-[#1a1a1a]/15 pt-4">
                <span className="text-[14px] font-semibold text-[#1a1a1a]">Total a pagar</span>
                <span className="text-[22px] font-bold text-[#1a3c2a]" style={{ fontFamily: '"Fraunces", "Playfair Display", serif' }}>{formatBRL(total)}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/loja/${slug}/checkout?qty=${qty}`)}
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-md bg-[#c8442a] text-[12px] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#a83820]"
              >
                Ir para o checkout
              </button>
              <p className="mt-3 text-center text-[11px] text-[#1a1a1a]/45">
                Pagamento 100% seguro · Entrega em todo o Brasil
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SalesCartPage;
