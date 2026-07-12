import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Sparkles } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";

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

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#020202] px-7 py-7 text-white sm:px-10 lg:px-16" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.15)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.025),transparent_35%,rgba(0,0,0,0.32)_85%)]" />

      <header className="relative z-10 flex items-center justify-between">
        <Link to="/onboarding/angulo-vendas" state={flow} className="inline-flex items-center gap-2 text-[12px] font-medium text-white/45 transition hover:text-white"><ChevronLeft size={17} /> Voltar</Link>
        <div className="w-[28%] max-w-[310px]"><div className="h-[4px] overflow-hidden rounded-full bg-white/[0.09]"><div className="h-full w-[96%] rounded-full bg-white/80" /></div></div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-[900px] flex-1 flex-col items-center pt-[6vh] text-center">
        <Loader2 size={22} className="mb-4 animate-spin text-white/45" />
        <h1 className="text-[32px] font-normal tracking-[-0.045em] text-white/82">Gerando...</h1>
        <p className="mt-3 text-[14px] text-white/62">A Velo está criando imagens para a sua loja.</p>
        <p className="mt-2 max-w-[620px] truncate text-[11px] text-white/25">{flow.product.title} · {flow.persona} · {flow.salesAngle}</p>

        <div className="mt-9 grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="relative aspect-[0.92] animate-pulse overflow-hidden rounded-[10px] bg-white/[0.075] shadow-[0_18px_45px_rgba(0,0,0,0.35)]" style={{ animationDelay: `${index * 140}ms` }}>
              <div className="absolute inset-0 bg-gradient-to-br from-white/[0.025] via-transparent to-black/10" />
              <div className="absolute inset-x-4 bottom-4 space-y-2 opacity-40"><div className="h-2 w-3/4 rounded-full bg-white/10" /><div className="h-2 w-1/2 rounded-full bg-white/[0.07]" /></div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex min-h-5 items-center gap-2 text-[12px] text-white/52" aria-live="polite">
          <Sparkles size={14} className="animate-pulse text-[#a78bfa]" />
          <span key={messageIndex} className="animate-in fade-in duration-500">{generationMessages[messageIndex]}</span>
        </div>

        <div className="mt-4 grid w-full max-w-[570px] grid-cols-4 gap-2 sm:grid-cols-8">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-[7px] bg-white/[0.065]" style={{ animationDelay: `${index * 110}ms` }} />)}
        </div>

        <div className="mt-auto w-full max-w-[580px] pb-2 pt-12">
          <button type="button" disabled={!generationReady} onClick={() => navigate("/onboarding/preparando-loja", { state: flow })} className="inline-flex h-[56px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#f3efe8] text-[16px] font-semibold text-black transition hover:bg-white disabled:cursor-wait disabled:bg-[#f3efe8]/70 disabled:text-black/70">{generationReady ? "Gerar minha loja" : <><Loader2 size={17} className="animate-spin" /> Gerando imagens da loja</>}</button>
          <p className="mt-3 text-[11px] text-white/35">Experimente grátis</p>
        </div>
      </section>
    </main>
  );
};

export default StoreImagesGenerationPage;
