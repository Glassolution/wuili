import { useMemo, useState } from "react";
import { Brain, Check, ChevronLeft } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";

type FlowState = { product: ExampleProduct; language: string; persona: string };

const angles = [
  { icon: "✨", title: "Transforme sua Rotina", description: "Mostre como o produto torna o dia a dia mais simples, leve e eficiente." },
  { icon: "👋", title: "Diga Adeus ao Problema", description: "Apresente uma solução direta para aquilo que mais incomoda seu cliente." },
  { icon: "💡", title: "Uma Escolha Inteligente", description: "Destaque praticidade, utilidade e o valor que a compra entrega." },
  { icon: "👌", title: "O Detalhe que Faz Diferença", description: "Mostre como uma pequena mudança pode gerar um impacto surpreendente." },
];

const languageCode: Record<string, string> = { Português: "PT", Inglês: "EN", Espanhol: "ES", Francês: "FR", Alemão: "DE" };

const SalesAnglePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const flow = useMemo<FlowState | null>(() => {
    const state = location.state as Partial<FlowState> | null;
    let product = state?.product;
    let language = state?.language;
    let persona = state?.persona;
    try {
      if (!product) { const value = sessionStorage.getItem("velo-example-product"); product = value ? JSON.parse(value) as ExampleProduct : undefined; }
      if (!language) language = sessionStorage.getItem("velo-store-language") || undefined;
      if (!persona) persona = sessionStorage.getItem("velo-customer-persona") || undefined;
    } catch { return null; }
    return product && language && persona ? { product, language, persona } : null;
  }, [location.state]);
  const [selectedAngle, setSelectedAngle] = useState("");

  if (!flow) return <Navigate to="/comecar" replace />;

  const handleContinue = () => {
    if (!selectedAngle) return;
    sessionStorage.setItem("velo-sales-angle", selectedAngle);
    navigate("/onboarding/gerando-imagens", { state: { ...flow, salesAngle: selectedAngle } });
  };

  return (
    <main className="min-h-screen bg-black text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#0d0d0d] px-7 py-7 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/persona" state={flow} className="inline-flex items-center gap-2 text-[12px] font-medium text-white/45 transition hover:text-white"><ChevronLeft size={16} /> Voltar</Link>
            <div className="w-[42%] max-w-[310px]"><div className="h-[4px] overflow-hidden rounded-full bg-white/[0.09]"><div className="h-full w-[90%] rounded-full bg-white/50" /></div></div>
          </header>

          <div className="relative z-10 mx-auto flex w-full max-w-[580px] flex-1 flex-col pt-12 lg:pt-12">
            <div>
              <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.035em] sm:text-[27px]">Como você quer vender?</h1>
              <p className="mt-3 text-[15px] text-white/58">Escolha um ângulo que prenda seus clientes.</p>

              <div className="mt-7 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {angles.map((angle) => {
                  const selected = selectedAngle === angle.title;
                  return (
                    <button key={angle.title} type="button" onClick={() => setSelectedAngle(angle.title)} className={`relative flex min-h-[180px] flex-col rounded-[9px] bg-white/[0.06] p-5 text-left outline-none transition hover:-translate-y-0.5 hover:bg-white/[0.09] focus-visible:ring-2 focus-visible:ring-white/50 ${selected ? "bg-white/[0.12] shadow-[inset_3px_0_0_rgba(243,239,232,0.7)]" : ""}`}>
                      <span className="text-[25px] leading-none" aria-hidden="true">{angle.icon}</span>
                      <span className="mt-5 block text-[14px] font-semibold leading-snug text-white/92">{angle.title}</span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-white/52">{angle.description}</span>
                      {selected ? <Check size={15} className="absolute right-4 top-4 text-white/75" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-white/[0.08]" />
              <button type="button" onClick={() => setSelectedAngle("Deixar a Velo decidir")} className={`flex min-h-[78px] w-full items-center gap-4 rounded-[9px] bg-white/[0.06] px-5 text-left transition hover:bg-white/[0.09] ${selectedAngle === "Deixar a Velo decidir" ? "bg-white/[0.12] shadow-[inset_3px_0_0_rgba(243,239,232,0.7)]" : ""}`}>
                <Brain size={28} className="w-9 shrink-0 text-pink-300" />
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-white/92">Deixar a Velo decidir</span><span className="mt-1 block text-[12px] text-white/52">Vamos escolher o melhor ângulo de marketing para seu produto.</span></span>
                {selectedAngle === "Deixar a Velo decidir" ? <Check size={15} className="text-white/75" /> : null}
              </button>
            </div>

            <div className="mt-auto pb-2 pt-8">
              <button type="button" onClick={handleContinue} disabled={!selectedAngle} className="inline-flex h-[56px] w-full items-center justify-center rounded-[8px] bg-[#f3efe8] text-[16px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-black/80">Continuar</button>
              <p className="mt-3 text-center text-[11px] text-white/35">Experimente grátis</p>
            </div>
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#010101] p-12 lg:flex">
          <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
          <div className="relative z-10 flex min-h-[330px] w-full max-w-[420px] flex-col items-center justify-center rounded-[18px] bg-[#1a1a1a] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <span className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-white/[0.06] text-[42px]">🙋<span className="absolute -bottom-1 -right-1 text-[20px] font-semibold text-white/90">{languageCode[flow.language] || flow.language.slice(0, 2).toUpperCase()}</span></span>
            <p className="mt-9 text-[20px] font-semibold tracking-[-0.025em] text-white/92">{flow.persona}</p>
            <p className="mt-4 text-[15px] text-white/24">Seu ângulo de marketing único</p>
            {selectedAngle ? <p className="mt-6 max-w-[270px] text-[12px] text-white/46">{selectedAngle}</p> : null}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default SalesAnglePage;
