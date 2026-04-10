import { Link } from "react-router-dom";
import { useRef, useState } from "react";
import LogosStrip from "@/components/landing/LogosStrip";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorks from "@/components/landing/HowItWorks";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import PricingSection from "@/components/landing/PricingSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

const sidebarItems = [
  "Novo chat",
  "Automacoes",
  "Skills",
  "Wuilli",
  "Landing principal",
  "Revisar anuncios",
];

const activityRows = [
  "Vou simplificar o hero e reforcar a clareza da proposta.",
  "Ajustei a hierarquia visual para um visual mais leve.",
  "CTA principal mais direto e sem ruido.",
];

const codeLines = [
  'export const hero = {',
  '  title: "Wuilli",',
  '  subtitle: "Sua operacao de vendas, automatizada por IA.",',
  '  primaryCta: "Criar workspace",',
  '};',
];


const navGroups = {
  Produto: ["ChatGPT", "Sora", "Atlas", "Codex", "Prism"],
  Recursos: ["Automacoes", "Catalogo IA", "Operacao", "Relatorios"],
  Precos: ["Starter", "Growth", "Scale", "Enterprise"],
  Empresa: ["Sobre", "Clientes", "Carreiras", "Contato"],
  Desenvolvedores: ["API", "Documentacao", "SDKs", "Status"],
} as const;

const navMeta = {
  Produto: {
    eyebrow: "Explore Produto",
    featured: ["ChatGPT", "Sora", "Atlas", "Codex", "Prism"],
    secondary: ["Automacoes", "Workspace IA", "Catalogo", "Respostas"],
  },
  Recursos: {
    eyebrow: "Explore Recursos",
    featured: ["Automacoes", "Catalogo IA", "Operacao", "Relatorios"],
    secondary: ["Central de ajuda", "Tutoriais", "Modelos", "Playbooks"],
  },
  Precos: {
    eyebrow: "Explore Precos",
    featured: ["Starter", "Growth", "Scale", "Enterprise"],
    secondary: ["Comparar planos", "Consultoria", "Implementacao", "Suporte"],
  },
  Empresa: {
    eyebrow: "Explore Empresa",
    featured: ["Sobre", "Clientes", "Carreiras", "Contato"],
    secondary: ["Manifesto", "Casos", "Parceiros", "Midia"],
  },
  Desenvolvedores: {
    eyebrow: "Explore Desenvolvedores",
    featured: ["Plataforma de API", "Codex", "Agentes", "Modelos Abertos", "Aplicativos"],
    secondary: ["Documentos", "Livros de receitas", "Comunidade", "Status"],
  },
} as const;

