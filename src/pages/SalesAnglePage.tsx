import { useMemo, useState } from "react";
import { Brain, Check, ChevronLeft } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { saveProjectDraft } from "@/lib/userProjects";
import { readOnboardingProjectId } from "@/lib/onboardingProject";

type FlowState = { product: ExampleProduct; language: string; persona: string; projectId?: string | null };

const angles = [
  { icon: "✨", title: "Transforme sua Rotina", description: "Mostre como o produto torna o dia a dia mais simples, leve e eficiente." },
  { icon: "👋", title: "Diga Adeus ao Problema", description: "Apresente uma solução direta para aquilo que mais incomoda seu cliente." },
  { icon: "💡", title: "Uma Escolha Inteligente", description: "Destaque praticidade, utilidade e o valor que a compra entrega." },
  { icon: "👌", title: "O Detalhe que Faz Diferença", description: "Mostre como uma pequena mudança pode gerar um impacto surpreendente." },
];

const languageCode: Record<string, string> = {
  "Português (Brasil)": "PT",
  "Português (Portugal)": "PT",
  Português: "PT",
  Inglês: "EN",
  Espanhol: "ES",
  Francês: "FR",
  Alemão: "DE",
};

const SalesAnglePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const flow = useMemo<FlowState | null>(() => {
    const state = location.state as Partial<FlowState> | null;
    let product = state?.product;
    let language = state?.language;
    let persona = state?.persona;
    const projectId = state?.projectId ?? readOnboardingProjectId() ?? null;
    try {
      if (!product) { const value = sessionStorage.getItem("velo-example-product"); product = value ? JSON.parse(value) as ExampleProduct : undefined; }
      if (!language) language = sessionStorage.getItem("velo-store-language") || undefined;
      if (!persona) persona = sessionStorage.getItem("velo-customer-persona") || undefined;
    } catch { return null; }
    return product && language && persona ? { product, language, persona, projectId } : null;
  }, [location.state]);
  const [selectedAngle, setSelectedAngle] = useState("");

  if (!flow) return <Navigate to="/comecar" replace />;

  const handleContinue = () => {
    if (!selectedAngle) return;
    sessionStorage.setItem("velo-sales-angle", selectedAngle);
    if (flow.projectId) {
      void saveProjectDraft(flow.projectId, { salesAngle: selectedAngle }).catch((err) => {
        console.error("saveProjectDraft (salesAngle) failed:", err);
      });
    }
    navigate("/onboarding/gerando-imagens", { state: { ...flow, salesAngle: selectedAngle } });
  };

  return (
    <main className="min-h-screen bg-white text-[#101522]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden px-7 py-7 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_45%,rgba(15,23,42,0.04),transparent_38%)]" />
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/persona" state={flow} className="inline-flex items-center gap-2 text-[12px] font-medium text-[#111827]/45 transition hover:text-[#111827]"><ChevronLeft size={16} /> Voltar</Link>
            <div className="w-[42%] max-w-[310px]"><div className="h-[4px] overflow-hidden rounded-full bg-[#e4e7ef]"><div className="h-full w-[90%] rounded-full bg-black" /></div></div>
          </header>

          <div className="relative z-10 mx-auto flex w-full max-w-[580px] flex-1 flex-col pt-12 lg:pt-12">
            <div>
              <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.035em] text-[#101522] sm:text-[27px]">Como você quer vender?</h1>
              <p className="mt-3 text-[15px] text-[#687086]">Escolha um ângulo que prenda seus clientes.</p>

              <div className="mt-7 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {angles.map((angle) => {
                  const selected = selectedAngle === angle.title;
                  return (
                    <button key={angle.title} type="button" onClick={() => setSelectedAngle(angle.title)} className={`relative flex min-h-[180px] flex-col rounded-[10px] border p-5 text-left outline-none transition hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)] focus-visible:ring-4 focus-visible:ring-black/10 ${selected ? "border-black bg-white shadow-[inset_3px_0_0_rgba(0,0,0,0.82),0_14px_34px_rgba(15,23,42,0.08)]" : "border-[#dfe4ef] bg-white"}`}>
                      <span className="text-[25px] leading-none" aria-hidden="true">{angle.icon}</span>
                      <span className="mt-5 block text-[14px] font-semibold leading-snug text-[#101522]">{angle.title}</span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-[#687086]">{angle.description}</span>
                      {selected ? <Check size={15} className="absolute right-4 top-4 text-[#101522]" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-[#e7ebf2]" />
              <button type="button" onClick={() => setSelectedAngle("Deixar a Velo decidir")} className={`flex min-h-[78px] w-full items-center gap-4 rounded-[10px] border px-5 text-left transition hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)] ${selectedAngle === "Deixar a Velo decidir" ? "border-black bg-white shadow-[inset_3px_0_0_rgba(0,0,0,0.82),0_14px_34px_rgba(15,23,42,0.08)]" : "border-[#dfe4ef] bg-white"}`}>
                <Brain size={28} className="w-9 shrink-0 text-[#101522]" />
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-[#101522]">Deixar a Velo decidir</span><span className="mt-1 block text-[12px] text-[#687086]">Vamos escolher o melhor ângulo de marketing para seu produto.</span></span>
                {selectedAngle === "Deixar a Velo decidir" ? <Check size={15} className="text-[#101522]" /> : null}
              </button>
            </div>

            <div className="mt-auto pb-2 pt-8">
              <button type="button" onClick={handleContinue} disabled={!selectedAngle} className="inline-flex h-[56px] w-full items-center justify-center rounded-[10px] bg-black text-[16px] font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-[#d8dde8] disabled:text-[#8b94a6] disabled:shadow-none">Continuar</button>
              <p className="mt-3 text-center text-[11px] text-[#8b94a6]">Experimente grátis</p>
            </div>
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[#edf0f5] bg-white p-12 lg:flex">
          <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle,rgba(0,0,0,0.26)_1.8px,transparent_2px)] [background-position:2px_2px] [background-size:30px_30px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.68),rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.48)_78%)]" />
          <div className="relative z-10 flex min-h-[330px] w-full max-w-[420px] flex-col items-center justify-center rounded-[18px] border border-[#dfe4ef] bg-white p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            <span className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-[#f5f6f8] text-[42px]">🙋<span className="absolute -bottom-1 -right-1 text-[20px] font-semibold text-[#101522]">{languageCode[flow.language] || flow.language.slice(0, 2).toUpperCase()}</span></span>
            <p className="mt-9 text-[20px] font-semibold tracking-[-0.025em] text-[#101522]">{flow.persona}</p>
            <p className="mt-4 text-[15px] text-[#687086]">Seu ângulo de marketing único</p>
            {selectedAngle ? <p className="mt-6 max-w-[270px] text-[12px] text-[#687086]">{selectedAngle}</p> : null}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default SalesAnglePage;
