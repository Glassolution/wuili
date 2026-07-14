import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, Loader2, PackageOpen } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import type { ExampleProduct } from "@/pages/StartChoicePage";

const steps = [
  "Buscando dados dos produtos",
  "Calculando margem sugerida",
  "Verificando concorrência no Mercado Livre",
  "Analisando avaliações do catálogo",
  "Preparando sugestões de venda",
];

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const ProductPreparationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const products = useMemo(() => {
    const fromState = (location.state as { product?: ExampleProduct; products?: ExampleProduct[] } | null);
    if (fromState?.products?.length) return fromState.products;
    if (fromState?.product) return [fromState.product];
    try {
      const storedProducts = sessionStorage.getItem("velo-example-products");
      if (storedProducts) {
        const parsedProducts = JSON.parse(storedProducts) as ExampleProduct[];
        if (Array.isArray(parsedProducts) && parsedProducts.length > 0) return parsedProducts;
      }
      const storedProduct = sessionStorage.getItem("velo-example-product");
      return storedProduct ? [JSON.parse(storedProduct) as ExampleProduct] : [];
    } catch {
      return [];
    }
  }, [location.state]);
  const [progress, setProgress] = useState(0);
  const [activeProductIndex, setActiveProductIndex] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const duration = 12000;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const next = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(next);
      if (next === 100) window.clearInterval(timer);
    }, 80);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (products.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveProductIndex((current) => (current + 1) % products.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [products.length]);

  if (!products.length) return <Navigate to="/comecar" replace />;

  const product = products[activeProductIndex] ?? products[0];
  const primaryProduct = products[0];
  const hasMultipleProducts = products.length > 1;
  const completedSteps = Math.min(5, Math.floor(progress / 20));
  const isReady = progress === 100;
  const progressFactor = progress / 100;
  const totalCost = products.reduce((sum, item) => sum + item.price, 0);
  const visibleCost = totalCost * progressFactor;
  const visibleProfit = totalCost * 0.72 * progressFactor;
  const visibleRevenue = totalCost * 1.72 * progressFactor;

  return (
    <main className="min-h-screen bg-black text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <style>
        {`
          @keyframes veloProductCardWork {
            0%, 100% { transform: translateY(0) rotateX(0deg) rotateY(0deg); }
            28% { transform: translateY(-10px) rotateX(1.4deg) rotateY(-1.8deg); }
            58% { transform: translateY(5px) rotateX(-1deg) rotateY(1.2deg); }
            82% { transform: translateY(-4px) rotateX(.8deg) rotateY(.6deg); }
          }

          @keyframes veloProductImageSlide {
            0% { opacity: 0; transform: translateX(42px) scale(.92) rotateZ(1.8deg); filter: blur(10px); }
            58% { opacity: 1; transform: translateX(-4px) scale(1.03) rotateZ(-.4deg); filter: blur(0); }
            100% { opacity: 1; transform: translateX(0) scale(1) rotateZ(0deg); filter: blur(0); }
          }

          @keyframes veloScanningLine {
            0% { transform: translateY(-115%); opacity: 0; }
            18% { opacity: .72; }
            80% { opacity: .42; }
            100% { transform: translateY(115%); opacity: 0; }
          }

          @keyframes veloMetricPulse {
            0%, 100% { text-shadow: 0 0 0 rgba(52, 211, 153, 0); }
            50% { text-shadow: 0 0 18px rgba(52, 211, 153, .34); }
          }
        `}
      </style>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden px-7 py-7 sm:px-10 lg:px-16 lg:py-10 xl:px-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_45%,rgba(255,255,255,0.045),transparent_38%)]" />
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/escolher-produto" className="inline-flex items-center gap-2 text-[12px] font-medium text-white/45 transition hover:text-white">
              <ChevronLeft size={16} /> Voltar
            </Link>
            <div className="w-[42%] max-w-[310px]">
              <div className="h-[4px] overflow-hidden rounded-full bg-white/[0.09]">
                <div className="h-full rounded-full bg-white/35 transition-[width] duration-100" style={{ width: `${18 + progress * 0.32}%` }} />
              </div>
            </div>
          </header>

          <div className="relative z-10 my-auto w-full max-w-[620px] py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
              {hasMultipleProducts ? "Produtos de exemplo" : "Produto de exemplo"}
            </p>
            <div className="mt-4 flex items-end justify-between gap-6">
              <h1 className="text-[42px] font-normal leading-[1.04] tracking-[-0.055em] sm:text-[54px]">
                Preparando {hasMultipleProducts ? "seus produtos" : "seu produto"}
              </h1>
              <span className="shrink-0 text-[28px] font-light tabular-nums tracking-[-0.04em] text-white/75">{progress}%</span>
            </div>
            <Progress value={progress} aria-label={hasMultipleProducts ? "Preparando seus produtos" : "Preparando seu produto"} className="mt-8 h-[6px] bg-white/[0.08] [&>div]:bg-[#f3efe8] [&>div]:duration-100" />

            <div className="mt-8 space-y-2">
              {steps.map((step, index) => {
                const done = index < completedSteps;
                const active = index === completedSteps && !isReady;
                return (
                  <div key={step} className={`flex min-h-[52px] items-center gap-3 rounded-[6px] px-4 transition duration-500 ${done ? "bg-white/[0.055]" : active ? "bg-white/[0.035]" : "bg-transparent"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${done ? "bg-[#f3efe8] text-black" : active ? "bg-white/[0.06] text-white/55" : "bg-white/[0.025] text-transparent"}`}>
                      {done ? <Check size={14} strokeWidth={2.4} /> : active ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </span>
                    <span className={`text-[13px] transition ${done ? "text-white/75" : active ? "text-white/62" : "text-white/25"}`}>{step}</span>
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={() => navigate("/onboarding/idioma", { state: { product: primaryProduct, products } })} disabled={!isReady} className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-[5px] bg-[#f3efe8] text-[13px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-white/25">
              {isReady ? "Continuar" : "Preparando..."}
            </button>
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#010101] p-12 lg:flex">
          <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.14),transparent_38%,rgba(0,0,0,0.45)_78%)]" />
          <article className="relative z-10 w-full max-w-[360px] overflow-hidden rounded-[12px] bg-[#111]/95 p-3 shadow-[0_30px_90px_rgba(0,0,0,0.65)] [animation:veloProductCardWork_4.8s_ease-in-out_infinite]">
            <div className="pointer-events-none absolute inset-x-5 top-5 h-24 rounded-full bg-emerald-400/10 blur-3xl" />
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[7px] bg-[#f4f2ef]">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 bg-gradient-to-b from-transparent via-emerald-300/16 to-transparent [animation:veloScanningLine_2.4s_ease-in-out_infinite]" />
              {product.imageUrl ? (
                <img
                  key={product.id}
                  src={product.imageUrl}
                  alt={product.title}
                  className="h-full w-full object-contain [animation:veloProductImageSlide_620ms_cubic-bezier(.16,1,.3,1)]"
                />
              ) : (
                <PackageOpen size={48} className="text-black/20" />
              )}
            </div>
            <div className="p-3 pb-2 pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${isReady ? "text-emerald-400" : "text-white/45"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isReady ? "bg-emerald-400" : "animate-pulse bg-white/40"}`} />
                  {isReady ? "Pronto" : "Analisando..."}
                </span>
                <span className="text-[13px] font-medium text-white/65">
                  {products.length > 1 ? `${activeProductIndex + 1}/${products.length}` : formatBRL(product.price)}
                </span>
              </div>
              <h2 className="mt-3 line-clamp-2 text-[15px] font-medium leading-snug tracking-[-0.025em] text-white/85">{product.title}</h2>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.08] pt-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">Custo</p>
                  <p className="mt-1 text-[13px] font-bold tabular-nums text-emerald-400 [animation:veloMetricPulse_1.6s_ease-in-out_infinite]">{formatBRL(visibleCost)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">Lucro</p>
                  <p className="mt-1 text-[13px] font-bold tabular-nums text-emerald-400 [animation:veloMetricPulse_1.6s_ease-in-out_infinite]">{formatBRL(visibleProfit)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-white/35">Venda</p>
                  <p className="mt-1 text-[13px] font-bold tabular-nums text-emerald-400 [animation:veloMetricPulse_1.6s_ease-in-out_infinite]">{formatBRL(visibleRevenue)}</p>
                </div>
              </div>

              {products.length > 1 ? (
                <div className="mt-4 flex items-center gap-1.5">
                  {products.map((item, index) => (
                    <span
                      key={item.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${index === activeProductIndex ? "w-6 bg-emerald-400" : "w-1.5 bg-white/18"}`}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        </aside>
      </div>
    </main>
  );
};

export default ProductPreparationPage;
