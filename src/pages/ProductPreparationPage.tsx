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

// Cada etapa tem sua própria duração e acelera/desacelera dentro de si mesma.
// A barra desacelera junto da virada de etapa, então a pausa coincide com o
// check aparecendo — parece que a IA concluiu algo, não que travou. Uma rampa
// linear entrega que é só um timer.
const STEP_DURATIONS_MS = [2600, 2200, 3000, 2100, 2300];
const TOTAL_DURATION_MS = STEP_DURATIONS_MS.reduce((sum, value) => sum + value, 0);

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

const getProgressAt = (elapsed: number) => {
  let stepStart = 0;
  for (let index = 0; index < STEP_DURATIONS_MS.length; index += 1) {
    const duration = STEP_DURATIONS_MS[index];
    if (elapsed < stepStart + duration) {
      const stepFraction = easeInOutSine((elapsed - stepStart) / duration);
      return ((index + stepFraction) / STEP_DURATIONS_MS.length) * 100;
    }
    stepStart += duration;
  }
  return 100;
};

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
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed >= TOTAL_DURATION_MS) {
        setProgress(100);
        return;
      }
      setProgress(getProgressAt(elapsed));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
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
  const completedSteps = Math.min(steps.length, Math.floor(progress / (100 / steps.length)));
  const isReady = progress >= 100;
  const displayProgress = Math.round(progress);
  const progressFactor = progress / 100;
  const totalCost = products.reduce((sum, item) => sum + item.price, 0);
  const visibleCost = totalCost * progressFactor;
  const visibleProfit = totalCost * 0.72 * progressFactor;
  const visibleRevenue = totalCost * 1.72 * progressFactor;

  return (
    <main className="min-h-screen bg-[#fbfbfc] text-[#101522]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
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
            0%, 100% { opacity: .78; }
            50% { opacity: 1; }
          }

          /* Brilho que percorre a parte preenchida da barra: sinaliza trabalho
             em andamento mesmo quando o progresso desacelera. */
          @keyframes veloProgressShimmer {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(110%); }
          }

          @keyframes veloStepBreathe {
            0%, 100% { background-color: rgba(17,24,39,0.028); }
            50% { background-color: rgba(17,24,39,0.062); }
          }
        `}
      </style>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden px-7 py-7 sm:px-10 lg:px-16 lg:py-10 xl:px-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_45%,rgba(0,0,0,0.035),transparent_38%)]" />
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/escolher-produto" className="inline-flex items-center gap-2 text-[12px] font-medium text-[#111827]/55 transition hover:text-[#111827]">
              <ChevronLeft size={16} /> Voltar
            </Link>
            <div className="w-[42%] max-w-[310px]">
              <div className="h-[4px] overflow-hidden rounded-full bg-[#e5e8ef]">
                <div className="h-full rounded-full bg-black/70" style={{ width: `${18 + progress * 0.32}%` }} />
              </div>
            </div>
          </header>

          <div className="relative z-10 my-auto w-full max-w-[620px] py-16">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#697083]">
              {hasMultipleProducts ? "Produtos de exemplo" : "Produto de exemplo"}
            </p>
            <div className="mt-4 flex items-end justify-between gap-6">
              <h1 className="text-[42px] font-normal leading-[1.04] tracking-[-0.055em] text-[#121827] sm:text-[54px]">
                Preparando {hasMultipleProducts ? "seus produtos" : "seu produto"}
              </h1>
              <span className="shrink-0 text-[28px] font-light tabular-nums tracking-[-0.04em] text-[#111827]/60">{displayProgress}%</span>
            </div>
            <div className="relative mt-8">
              <Progress value={progress} aria-label={hasMultipleProducts ? "Preparando seus produtos" : "Preparando seu produto"} className="h-[6px] bg-[#e7ebf2] [&>div]:bg-black [&>div]:duration-0" />
              {!isReady ? (
                <div className="pointer-events-none absolute inset-y-0 left-0 overflow-hidden rounded-full" style={{ width: `${progress}%` }}>
                  <div className="h-full w-full bg-gradient-to-r from-transparent via-white/70 to-transparent [animation:veloProgressShimmer_1.8s_ease-in-out_infinite]" />
                </div>
              ) : null}
            </div>

            <div className="mt-8 space-y-2">
              {steps.map((step, index) => {
                const done = index < completedSteps;
                const active = index === completedSteps && !isReady;
                return (
                  <div key={step} className={`flex min-h-[52px] items-center gap-3 rounded-[6px] px-4 transition duration-500 ${done ? "bg-[#f1f3f7]" : active ? "[animation:veloStepBreathe_2.2s_ease-in-out_infinite]" : "bg-transparent"}`}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${done ? "bg-black text-white" : active ? "bg-[#e4e8ef] text-[#697083]" : "bg-[#eef0f5] text-transparent"}`}>
                      {done ? <Check size={14} strokeWidth={2.4} /> : active ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    </span>
                    <span className={`text-[13px] transition ${done ? "text-[#2b3140]" : active ? "text-[#4a5162]" : "text-[#a8aebc]"}`}>{step}</span>
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={() => navigate("/onboarding/idioma", { state: { product: primaryProduct, products } })} disabled={!isReady} className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-[5px] bg-black text-[13px] font-semibold text-white transition hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-[#dfe3ea] disabled:text-[#9aa2b5]">
              {isReady ? "Continuar" : "Preparando..."}
            </button>
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[#edf0f5] bg-[#f5f6f9] p-12 lg:flex">
          <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(15,23,42,0.10)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.10),transparent_38%,rgba(255,255,255,0.55)_78%)]" />
          <article className="relative z-10 w-full max-w-[360px] overflow-hidden rounded-[12px] border border-[#e4e8ef] bg-white p-3 shadow-[0_30px_90px_rgba(15,23,42,0.16)] [animation:veloProductCardWork_4.8s_ease-in-out_infinite]">
            <div className="pointer-events-none absolute inset-x-5 top-5 h-24 rounded-full bg-emerald-400/12 blur-3xl" />
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[7px] bg-[#f4f5f7]">
              <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1/2 bg-gradient-to-b from-transparent via-emerald-500/20 to-transparent [animation:veloScanningLine_2.4s_ease-in-out_infinite]" />
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
                <span className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] ${isReady ? "text-emerald-600" : "text-[#697083]"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isReady ? "bg-emerald-500" : "animate-pulse bg-[#9aa2b5]"}`} />
                  {isReady ? "Pronto" : "Analisando..."}
                </span>
                <span className="text-[13px] font-medium text-[#4a5162]">
                  {products.length > 1 ? `${activeProductIndex + 1}/${products.length}` : formatBRL(product.price)}
                </span>
              </div>
              <h2 className="mt-3 line-clamp-2 text-[15px] font-medium leading-snug tracking-[-0.025em] text-[#121827]">{product.title}</h2>

              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#e7ebf2] pt-4">
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7c8497]">Custo</p>
                  <p className="mt-1 text-[13px] font-bold tabular-nums text-emerald-600 [animation:veloMetricPulse_1.6s_ease-in-out_infinite]">{formatBRL(visibleCost)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7c8497]">Lucro</p>
                  <p className="mt-1 text-[13px] font-bold tabular-nums text-emerald-600 [animation:veloMetricPulse_1.6s_ease-in-out_infinite]">{formatBRL(visibleProfit)}</p>
                </div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#7c8497]">Venda</p>
                  <p className="mt-1 text-[13px] font-bold tabular-nums text-emerald-600 [animation:veloMetricPulse_1.6s_ease-in-out_infinite]">{formatBRL(visibleRevenue)}</p>
                </div>
              </div>

              {products.length > 1 ? (
                <div className="mt-4 flex items-center gap-1.5">
                  {products.map((item, index) => (
                    <span
                      key={item.id}
                      className={`h-1.5 rounded-full transition-all duration-300 ${index === activeProductIndex ? "w-6 bg-emerald-500" : "w-1.5 bg-[#d8dde8]"}`}
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
