import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { useAuth } from "@/contexts/AuthContext";
import { markStoreFlowCompleted } from "@/lib/storeFlowCompletion";
import {
  markStoreOnboardingCompleted,
  readUserStores,
  saveUserStores,
  type VeloStore,
} from "@/components/dashboard/FirstStoreOnboarding";

type FlowState = {
  product: ExampleProduct;
  language: string;
  persona: string;
  salesAngle: string;
};

const generationMessages = [
  "Entendendo o perfil dos seus clientes...",
  "Criando a direção visual da sua loja...",
  "Compondo imagens para o seu produto...",
  "Procurando mais variações...",
];

const StoreImagesGenerationPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const flow = useMemo<FlowState | null>(() => {
    const state = location.state as Partial<FlowState> | null;
    let product = state?.product;
    let language = state?.language;
    let persona = state?.persona;
    let salesAngle = state?.salesAngle;
    try {
      if (!product) { const value = sessionStorage.getItem("velo-example-product"); product = value ? JSON.parse(value) as ExampleProduct : undefined; }
      if (!language) language = sessionStorage.getItem("velo-store-language") || undefined;
      if (!persona) persona = sessionStorage.getItem("velo-customer-persona") || undefined;
      if (!salesAngle) salesAngle = sessionStorage.getItem("velo-sales-angle") || undefined;
    } catch { return null; }
    return product && language && persona && salesAngle ? { product, language, persona, salesAngle } : null;
  }, [location.state]);
  const [messageIndex, setMessageIndex] = useState(0);
  const [generationReady, setGenerationReady] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setMessageIndex((current) => (current + 1) % generationMessages.length);
    }, 2200);
    const readyTimer = window.setTimeout(() => setGenerationReady(true), 8000);
    return () => { window.clearInterval(timer); window.clearTimeout(readyTimer); };
  }, []);

  if (!flow) return <Navigate to="/comecar" replace />;

  const handleGenerateStore = () => {
    if (user?.id) {
      markStoreFlowCompleted(user.id, flow);
      markStoreOnboardingCompleted(user.id);
    }

    try {
      const stores = readUserStores();
      if (stores.length === 0) {
        const ownerName = String(user?.user_metadata?.full_name || user?.email || "Cliente Velo").trim();
        const newStore: VeloStore = {
          id: `generated-${Date.now()}`,
          name: sessionStorage.getItem("velo-store-name") || "Minha Loja",
          ownerName,
          cpf: "",
          phone: "",
          source: "Onboarding Velo",
          businessType: "Loja online",
          goal: "Vender produtos selecionados",
          productLimit: 30,
          publishedProducts: 0,
          createdAt: new Date().toISOString(),
          isActive: true,
        };
        saveUserStores([newStore]);
      }
      sessionStorage.setItem("velo-dashboard-store-tour", "1");
    } catch {
      // A navegação não deve falhar por limitação de storage local.
    }

    navigate("/onboarding/preparando-loja", { state: flow });
  };

  return (
    <main className="velo-flow relative flex min-h-screen flex-col overflow-hidden px-6 py-7 sm:px-9 lg:px-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(circle, rgb(255,255,255) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <header className="relative z-10 flex items-center">
        <Link to="/onboarding/angulo-vendas" state={flow} className="vf-btn-ghost inline-flex items-center" aria-label="Voltar">
          <ArrowLeft size={20} />
        </Link>
        <div className="absolute left-1/2 h-[5px] w-[210px] -translate-x-1/2 overflow-hidden rounded-[1px] bg-white/10" aria-label="Progresso da criação">
          <div className="h-full bg-white transition-all duration-300" style={{ width: "96%" }} />
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-[900px] flex-1 flex-col items-center pt-[6vh] text-center">
        <Loader2 size={22} className="vf-spin mb-4 text-[var(--vf-text-3)]" />
        <h1 className="vf-headline text-[24px] font-medium leading-[30px] tracking-[-0.6px]">Gerando...</h1>
        <p className="vf-subhead mt-2 text-[18px] font-normal leading-[28px]">A Velo está criando imagens para a sua loja.</p>
        <p className="mt-2 max-w-[620px] truncate text-[13px] text-[var(--vf-text-3)]">{flow.product.title} · {flow.persona} · {flow.salesAngle}</p>

        <div className="mt-9 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="vf-shimmer relative aspect-[0.92] overflow-hidden rounded-[12px] border border-[var(--vf-border)]" style={{ animationDelay: `${index * 140}ms` }}>
              <div className="absolute inset-x-4 bottom-4 space-y-2"><div className="h-2 w-3/4 rounded-full bg-white/10" /><div className="h-2 w-1/2 rounded-full bg-white/[0.06]" /></div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex min-h-5 items-center gap-2 text-[13px] text-[var(--vf-text-2)]" aria-live="polite">
          <Sparkles size={14} className="animate-pulse text-[var(--vf-text-1)]" />
          <span key={messageIndex} className="animate-in fade-in duration-500">{generationMessages[messageIndex]}</span>
        </div>

        <div className="mt-4 grid w-full max-w-[570px] grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="vf-shimmer aspect-square rounded-[8px] border border-[var(--vf-border)]" style={{ animationDelay: `${index * 110}ms` }} />)}
        </div>

        <div className="mt-auto w-full max-w-[580px] pb-2 pt-12">
          <button type="button" disabled={!generationReady} onClick={handleGenerateStore} className="vf-btn inline-flex h-[56px] w-full items-center justify-center gap-2 text-[16px]">{generationReady ? "Gerar minha loja" : <><Loader2 size={17} className="vf-spin" /> Gerando imagens da loja</>}</button>
          <p className="mt-3 text-[13px] text-[var(--vf-text-3)]">Experimente grátis</p>
        </div>
      </section>
    </main>
  );
};

export default StoreImagesGenerationPage;
