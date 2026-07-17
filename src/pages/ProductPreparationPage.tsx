import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, PackageOpen } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { screenEnter } from "@/components/onboarding/flowMotion";

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

// Equalizer de progresso: barras de altura pseudo-aleatória (determinística por
// índice, então não "pulam" a cada render) preenchidas da esquerda para a
// direita conforme o progresso avança, com gradiente azul → verde → laranja.
const BAR_COUNT = 40;
const BAR_HEIGHTS = Array.from({ length: BAR_COUNT }, (_, i) => {
  const seed = Math.sin(i * 127.1) * 43758.5453;
  const frac = seed - Math.floor(seed);
  return 34 + frac * 66; // 34%..100%
});

const litColor = (index: number, litCount: number) => {
  const t = litCount <= 1 ? 0 : index / (litCount - 1);
  const hue = 214 - t * (214 - 25); // azul (214°) → laranja (25°)
  return `hsl(${hue}, 85%, 55%)`;
};

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
  const activeStep = Math.min(steps.length - 1, completedSteps);
  const isReady = progress >= 100;
  const displayProgress = Math.round(progress);
  const litCount = Math.round((progress / 100) * BAR_COUNT);

  return (
    <main className="velo-flow min-h-screen">
      <style>
        {`
          @keyframes veloEqPulse {
            0%, 100% { transform: scaleY(1); }
            50% { transform: scaleY(0.62); }
          }
          @keyframes veloAsideGlow {
            0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(0.95); }
            50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.08); }
          }
          @keyframes veloProductImageSlide {
            0% { opacity: 0; transform: translateX(28px) scale(.94); filter: blur(8px); }
            100% { opacity: 1; transform: translateX(0) scale(1); filter: blur(0); }
          }
          @media (prefers-reduced-motion: reduce) {
            .velo-eq-bar, .velo-aside-glow { animation: none !important; }
          }
        `}
      </style>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 py-7 sm:px-9 lg:px-12">
          <Link
            to="/onboarding/escolher-produto"
            className="vf-btn-ghost absolute left-6 top-7 inline-flex items-center sm:left-9 lg:left-12"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </Link>
          <div
            className="absolute left-1/2 top-7 h-[5px] w-[210px] -translate-x-1/2 overflow-hidden rounded-[1px] bg-white/10"
            aria-label="Progresso da criação"
          >
            <div className="h-full bg-white transition-all duration-300" style={{ width: "60%" }} />
          </div>

          <motion.div {...screenEnter} className="mt-[76px] w-full max-w-[580px]">
            <div className="flex items-end justify-between gap-6">
              <h1 className="vf-headline text-[24px] font-medium leading-[30px] tracking-[-0.6px]">
                Preparando {hasMultipleProducts ? "seus produtos" : "seu produto"}
              </h1>
              <span className="shrink-0 text-[30px] font-medium tabular-nums leading-none text-[var(--vf-text-1)]">
                {displayProgress}%
              </span>
            </div>

            {/* Equalizer de progresso */}
            <div
              className="mt-6 flex h-24 items-end gap-[3px] rounded-[14px] bg-black p-4 sm:gap-1.5"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={displayProgress}
            >
              {BAR_HEIGHTS.map((height, index) => {
                const lit = index < litCount;
                return (
                  <span
                    key={index}
                    className={lit ? "velo-eq-bar flex-1 rounded-[4px]" : "flex-1 rounded-[4px]"}
                    style={{
                      height: `${height}%`,
                      background: lit ? litColor(index, litCount) : "rgba(255,255,255,0.1)",
                      transformOrigin: "bottom",
                      transition: "background 220ms ease",
                      ...(lit && !isReady
                        ? { animation: `veloEqPulse ${900 + (index % 7) * 90}ms ease-in-out ${index * 35}ms infinite` }
                        : {}),
                    }}
                  />
                );
              })}
            </div>

            {/* Checklist */}
            <div className="mt-6 space-y-2">
              {steps.map((step, index) => {
                const done = index < completedSteps;
                const active = index === completedSteps && !isReady;
                return (
                  <div
                    key={step}
                    className="flex min-h-[58px] items-center gap-3 rounded-[7px] bg-[var(--vf-panel)] px-4"
                  >
                    <span
                      className={`h-3 w-3 shrink-0 rounded-full transition-colors duration-300 ${
                        done || active ? "bg-[#22c55e]" : "bg-[var(--vf-text-3)]/40"
                      }`}
                    />
                    <span
                      className={`flex-1 text-[16px] font-medium transition ${
                        done
                          ? "text-[var(--vf-text-2)] line-through"
                          : active
                            ? "text-[var(--vf-text-1)]"
                            : "text-[var(--vf-text-3)]"
                      }`}
                    >
                      {step}
                    </span>
                    <span className="shrink-0">
                      {done ? (
                        <Check size={18} strokeWidth={2.6} className="text-[#22c55e]" />
                      ) : active ? (
                        <Loader2 size={16} className="vf-spin text-[var(--vf-text-2)]" />
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => navigate("/onboarding/idioma", { state: { product: primaryProduct, products } })}
              disabled={!isReady}
              className="vf-btn mt-6 inline-flex h-12 w-full items-center justify-center text-[14px]"
            >
              {isReady ? "Continuar" : "Preparando..."}
            </button>
          </motion.div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[var(--vf-border)] bg-[var(--vf-panel-side)] p-12 lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: "radial-gradient(circle, rgb(255,255,255) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          {/* Brilho azul pulsante atrás do card */}
          <div className="velo-aside-glow pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#2563EB]/25 blur-[90px] [animation:veloAsideGlow_4s_ease-in-out_infinite]" />

          <div className="relative z-10 flex w-full max-w-[380px] flex-col items-center">
            <div className="w-full rounded-[20px] border border-[var(--vf-border)] bg-[var(--vf-nested)] p-3">
              <div className="relative aspect-square overflow-hidden rounded-[10px] bg-[#333]">
                {product.imageUrl ? (
                  <img
                    key={product.id}
                    src={product.imageUrl}
                    alt={product.title}
                    className="h-full w-full object-cover [animation:veloProductImageSlide_600ms_cubic-bezier(.16,1,.3,1)]"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <PackageOpen size={48} className="text-white/20" />
                  </span>
                )}
              </div>
            </div>

            <p className="mt-6 text-[16px] font-medium tracking-[0.02em] text-[var(--vf-text-2)]">
              {isReady ? "Análise concluída" : `${steps[activeStep]}...`}
            </p>

            {hasMultipleProducts ? (
              <div className="mt-4 flex items-center gap-1.5">
                {products.map((item, index) => (
                  <span
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === activeProductIndex ? "w-6 bg-white" : "w-1.5 bg-[var(--vf-border)]"
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default ProductPreparationPage;
