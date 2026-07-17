import { useMemo, useState } from "react";
import { Check, ChevronLeft, Pencil, Smile, Sparkles } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { saveProjectDraft } from "@/lib/userProjects";
import { readOnboardingProjectId } from "@/lib/onboardingProject";

type FlowState = { product: ExampleProduct; language: string; projectId?: string | null };

const personas = [
  { icon: "🙋", title: "Comprador Prático", description: "Busca soluções simples, úteis e fáceis de incluir na rotina." },
  { icon: "🛍️", title: "Caçador de Ofertas", description: "Compara opções e valoriza uma compra com ótimo custo-benefício." },
  { icon: "✨", title: "Entusiasta de Novidades", description: "Gosta de descobrir produtos diferentes antes de todo mundo." },
  { icon: "🧠", title: "Comprador Consciente", description: "Pesquisa detalhes e escolhe com cuidado antes de comprar." },
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

const CustomerPersonaPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const flow = useMemo<FlowState | null>(() => {
    const state = location.state as Partial<FlowState> | null;
    let product = state?.product;
    let language = state?.language;
    const projectId = state?.projectId ?? readOnboardingProjectId() ?? null;
    try {
      if (!product) {
        const storedProduct = sessionStorage.getItem("velo-example-product");
        product = storedProduct ? (JSON.parse(storedProduct) as ExampleProduct) : undefined;
      }
      if (!language) language = sessionStorage.getItem("velo-store-language") || undefined;
    } catch {
      return null;
    }
    return product && language ? { product, language, projectId } : null;
  }, [location.state]);
  const [selectedPersona, setSelectedPersona] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customPersona, setCustomPersona] = useState("");

  if (!flow) return <Navigate to="/comecar" replace />;

  const effectivePersona = selectedPersona === "custom" ? customPersona.trim() : selectedPersona;

  const handleContinue = () => {
    if (!effectivePersona) return;
    sessionStorage.setItem("velo-customer-persona", effectivePersona);
    if (flow.projectId) {
      void saveProjectDraft(flow.projectId, { persona: effectivePersona }).catch((err) => {
        console.error("saveProjectDraft (persona) failed:", err);
      });
    }
    navigate("/onboarding/angulo-vendas", { state: { ...flow, persona: effectivePersona } });
  };

  return (
    <main className="min-h-screen bg-white text-[#101522]" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden px-7 py-7 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_45%,rgba(15,23,42,0.04),transparent_38%)]" />
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/idioma" state={flow} className="inline-flex items-center gap-2 text-[12px] font-medium text-[#111827]/45 transition hover:text-[#111827]">
              <ChevronLeft size={16} /> Voltar
            </Link>
            <div className="w-[42%] max-w-[310px]">
              <div className="h-[4px] overflow-hidden rounded-full bg-[#e4e7ef]">
                <div className="h-full w-[78%] rounded-full bg-black" />
              </div>
            </div>
          </header>

          <div className="relative z-10 mx-auto flex w-full max-w-[580px] flex-1 flex-col pt-12 lg:pt-11">
            <div>
              <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.035em] text-[#101522] sm:text-[27px]">Para quem você está vendendo?</h1>
              <p className="mt-3 text-[15px] text-[#687086]">Escolha o perfil que combina com seu comprador.</p>

              <div className="mt-7 space-y-2">
                {personas.map((persona) => {
                  const selected = selectedPersona === persona.title;
                  return (
                    <button key={persona.title} type="button" onClick={() => { setSelectedPersona(persona.title); setCustomOpen(false); }} className={`flex min-h-[78px] w-full items-center gap-4 rounded-[10px] border px-5 text-left outline-none transition hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)] focus-visible:ring-4 focus-visible:ring-black/10 ${selected ? "border-black bg-white shadow-[inset_3px_0_0_rgba(0,0,0,0.82),0_14px_34px_rgba(15,23,42,0.08)]" : "border-[#dfe4ef] bg-white"}`}>
                      <span className="w-8 shrink-0 text-center text-[27px] leading-none" aria-hidden="true">{persona.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-[#101522]">{persona.title}</span>
                        <span className="mt-1 block text-[12px] leading-snug text-[#687086]">{persona.description}</span>
                      </span>
                      {selected ? <Check size={16} className="shrink-0 text-[#101522]" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-[#e7ebf2]" />
              <button type="button" onClick={() => { setCustomOpen(true); setSelectedPersona("custom"); }} className={`flex min-h-[70px] w-full items-center gap-4 rounded-[10px] border px-5 text-left transition hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)] ${customOpen ? "border-black bg-white shadow-[inset_3px_0_0_rgba(0,0,0,0.82),0_14px_34px_rgba(15,23,42,0.08)]" : "border-[#dfe4ef] bg-white"}`}>
                <Pencil size={25} className="w-8 shrink-0 text-[#101522]" />
                <span className="flex-1 text-[14px] font-semibold text-[#101522]">Escreva sua própria persona</span>
                {customOpen && customPersona.trim() ? <Check size={16} className="text-[#101522]" /> : null}
              </button>
              {customOpen ? (
                <textarea value={customPersona} onChange={(event) => setCustomPersona(event.target.value)} autoFocus rows={3} maxLength={240} placeholder="Ex.: Profissionais que trabalham em casa e valorizam praticidade..." className="mt-2 w-full resize-none rounded-[10px] border border-[#dfe4ef] bg-white p-4 text-[13px] leading-relaxed text-[#101522] outline-none transition placeholder:text-[#8b94a6] focus:border-black/40 focus:shadow-[0_14px_34px_rgba(15,23,42,0.07)]" />
              ) : null}
            </div>

            <div className="mt-auto pb-2 pt-8">
              <button type="button" onClick={handleContinue} disabled={!effectivePersona} className="inline-flex h-[56px] w-full items-center justify-center rounded-[10px] bg-black text-[16px] font-semibold text-white shadow-[0_16px_34px_rgba(0,0,0,0.14)] transition hover:-translate-y-0.5 hover:bg-[#202020] disabled:cursor-not-allowed disabled:bg-[#d8dde8] disabled:text-[#8b94a6] disabled:shadow-none">Continuar</button>
              <p className="mt-3 text-center text-[11px] text-[#8b94a6]">Experimente grátis</p>
            </div>
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[#edf0f5] bg-white p-12 lg:flex">
          <div className="absolute inset-0 opacity-80 [background-image:radial-gradient(circle,rgba(0,0,0,0.26)_1.8px,transparent_2px)] [background-position:2px_2px] [background-size:30px_30px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.68),rgba(255,255,255,0.18)_42%,rgba(255,255,255,0.48)_78%)]" />
          <div className="relative z-10 flex min-h-[330px] w-full max-w-[420px] flex-col items-center justify-center rounded-[18px] border border-[#dfe4ef] bg-white p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
            <span className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-[#f5f6f8] text-[#101522]">
              <Smile size={45} strokeWidth={1.4} />
              <span className="absolute -bottom-1 -right-1 text-[20px] font-semibold text-[#101522]">{languageCode[flow.language] || flow.language.slice(0, 2).toUpperCase()}</span>
            </span>
            <p className="mt-9 text-[20px] font-semibold tracking-[-0.025em] text-[#101522]">Persona do cliente ideal</p>
            <p className="mt-4 text-[15px] text-[#687086]">Seu ângulo de marketing único</p>
            {effectivePersona ? <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#f5f6f8] px-3 py-1.5 text-[11px] text-[#687086]"><Sparkles size={12} /> {effectivePersona}</div> : null}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default CustomerPersonaPage;
