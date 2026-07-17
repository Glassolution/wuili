import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Check, Loader2 } from "lucide-react";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { useAuth } from "@/contexts/AuthContext";
import { markStoreFlowCompleted } from "@/lib/storeFlowCompletion";

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };

// Etapas do loading. Cada uma acende no checklist e move o anel de progresso,
// dando a sensação de trabalho da IA sem prender o usuário numa lista longa.
const buildSteps = [
  "Importando dados do produto",
  "Pesquisando o mercado",
  "Escrevendo o conteúdo de vendas",
  "Criando o tema da loja",
  "Finalizando sua loja",
];

// Loading total ~6s. Precisa bater com a soma das etapas abaixo.
const STEP_DURATION_MS = 1200;
const LOADING_DURATION_MS = buildSteps.length * STEP_DURATION_MS;

// Pequena pausa em 100% para o "Completo" aparecer antes de abrir o editor.
const COMPLETE_HOLD_MS = 500;

const StoreBuildProgressPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const flow = useMemo<FlowState | null>(() => {
    const state = location.state as Partial<FlowState> | null;
    let product = state?.product; let language = state?.language; let persona = state?.persona; let salesAngle = state?.salesAngle;
    try {
      if (!product) { const value = sessionStorage.getItem("velo-example-product"); product = value ? JSON.parse(value) as ExampleProduct : undefined; }
      language ||= sessionStorage.getItem("velo-store-language") || undefined;
      persona ||= sessionStorage.getItem("velo-customer-persona") || undefined;
      salesAngle ||= sessionStorage.getItem("velo-sales-angle") || undefined;
    } catch { return null; }
    return product && language && persona && salesAngle ? { product, language, persona, salesAngle } : null;
  }, [location.state]);

  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const elapsed = now - startedAt;
      if (elapsed >= LOADING_DURATION_MS) {
        setProgress(100);
        setReady(true);
        return;
      }
      setProgress((elapsed / LOADING_DURATION_MS) * 100);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  // Ao concluir (100%), marca o fluxo como finalizado e vai direto para o editor
  // com a loja já pronta — sem passar por uma tela intermediária de revelação.
  useEffect(() => {
    if (!ready || !flow) return;
    if (user?.id) markStoreFlowCompleted(user.id, flow);
    const onboardingChoice = sessionStorage.getItem("velo-onboarding-choice");
    const timer = window.setTimeout(() => {
      if (onboardingChoice === "sales-page") {
        navigate("/minha-loja/editor", { replace: true, state: flow });
        return;
      }
      try {
        sessionStorage.setItem("velo-dashboard-store-tour", "1");
      } catch {
        // O redirecionamento não deve falhar por indisponibilidade do storage.
      }
      navigate("/dashboard?tour=loja", { replace: true });
    }, COMPLETE_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [ready, flow, user?.id, navigate]);

  if (!flow) return <Navigate to="/comecar" replace />;

  const displayProgress = Math.round(progress);
  const completedSteps = Math.min(buildSteps.length, Math.floor(progress / (100 / buildSteps.length)));
  const activeStep = Math.min(buildSteps.length - 1, completedSteps);

  // Anel de progresso: r=104, circunferência ≈ 653,45.
  const ringRadius = 104;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progress / 100);

  return (
    <main className="velo-flow relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <style>
        {`
          @keyframes veloSpin { to { transform: rotate(360deg); } }
          @keyframes veloRingGlow { 0%, 100% { opacity: .55; transform: translate(-50%, -50%) scale(.94); } 50% { opacity: .9; transform: translate(-50%, -50%) scale(1.06); } }
          @media (prefers-reduced-motion: reduce) { .velo-spin, .velo-ring-glow { animation: none !important; } }
        `}
      </style>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(circle, rgb(255,255,255) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <section className="relative z-10 flex w-full max-w-[420px] flex-col items-center text-center">
        <div className="relative flex h-[240px] w-[240px] items-center justify-center">
          <div className="velo-ring-glow pointer-events-none absolute left-1/2 top-1/2 h-[200px] w-[200px] rounded-full bg-[#a855f7]/45 blur-[70px] [animation:veloRingGlow_3.4s_ease-in-out_infinite]" />
          <svg viewBox="0 0 240 240" className="absolute inset-0 h-full w-full -rotate-90">
            <circle cx="120" cy="120" r={ringRadius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <circle
              cx="120"
              cy="120"
              r={ringRadius}
              fill="none"
              stroke="#ffffff"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              style={{ transition: "stroke-dashoffset 120ms linear" }}
            />
          </svg>
          <div className="relative flex h-[196px] w-[196px] flex-col items-center justify-center rounded-full bg-black">
            <span className="text-[46px] font-bold leading-none tabular-nums text-white">{displayProgress}</span>
            <span className="mt-2 text-[13px] font-medium text-white/70">Completo</span>
          </div>
        </div>

        <h1 className="mt-10 text-[28px] font-semibold tracking-[-0.02em] text-white">Preparando sua loja</h1>
        <p className="mt-2 text-[16px] font-medium text-[var(--vf-text-3)]">{buildSteps[activeStep]}</p>

        <div className="mt-10 w-full max-w-[380px]">
          {buildSteps.map((step, index) => {
            const done = index < completedSteps;
            const active = index === completedSteps;
            return (
              <div key={step} className="flex items-center gap-3 border-b border-white/10 py-3">
                <span className={`flex-1 text-left text-[15px] font-medium transition ${done || active ? "text-white" : "text-white/30"}`}>
                  {step}...
                </span>
                <span className="shrink-0">
                  {done ? (
                    <Check size={16} strokeWidth={2.6} className="text-white" />
                  ) : active ? (
                    <Loader2 size={15} className="velo-spin text-white/70 [animation:veloSpin_.9s_linear_infinite]" />
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export default StoreBuildProgressPage;
