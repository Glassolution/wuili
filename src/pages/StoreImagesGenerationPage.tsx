import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
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

    navigate("/dashboard?tour=loja", { replace: true });
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-white px-7 py-7 text-[#101522] sm:px-10 lg:px-16" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle,rgba(0,0,0,0.24)_1.7px,transparent_2px)] [background-position:2px_2px] [background-size:30px_30px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.62),rgba(255,255,255,0.22)_38%,rgba(255,255,255,0.72)_86%)]" />

      <header className="relative z-10 flex items-center justify-between">
        <Link to="/onboarding/angulo-vendas" state={flow} className="inline-flex items-center gap-2 text-[12px] font-medium text-[#111827]/45 transition hover:text-[#111827]"><ChevronLeft size={17} /> Voltar</Link>
        <div className="w-[28%] max-w-[310px]"><div className="h-[4px] overflow-hidden rounded-full bg-[#e4e7ef]"><div className="h-full w-[96%] rounded-full bg-black" /></div></div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-[900px] flex-1 flex-col items-center pt-[6vh] text-center">
        <Loader2 size={22} className="mb-4 animate-spin text-[#697083]" />
        <h1 className="text-[32px] font-normal tracking-[-0.045em] text-[#101522]">Gerando...</h1>
        <p className="mt-3 text-[14px] text-[#4b5567]">A Velo está criando imagens para a sua loja.</p>
        <p className="mt-2 max-w-[620px] truncate text-[11px] text-[#8b94a6]">{flow.product.title} · {flow.persona} · {flow.salesAngle}</p>

        <div className="mt-9 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="relative aspect-[0.92] animate-pulse overflow-hidden rounded-[12px] border border-[#dfe4ef] bg-white shadow-[0_18px_45px_rgba(15,23,42,0.08)]" style={{ animationDelay: `${index * 140}ms` }}>
              <div className="absolute inset-0 bg-gradient-to-br from-[#f8fafc] via-white to-[#eef1f6]" />
              <div className="absolute inset-x-4 bottom-4 space-y-2"><div className="h-2 w-3/4 rounded-full bg-[#d8dde8]" /><div className="h-2 w-1/2 rounded-full bg-[#e9edf4]" /></div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex min-h-5 items-center gap-2 text-[12px] text-[#687086]" aria-live="polite">
          <Sparkles size={14} className="animate-pulse text-black" />
          <span key={messageIndex} className="animate-in fade-in duration-500">{generationMessages[messageIndex]}</span>
        </div>

        <div className="mt-4 grid w-full max-w-[570px] grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-[8px] border border-[#dfe4ef] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.06)]" style={{ animationDelay: `${index * 110}ms` }} />)}
        </div>

        <div className="mt-auto w-full max-w-[580px] pb-2 pt-12">
          <button type="button" disabled={!generationReady} onClick={handleGenerateStore} className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-[10px] bg-black text-[16px] font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-[#202020] disabled:cursor-wait disabled:bg-[#d8dde8] disabled:text-[#8b94a6] disabled:shadow-none">{generationReady ? "Gerar minha loja" : <><Loader2 size={17} className="animate-spin" /> Gerando imagens da loja</>}</button>
          <p className="mt-3 text-[11px] text-[#8b94a6]">Experimente grátis</p>
        </div>
      </section>
    </main>
  );
};

export default StoreImagesGenerationPage;
