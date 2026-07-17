import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Brain, Check } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { ExampleProduct } from "@/pages/StartChoicePage";
import { saveProjectDraft } from "@/lib/userProjects";
import { readOnboardingProjectId } from "@/lib/onboardingProject";
import { listItem, listStagger, screenEnter } from "@/components/onboarding/flowMotion";

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
    <main className="velo-flow min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
        <section className="relative flex min-h-screen flex-col items-center overflow-hidden px-6 py-7 sm:px-9 lg:px-12">
          <Link
            to="/onboarding/persona"
            state={flow}
            className="vf-btn-ghost absolute left-6 top-7 inline-flex items-center sm:left-9 lg:left-12"
            aria-label="Voltar"
          >
            <ArrowLeft size={20} />
          </Link>
          <div
            className="absolute left-1/2 top-7 h-[5px] w-[210px] -translate-x-1/2 overflow-hidden rounded-[1px] bg-white/10"
            aria-label="Progresso da criação"
          >
            <div className="h-full bg-white transition-all duration-300" style={{ width: "88%" }} />
          </div>

          <motion.div {...screenEnter} className="mt-[76px] w-full max-w-[580px]">
            <h1 className="vf-headline text-[24px] font-medium leading-[30px] tracking-[-0.6px]">Como você quer vender?</h1>
            <p className="vf-subhead mt-2 text-[18px] font-normal leading-[28px]">Escolha um ângulo que prenda seus clientes.</p>

            <motion.div variants={listStagger} initial="initial" animate="animate" className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {angles.map((angle) => {
                const selected = selectedAngle === angle.title;
                return (
                  <motion.button
                    variants={listItem}
                    key={angle.title}
                    type="button"
                    onClick={() => setSelectedAngle(angle.title)}
                    data-selected={selected}
                    className="vf-card relative flex min-h-[180px] flex-col p-5 text-left outline-none focus-visible:border-[var(--vf-border-hover)]"
                  >
                    <span className="text-[26px] leading-none" aria-hidden="true">{angle.icon}</span>
                    <span className="mt-5 block text-[16px] font-medium leading-snug text-[var(--vf-text-1)]">{angle.title}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-[var(--vf-text-2)]">{angle.description}</span>
                    {selected ? <Check size={16} className="absolute right-4 top-4 text-[var(--vf-text-1)]" /> : null}
                  </motion.button>
                );
              })}
            </motion.div>

            <div className="my-4 h-px bg-[var(--vf-border)]" />
            <button
              type="button"
              onClick={() => setSelectedAngle("Deixar a Velo decidir")}
              data-selected={selectedAngle === "Deixar a Velo decidir"}
              className="vf-card flex min-h-[78px] w-full items-center gap-4 p-4 text-left outline-none focus-visible:border-[var(--vf-border-hover)]"
            >
              <Brain size={26} className="shrink-0 text-[var(--vf-text-1)]" />
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-medium text-[var(--vf-text-1)]">Deixar a Velo decidir</span><span className="mt-0.5 block text-[13px] text-[var(--vf-text-2)]">Vamos escolher o melhor ângulo de marketing para seu produto.</span></span>
              {selectedAngle === "Deixar a Velo decidir" ? <Check size={16} className="text-[var(--vf-text-1)]" /> : null}
            </button>

            <button type="button" onClick={handleContinue} disabled={!selectedAngle} className="vf-btn mt-6 inline-flex h-12 w-full items-center justify-center text-[14px]">Continuar</button>
          </motion.div>
        </section>

        <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden border-l border-[var(--vf-border)] bg-[var(--vf-panel-side)] p-12 lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.15]"
            style={{
              backgroundImage: "radial-gradient(circle, rgb(255,255,255) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />
          <div className="relative z-10 flex w-full max-w-[420px] flex-col items-center rounded-[20px] border border-[var(--vf-border)] bg-[var(--vf-panel)] px-6 py-14 text-center">
            <span className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full bg-white/[0.06] text-[42px]">
              🙋
              <span className="absolute -bottom-1 -right-1 text-[20px] font-semibold text-[var(--vf-text-1)]">
                {languageCode[flow.language] || flow.language.slice(0, 2).toUpperCase()}
              </span>
            </span>
            <p className="mt-8 text-[24px] font-medium tracking-[-0.02em] text-[var(--vf-text-1)]">{flow.persona}</p>
            <p className="mt-2 text-[16px] text-[var(--vf-text-3)]">Seu ângulo de marketing único</p>
            {selectedAngle ? <p className="mt-6 max-w-[270px] text-[13px] text-[var(--vf-text-2)]">{selectedAngle}</p> : null}
          </div>
        </aside>
      </div>
    </main>
  );
};

export default SalesAnglePage;