const Index = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [activeMenu, setActiveMenu] = useState<keyof typeof navGroups | null>(null);


  return (
    <div
      ref={rootRef}
      className="relative min-h-screen overflow-x-hidden bg-[#0e0e10] text-[#0a0a0a]"
    >
      {/* Lavender gradient overlay — covers hero area only, fades to transparent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[1200px]" style={{ background: "linear-gradient(to bottom, #dfe6ff 0%, #ced7ff 55%, #0e0e10 100%)" }} />

      <div className="relative z-10">
        <header
          className="sticky top-0 z-40"
          onMouseLeave={() => setActiveMenu(null)}
        >
          <div
            className={`absolute inset-x-0 top-0 overflow-hidden bg-black text-white transition-[height,opacity,transform] duration-300 ${activeMenu ? "h-[408px] translate-y-0 opacity-100" : "h-0 -translate-y-2 opacity-0"}`}
            style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
          >
            <div className="mx-auto grid max-w-[1280px] grid-cols-[minmax(280px,1.1fr)_minmax(220px,0.7fr)] gap-24 px-6 pb-12 pt-24 md:px-8">
              <div>
                <div className="mb-5 text-sm text-[#8ec5ff]">
                  {activeMenu ? navMeta[activeMenu].eyebrow : ""}
                </div>
                <div className="space-y-3 font-['Manrope']">
                  {(activeMenu ? navMeta[activeMenu].featured : []).map((item) => (
                    <a
                      key={item}
                      href="#"
                      className="block text-[24px] font-medium tracking-[-0.03em] text-white transition hover:translate-x-1 hover:text-white/75 md:text-[30px]"
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
              <div className="pt-1">
                <div className="mb-5 text-sm text-[#9ca3af]">Recursos</div>
                <div className="space-y-3 font-['Manrope']">
                  {(activeMenu ? navMeta[activeMenu].secondary : []).map((item) => (
                    <a
                      key={item}
                      href="#"
                      className="block text-[16px] font-semibold text-white transition hover:text-white/75"
                    >
                      {item}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className={`relative mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 transition-colors duration-300 md:px-8 ${activeMenu ? "text-white" : "text-[#0a0a0a]"}`}>
            <div className="flex items-center gap-10">
              <Link to="/" className="flex items-center">
                <span className="text-[17px] font-semibold tracking-[-0.01em]">Wuilli</span>
              </Link>
              <nav className="hidden items-center gap-7 text-[14px] font-normal md:flex">
                {Object.keys(navGroups).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onMouseEnter={() => setActiveMenu(item as keyof typeof navGroups)}
                    className={`transition ${activeMenu === item ? "opacity-100" : "hover:opacity-60"}`}
                  >
                    {item}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-4 md:gap-5">
              <button aria-label="Buscar" className="hidden p-1.5 transition hover:opacity-60 md:inline-flex">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                  <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <Link to="/login" className="hidden text-[14px] font-normal transition hover:opacity-60 md:inline-flex">
                Entrar
              </Link>
              <Link
                to="/cadastro"
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13.5px] font-medium transition ${activeMenu ? "bg-white text-black hover:bg-white/90" : "bg-[#0a0a0a] text-white hover:bg-[#1a1a1a]"}`}
              >
                Criar workspace
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </div>
        </header>

        <main
          className={`px-6 pb-16 pt-2 transition-[transform,opacity] duration-300 md:px-10 md:pb-24 md:pt-4 ${activeMenu ? "scale-[0.995] opacity-50" : "opacity-100"}`}
          style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
        >
          <section className="mx-auto flex max-w-[860px] flex-col items-center text-center">
            <div className="mb-3 flex items-center justify-center">
              <img
                src="/logo-transparente.png"
                alt="Wuilli"
                className="h-40 w-40 object-contain drop-shadow-[0_18px_44px_rgba(79,70,229,0.24)] md:h-48 md:w-48"
              />
            </div>

            <h1 className="font-['Sora'] text-[44px] font-medium leading-[1.02] tracking-[-0.045em] text-[#0a0a0a] md:text-[60px]">
              Wuilli
            </h1>

            <p className="mt-2 max-w-[760px] font-['Sora'] text-[15px] font-normal leading-[1.6] tracking-[-0.012em] text-[#0a0a0a]/82 md:text-[18px]">
              Um agente de vendas que ajuda voce a publicar, responder e vender no e-commerce com IA, com operacao automatizada ponta a ponta.
            </p>

            <div className="mt-5">
              <Link
                to="/cadastro"
                className="inline-flex items-center gap-2 rounded-full bg-[#0a0a0a] px-7 py-4 text-[15px] font-medium text-white transition hover:bg-[#1a1a1a] hover:shadow-[0_18px_40px_rgba(10,10,10,0.25)]"
              >
                Criar workspace
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          </section>

          <section className="mx-auto mt-20 max-w-[1120px] md:mt-24">
            <div className="overflow-hidden rounded-[20px] border border-black/8 bg-[#0c0c0d]/96 shadow-[0_40px_120px_rgba(46,55,120,0.22)] [transform:perspective(1800px)_rotateX(7deg)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white/78">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <div className="text-sm font-medium">Workspace Wuilli</div>
                <div className="rounded-full border border-white/12 px-3 py-1 text-xs">Abrir</div>
              </div>

              <div className="grid min-h-[440px] md:grid-cols-[230px_1fr_380px]">
                <aside className="border-r border-white/10 bg-[#556091]/92 px-4 py-5 text-white">
                  <div className="mb-6 text-sm font-medium text-white/84">Navegacao</div>
                  <div className="space-y-2">
                    {sidebarItems.map((item, index) => (
                      <div
                        key={item}
                        className={`rounded-xl px-3 py-2 text-sm ${
                          index === 4 ? "bg-white/14 text-white" : "text-white/78"
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="border-r border-white/10 bg-[#0c0c0d] px-5 py-5 text-white">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-base font-medium">Atualizar hero</div>
                    <div className="text-xs text-white/44">agora</div>
                  </div>

                  <div className="max-w-md rounded-[20px] bg-white/[0.08] px-4 py-3 text-sm leading-7 text-white/88">
                    Vou deixar a landing mais silenciosa, clara e premium, com foco total no produto e no CTA.
                  </div>

                  <div className="mt-6 space-y-3">
                    {activityRows.map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl bg-white/[0.04] px-4 py-3 text-sm leading-7 text-white/70"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#151516] px-5 py-5 text-white">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-sm font-medium">2 arquivos alterados</div>
                    <div className="text-xs text-[#6fda7a]">+8 -3</div>
                  </div>

                  <div className="rounded-[18px] bg-[#1d1d1f] p-4 font-mono text-[13px] leading-7 text-white/88">
                    {codeLines.map((line, index) => (
                      <div key={`${line}-${index}`} className="whitespace-pre">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        {/* Smooth gradient transition — wraps logos + features so there's no seam */}
        {/* Gradient fade into dark — logos sit on dark bg */}
        <div className="h-[180px]" style={{ background: "linear-gradient(to bottom, #cfd7ff, #0e0e10)" }} />
        <div className="bg-[#0e0e10]">
          <LogosStrip />
        </div>
        <HowItWorks />
        <TestimonialsSection />
        <PricingSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
};

export default Index;
