import { useEffect, useMemo, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { useAuth } from "@/contexts/AuthContext";
import { markStoreFlowCompleted } from "@/lib/storeFlowCompletion";

type FlowState = { product: ExampleProduct; language: string; persona: string; salesAngle: string };
type OnboardingChoice = "store" | "sales-page" | "example";

const steps = [
  "Importando dados do produto...",
  "A IA está pesquisando o mercado...",
  "A IA está escrevendo o conteúdo de vendas...",
  "A IA está criando o tema da loja...",
  "Finalizando sua loja...",
];

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
  const [progress, setProgress] = useState(6);

  useEffect(() => {
    const startedAt = Date.now();
    const duration = 12000;
    const timer = window.setInterval(() => {
      const ratio = Math.min(1, (Date.now() - startedAt) / duration);
      setProgress(Math.round(6 + ratio * 89));
      if (ratio === 1) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  if (!flow) return <Navigate to="/comecar" replace />;

  const ready = progress >= 95;

  const finishOnboarding = () => {
    const onboardingChoice = sessionStorage.getItem("velo-onboarding-choice") as OnboardingChoice | null;
    if (onboardingChoice === "sales-page") {
      navigate("/minha-loja/editor", { replace: true, state: flow });
      return;
    }
    try { sessionStorage.setItem("velo-dashboard-store-tour", "1"); } catch {}
    navigate("/dashboard?tour=loja", { replace: true });
  };

  useEffect(() => {
    if (ready && flow && user?.id) markStoreFlowCompleted(user.id, flow);
  }, [ready, flow, user?.id]);

  const completedCount = ready ? 5 : Math.min(4, Math.floor(progress / 20));
  const activeIndex = Math.min(4, completedCount);
  const circumference = 2 * Math.PI * 78;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020202] px-6 py-12 text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.15)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
      <section className="relative z-10 flex w-full max-w-[380px] flex-col items-center text-center">
        <div className="relative flex h-[180px] w-[180px] items-center justify-center rounded-full shadow-[0_0_55px_rgba(192,38,211,0.32)]">
          <svg viewBox="0 0 180 180" className="absolute inset-0 -rotate-90">
            <circle cx="90" cy="90" r="78" fill="#000" stroke="rgba(255,255,255,0.18)" strokeWidth="5" />
            <circle cx="90" cy="90" r="78" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress / 100)} className="transition-[stroke-dashoffset] duration-200" />
          </svg>
          <div className="relative"><strong className="block text-[46px] font-bold leading-none tracking-[-0.06em]">{progress}</strong><span className="mt-2 block text-[13px] font-semibold">Completo</span></div>
        </div>

        <h1 className="mt-14 text-[30px] font-semibold tracking-[-0.04em]">{ready ? "A sua loja está pronta!" : "Preparando sua loja IA"}</h1>
        <p className={`mt-3 text-[16px] font-medium ${ready ? "text-white/45" : "text-white/55"}`}>{ready ? "Tudo foi preparado para você." : steps[activeIndex]}</p>
        {ready ? <button type="button" onClick={finishOnboarding} className="mt-10 h-12 w-full rounded-[7px] bg-[#f3efe8] text-[14px] font-semibold text-black transition hover:bg-white">{sessionStorage.getItem("velo-onboarding-choice") === "sales-page" ? "Editar minha página" : "Ver minha loja"}</button> : null}

        {!ready ? (
          <div className="mt-12 w-full space-y-4 text-left">
            {steps.map((step, index) => {
              const done = index < completedCount;
              const active = index === activeIndex;
              const stepProgress = done ? 100 : active ? Math.min(100, (progress % 20) * 5) : 0;
              return (
                <div key={step} className={done || active ? "opacity-100" : "opacity-25"}>
                  <div className="flex items-center justify-between gap-3 text-[12px] font-medium"><span className="truncate">{step}</span>{done ? <Check size={15} /> : active ? <Loader2 size={14} className="animate-spin" /> : null}</div>
                  <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${stepProgress}%` }} /></div>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </main>
  );
};

export default StoreBuildProgressPage;
