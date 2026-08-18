import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Loader2, Search, ShoppingBag, X } from "lucide-react";
import { useState } from "react";
import { formatBRL, useSalesPageData } from "./salesPageData";

/**
 * Tela · Carrinho
 * Layout de carrinho no padrão visual da Velo.
 */
const SalesCartPage = () => {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { data, loading, error } = useSalesPageData(slug);
  const [qty, setQty] = useState(1);
  const [delivery, setDelivery] = useState<"delivery" | "pickup">("delivery");
  const [tip, setTip] = useState<number>(4);
  const [useCredits, setUseCredits] = useState(true);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F6F9FF]">
        <Loader2 className="animate-spin text-[#2563EB]" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#F6F9FF] p-6 text-center">
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
  const t = {
    bg: "#F6F9FF",
    surface: "#FFFFFF",
    border: "rgba(30,58,138,0.12)",
    text: "#020817",
    muted: "rgba(15,23,42,0.58)",
    accent: "#2563EB",
    accentDark: "#1E3A8A",
    accentText: "#FFFFFF",
    gold: "#2563EB",
    cta: "#2563EB",
    ctaHover: "#1D4ED8",
    thumbBg: "#EFF6FF",
    bodyFont: "Inter, system-ui, -apple-system, sans-serif",
    displayFont: "Inter, system-ui, -apple-system, sans-serif",
  };

  const Step = ({ label, active }: { label: string; active?: boolean }) => (
    <span className="text-[12px] tracking-[0.24em] uppercase" style={{ color: active ? t.text : t.muted, fontWeight: active ? 600 : 400 }}>{label}</span>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: t.bg, color: t.text, fontFamily: t.bodyFont }}>
      {/* Topbar */}
      <header className="flex flex-wrap items-center justify-between gap-4 bg-white px-6 py-5 shadow-[0_1px_0_rgba(30,58,138,0.10)] md:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold" style={{ backgroundColor: t.accent, color: t.accentText }}>
            {(data.brand || "L").slice(0, 1).toUpperCase()}
          </span>
          <Link to={`/loja/${slug}`} className="text-[15px] font-semibold tracking-tight" style={{ color: t.text }}>
            {(data.brand || "loja").toLowerCase()}
          </Link>
        </div>
        <div className="flex items-center gap-3" style={{ color: t.muted }}>
          <button aria-label="Buscar"><Search size={18} /></button>
          <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[12px] font-semibold" style={{ backgroundColor: t.accent, color: t.accentText }}>
            <ShoppingBag size={14} strokeWidth={2} />
            Carrinho
            <span className="ml-0.5 rounded-full px-1.5 text-[10px] font-bold" style={{ backgroundColor: "#FFFFFF", color: t.accentDark }}>{qty}</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-6 py-10 md:px-10 md:py-14">
        {/* Breadcrumb */}
        <nav className="text-[12px]" style={{ color: t.muted }}>
          <Link to={`/loja/${slug}`}>Início</Link>
          <span className="mx-2">›</span>
          <span>Loja</span>
        </nav>

        {/* Stepper */}
        <div className="mt-6 flex items-center justify-center gap-6 text-center">
          <Step label="Carrinho" active />
          <span className="h-px w-16" style={{ backgroundColor: t.border }} />
          <Step label="Entrega" />
          <span className="h-px w-16" style={{ backgroundColor: t.border }} />
          <Step label="Pagamento" />
        </div>

        <h1 className="mt-10 text-[36px] font-bold tracking-tight sm:text-[44px]" style={{ color: t.text, fontFamily: t.displayFont }}>
          Meu carrinho
        </h1>
        <div className="mt-3 h-px" style={{ backgroundColor: t.border }} />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Itens */}
          <section className="rounded-2xl p-6 sm:p-8" style={{ backgroundColor: t.surface, border: `1px solid ${t.border}`, boxShadow: "0 18px 50px rgba(37,99,235,0.08)" }}>
            <div className="flex items-baseline justify-between pb-4" style={{ borderBottom: `1px solid ${t.border}` }}>
              <h2 className="text-[18px] font-semibold" style={{ color: t.text, fontFamily: t.displayFont }}>
                Meu carrinho ({qty})
              </h2>
              <Link to={`/loja/${slug}/catalogo`} className="hidden items-center gap-1 text-[12px] font-semibold sm:inline-flex" style={{ color: t.accent }}>
                <ChevronLeft size={14} /> Continuar comprando
              </Link>
            </div>

            <div className="grid grid-cols-[96px_1fr_auto] items-center gap-5 py-6" style={{ borderBottom: `1px solid ${t.border}` }}>
              <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl" style={{ backgroundColor: t.thumbBg }}>
                {data.productImage ? (
                  <img src={data.productImage} alt={data.productTitle} className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold" style={{ color: t.text }}>{data.productTitle}</p>
                <p className="mt-0.5 text-[12px]" style={{ color: t.muted }}>{data.brand || "Marca"}</p>
                <p className="mt-1 text-[12px]" style={{ color: t.muted }}>
                  Cor: <span className="font-medium">Padrão</span>
                  <span className="mx-2 opacity-40">|</span>
                  Tamanho: <span className="font-medium">Único</span>
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[12px] line-through" style={{ color: t.muted }}>{formatBRL(oldPrice)}</span>
                  <span className="text-[16px] font-bold" style={{ color: t.text, fontFamily: t.displayFont }}>{formatBRL(unitPrice)}</span>
                  <span className="text-[11px] font-bold text-[#DC2626]">20% OFF</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="flex items-center gap-1 overflow-hidden rounded-md" style={{ border: `1px solid ${t.border}` }}>
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-8 w-8 place-items-center" style={{ backgroundColor: t.accentDark, color: t.accentText }} aria-label="Diminuir">−</button>
                  <span className="w-8 text-center text-[13px] font-semibold" style={{ color: t.text }}>{qty}</span>
                  <button type="button" onClick={() => setQty((q) => Math.min(10, q + 1))} className="grid h-8 w-8 place-items-center" style={{ backgroundColor: t.accentDark, color: t.accentText }} aria-label="Aumentar">+</button>
                </div>
                <button type="button" onClick={() => navigate(`/loja/${slug}/catalogo`)} className="inline-flex items-center gap-1 text-[12px]" style={{ color: t.muted }}>
                  <X size={13} /> Remover
                </button>
              </div>
            </div>

            <Link to={`/loja/${slug}/catalogo`} className="mt-6 inline-flex items-center gap-1 text-[12px] font-semibold sm:hidden" style={{ color: t.accent }}>
              <ChevronLeft size={14} /> Continuar comprando
            </Link>
          </section>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Seu Pedido */}
            <section className="rounded-2xl p-6" style={{ backgroundColor: t.surface, border: `1px solid ${t.border}`, boxShadow: "0 18px 50px rgba(37,99,235,0.08)" }}>
              <h3 className="text-[15px] font-semibold" style={{ color: t.text, fontFamily: t.displayFont }}>Seu pedido</h3>

              <div className="mt-4 flex justify-between text-[13px]">
                <span style={{ color: t.muted }}>Subtotal ({qty} {qty === 1 ? "item" : "itens"})</span>
                <span className="font-semibold" style={{ color: t.text }}>{formatBRL(subtotal)}</span>
              </div>

              <div className="my-4 border-t border-dashed" style={{ borderColor: t.border }} />

              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: t.muted }}>Entrega</p>
              <div className="mt-2 space-y-2 text-[13px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={delivery === "delivery"} onChange={() => setDelivery("delivery")} className="h-4 w-4" style={{ accentColor: t.gold }} />
                  <span>Entrega: <span className="font-semibold">{formatBRL(9.9)}</span></span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")} className="h-4 w-4" style={{ accentColor: t.gold }} />
                  <span>Retirar na loja</span>
                </label>
              </div>

              <div className="my-4 border-t border-dashed" style={{ borderColor: t.border }} />

              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: t.muted }}>Gorjeta</p>
              <div className="mt-2 flex gap-2 text-[12px]">
                {[2, 4, 7].map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTip(v)}
                    className="flex-1 rounded-md px-2 py-2 font-semibold transition"
                    style={tip === v
                      ? { border: `1px solid ${t.gold}`, backgroundColor: "rgba(37,99,235,0.10)", color: t.accentDark }
                      : { border: `1px solid ${t.border}`, backgroundColor: "#fff", color: t.muted }}
                  >
                    {formatBRL(v)}
                  </button>
                ))}
              </div>

              <div className="my-4 border-t border-dashed" style={{ borderColor: t.border }} />

              <div className="flex justify-between text-[13px]">
                <span style={{ color: t.muted }}>Taxa de serviço</span>
                <span className="font-semibold" style={{ color: t.text }}>{formatBRL(serviceFee)}</span>
              </div>
              <div className="mt-2 flex justify-between text-[13px]">
                <span style={{ color: t.muted }}>Impostos</span>
                <span className="font-semibold" style={{ color: t.text }}>{formatBRL(tax)}</span>
              </div>

              <label className="mt-3 flex items-center justify-between gap-2 text-[13px] cursor-pointer">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={useCredits} onChange={(e) => setUseCredits(e.target.checked)} className="h-4 w-4" style={{ accentColor: t.gold }} />
                  Usar créditos Velo
                </span>
                <span className="font-semibold" style={{ color: t.accentDark }}>{formatBRL(5)}</span>
              </label>

              <div className="mt-5 flex items-baseline justify-between pt-4" style={{ borderTop: `1px solid ${t.border}` }}>
                <span className="text-[14px] font-semibold" style={{ color: t.text }}>Total a pagar</span>
                <span className="text-[22px] font-bold" style={{ color: t.accentDark, fontFamily: t.displayFont }}>{formatBRL(total)}</span>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/loja/${slug}/checkout?qty=${qty}`)}
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-md text-[12px] font-bold uppercase tracking-[0.18em] text-white transition"
                style={{ backgroundColor: t.cta }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = t.ctaHover; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = t.cta; }}
              >
                Ir para o checkout
              </button>
              <p className="mt-3 text-center text-[11px]" style={{ color: t.muted }}>
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
