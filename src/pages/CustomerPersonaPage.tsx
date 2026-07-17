import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Pencil, Smile, Sparkles } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { listItem, listStagger, screenEnter } from "@/components/onboarding/flowMotion";
import type { ExampleProduct } from "@/pages/StartChoicePage";

type FlowState = { product: ExampleProduct; language: string };

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
    <main className="velo-flow min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col overflow-hidden px-7 py-7 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_45%,rgba(255,255,255,0.04),transparent_40%)]" />
          <header className="relative z-10 flex items-center justify-between">
            <Link to="/onboarding/idioma" state={flow} className="vf-btn-ghost inline-flex items-center gap-2 text-[12px] font-medium">
              <ChevronLeft size={16} /> Voltar
            </Link>
            <div className="w-[42%] max-w-[310px]">
              <div className="vf-progress"><i style={{ width: "78%" }} /></div>
            </div>
          </header>

          <motion.div {...screenEnter} className="relative z-10 mx-auto flex w-full max-w-[580px] flex-1 flex-col pt-12 lg:pt-11">
            <div>
              <h1 className="vf-headline">Para quem você está vendendo?</h1>
              <p className="vf-subhead mt-3">Escolha o perfil que combina com seu comprador.</p>

              <motion.div variants={listStagger} initial="initial" animate="animate" className="mt-7 space-y-2">
                {personas.map((persona) => {
                  const selected = selectedPersona === persona.title;
                  return (
                    <motion.button variants={listItem} key={persona.title} type="button" onClick={() => { setSelectedPersona(persona.title); setCustomOpen(false); }} data-selected={selected} className="vf-nested flex min-h-[78px] w-full items-center gap-4 rounded-[12px] px-5 text-left outline-none">
                      <span className="w-8 shrink-0 text-center text-[27px] leading-none" aria-hidden="true">{persona.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-[var(--vf-text-1)]">{persona.title}</span>
                        <span className="mt-1 block text-[12px] leading-snug text-[var(--vf-text-2)]">{persona.description}</span>
                      </span>
                      {selected ? <Check size={16} className="shrink-0 text-[var(--vf-text-1)]" /> : null}
                    </motion.button>
                  );
                })}
              </motion.div>

              <div className="my-4 h-px bg-[var(--vf-border)]" />
              <button type="button" onClick={() => { setCustomOpen(true); setSelectedPersona("custom"); }} data-selected={customOpen} className="vf-nested flex min-h-[70px] w-full items-center gap-4 rounded-[12px] px-5 text-left">
                <Pencil size={25} className="w-8 shrink-0 text-[var(--vf-text-1)]" />
                <span className="flex-1 text-[14px] font-semibold text-[var(--vf-text-1)]">Escreva sua própria persona</span>
                {customOpen && customPersona.trim() ? <Check size={16} className="text-[var(--vf-text-1)]" /> : null}
              </button>
              {customOpen ? (
                <textarea value={customPersona} onChange={(event) => setCustomPersona(event.target.value)} autoFocus rows={3} maxLength={240} placeholder="Ex.: Profissionais que trabalham em casa e valorizam praticidade..." className="mt-2 w-full resize-none rounded-[12px] border border-[var(--vf-border)] bg-[var(--vf-nested)] p-4 text-[13px] leading-relaxed text-[var(--vf-text-1)] outline-none transition placeholder:text-[var(--vf-text-3)] focus:border-[var(--vf-border-hover)]" />
              ) : null}
            </div>

            <div className="mt-auto pb-2 pt-8">
              <button type="button" onClick={handleContinue} disabled={!effectivePersona} className="vf-btn inline-flex h-[56px] w-full items-center justify-center text-[16px]">Continuar</button>
              <p className="mt-3 text-center text-[11px] text-[var(--vf-text-3)]">Experimente grátis</p>
            </div>
          </motion.div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[var(--vf-border)] bg-[var(--vf-panel-side)] p-12 lg:flex">
          <div className="absolute inset-0 opacity-70 [background-image:radial-gradient(circle,rgba(255,255,255,0.08)_1.4px,transparent_2px)] [background-position:2px_2px] [background-size:30px_30px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.05),transparent_46%,rgba(0,0,0,0.3)_82%)]" />
          <div className="relative z-10 flex min-h-[330px] w-full max-w-[420px] flex-col items-center justify-center rounded-[18px] border border-[var(--vf-border)] bg-[var(--vf-panel)] p-8 text-center shadow-[0_24px_64px_rgba(0,0,0,0.4)]">
            <span className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-[var(--vf-nested)] text-[var(--vf-text-1)]">
              <Smile size={45} strokeWidth={1.4} />
              <span className="absolute -bottom-1 -right-1 text-[20px] font-semibold text-[var(--vf-text-1)]">{languageCode[flow.language] || flow.language.slice(0, 2).toUpperCase()}</span>
            </span>
            <p className="mt-9 text-[20px] font-semibold tracking-[-0.02em] text-[var(--vf-text-1)]">Persona do cliente ideal</p>
            <p className="mt-4 text-[15px] text-[var(--vf-text-2)]">Seu ângulo de marketing único</p>
            {effectivePersona ? <div className="mt-7 inline-flex items-center gap-2 rounded-full bg-[var(--vf-nested)] px-3 py-1.5 text-[11px] text-[var(--vf-text-2)]"><Sparkles size={12} /> {effectivePersona}</div> : null}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default CustomerPersonaPage;
