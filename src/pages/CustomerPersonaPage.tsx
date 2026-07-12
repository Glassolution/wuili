import { useMemo, useState } from "react";
import { Check, ChevronLeft, Pencil, Smile, Sparkles } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";

type FlowState = { product: ExampleProduct; language: string };

const personas = [
  { icon: "🙋", title: "Comprador Prático", description: "Busca soluções simples, úteis e fáceis de incluir na rotina." },
  { icon: "🛍️", title: "Caçador de Ofertas", description: "Compara opções e valoriza uma compra com ótimo custo-benefício." },
  { icon: "✨", title: "Entusiasta de Novidades", description: "Gosta de descobrir produtos diferentes antes de todo mundo." },
  { icon: "🧠", title: "Comprador Consciente", description: "Pesquisa detalhes e escolhe com cuidado antes de comprar." },
];

const languageCode: Record<string, string> = {
  Português: "PT", Inglês: "EN", Espanhol: "ES", Francês: "FR", Alemão: "DE",
};

const CustomerPersonaPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const flow = useMemo<FlowState | null>(() => {
    const state = location.state as Partial<FlowState> | null;
    let product = state?.product;
    let language = state?.language;
    try {
      if (!product) {
        const storedProduct = sessionStorage.getItem("velo-example-product");
        product = storedProduct ? (JSON.parse(storedProduct) as ExampleProduct) : undefined;
      }
      if (!language) language = sessionStorage.getItem("velo-store-language") || undefined;
    } catch {
      return null;
    }
    return product && language ? { product, language } : null;
  }, [location.state]);
  const [selectedPersona, setSelectedPersona] = useState("");
  const [customOpen, setCustomOpen] = useState(false);
  const [customPersona, setCustomPersona] = useState("");

  if (!flow) return <Navigate to="/comecar" replace />;

  const effectivePersona = selectedPersona === "custom" ? customPersona.trim() : selectedPersona;

  const handleContinue = () => {
    if (!effectivePersona) return;
    sessionStorage.setItem("velo-customer-persona", effectivePersona);
    navigate("/onboarding/angulo-vendas", { state: { ...flow, persona: effectivePersona } });
  };

  return (
    <main className="min-h-screen bg-black text-white" style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#0d0d0d] px-7 py-7 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/idioma" state={flow} className="inline-flex items-center gap-2 text-[12px] font-medium text-white/45 transition hover:text-white">
              <ChevronLeft size={16} /> Voltar
            </Link>
            <div className="w-[42%] max-w-[310px]">
              <div className="h-[4px] overflow-hidden rounded-full bg-white/[0.09]">
                <div className="h-full w-[78%] rounded-full bg-white/45" />
              </div>
            </div>
          </header>

          <div className="relative z-10 mx-auto flex w-full max-w-[580px] flex-1 flex-col pt-12 lg:pt-11">
            <div>
              <h1 className="text-[25px] font-semibold leading-tight tracking-[-0.035em] sm:text-[27px]">Para quem você está vendendo?</h1>
              <p className="mt-3 text-[15px] text-white/58">Escolha o perfil que combina com seu comprador.</p>

              <div className="mt-7 space-y-2">
                {personas.map((persona) => {
                  const selected = selectedPersona === persona.title;
                  return (
                    <button key={persona.title} type="button" onClick={() => { setSelectedPersona(persona.title); setCustomOpen(false); }} className={`flex min-h-[78px] w-full items-center gap-4 rounded-[9px] px-5 text-left outline-none transition hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-white/60 ${selected ? "bg-white/[0.1] shadow-[inset_3px_0_0_rgba(243,239,232,0.7)]" : "bg-white/[0.055]"}`}>
                      <span className="w-8 shrink-0 text-center text-[27px] leading-none" aria-hidden="true">{persona.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-white/92">{persona.title}</span>
                        <span className="mt-1 block text-[12px] leading-snug text-white/55">{persona.description}</span>
                      </span>
                      {selected ? <Check size={16} className="shrink-0 text-white/75" /> : null}
                    </button>
                  );
                })}
              </div>

              <div className="my-4 h-px bg-white/[0.08]" />
              <button type="button" onClick={() => { setCustomOpen(true); setSelectedPersona("custom"); }} className={`flex min-h-[70px] w-full items-center gap-4 rounded-[9px] px-5 text-left transition hover:bg-white/[0.08] ${customOpen ? "bg-white/[0.09] shadow-[inset_3px_0_0_rgba(243,239,232,0.7)]" : "bg-white/[0.055]"}`}>
                <Pencil size={25} className="w-8 shrink-0 text-orange-300" />
                <span className="flex-1 text-[14px] font-semibold text-white/90">Escreva sua própria persona</span>
                {customOpen && customPersona.trim() ? <Check size={16} className="text-white/75" /> : null}
              </button>
              {customOpen ? (
                <textarea value={customPersona} onChange={(event) => setCustomPersona(event.target.value)} autoFocus rows={3} maxLength={240} placeholder="Ex.: Profissionais que trabalham em casa e valorizam praticidade..." className="mt-2 w-full resize-none rounded-[8px] bg-white/[0.04] p-4 text-[13px] leading-relaxed text-white outline-none transition placeholder:text-white/25 focus:bg-white/[0.07]" />
              ) : null}
            </div>

            <div className="mt-auto pb-2 pt-8">
              <button type="button" onClick={handleContinue} disabled={!effectivePersona} className="inline-flex h-[56px] w-full items-center justify-center rounded-[8px] bg-[#f3efe8] text-[16px] font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:bg-white/55 disabled:text-black/80">Continuar</button>
              <p className="mt-3 text-center text-[11px] text-white/35">Experimente grátis</p>
            </div>
          </div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#010101] p-12 lg:flex">
          <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(37,99,235,0.06),transparent_38%,rgba(0,0,0,0.45)_78%)]" />
          <div className="relative z-10 flex min-h-[330px] w-full max-w-[420px] flex-col items-center justify-center rounded-[18px] bg-[#1a1a1a] p-8 text-center shadow-[0_30px_90px_rgba(0,0,0,0.65)]">
            <span className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-white/[0.055] text-white/28">
              <Smile size={45} strokeWidth={1.4} />
              <span className="absolute -bottom-1 -right-1 text-[20px] font-semibold text-white/90">{languageCode[flow.language] || flow.language.slice(0, 2).toUpperCase()}</span>
            </span>
            <p className="mt-9 text-[20px] font-semibold tracking-[-0.025em] text-white/35">Persona do cliente ideal</p>
            <p className="mt-4 text-[15px] text-white/22">Seu ângulo de marketing único</p>
            {effectivePersona ? <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] text-white/45"><Sparkles size={12} /> {effectivePersona}</div> : null}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default CustomerPersonaPage;
