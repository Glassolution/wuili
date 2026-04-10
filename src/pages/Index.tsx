import { Link } from "react-router-dom";
import { useRef } from "react";

const sidebarItems = [
  "Novo chat",
  "Automações",
  "Skills",
  "Wuilli",
  "Landing principal",
  "Revisar anúncios",
];

const activityRows = [
  "Vou simplificar o hero e reforçar a clareza da proposta.",
  "Ajustei a hierarquia visual para um visual mais leve.",
  "CTA principal mais direto e sem ruído.",
];

const codeLines = [
  'export const hero = {',
  '  title: "Wuilli",',
  '  subtitle: "Sua operação de vendas, automatizada por IA.",',
  '  primaryCta: "Criar workspace",',
  '};',
];

const Index = () => {
  const rootRef = useRef<HTMLDivElement | null>(null);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const root = rootRef.current;
    if (!root) return;

    const x = (event.clientX / window.innerWidth) * 100;
    const y = (event.clientY / window.innerHeight) * 100;
    root.style.setProperty("--pointer-x", `${x}%`);
    root.style.setProperty("--pointer-y", `${y}%`);
  };

  const handlePointerLeave = () => {
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty("--pointer-x", "50%");
    root.style.setProperty("--pointer-y", "28%");
  };

  return (
    <div
      ref={rootRef}
      className="relative min-h-screen overflow-x-hidden bg-[#cfd7ff] text-[#0a0a0a]"
      style={{
        ["--pointer-x" as string]: "50%",
        ["--pointer-y" as string]: "28%",
      }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(94,110,255,0.72),transparent_24%),radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.36),transparent_28%),radial-gradient(circle_at_82%_74%,rgba(235,214,255,0.62),transparent_26%),linear-gradient(180deg,#dfe6ff_0%,#ced7ff_48%,#c5ceff_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-70 transition-transform duration-700 ease-out bg-[radial-gradient(circle_at_var(--pointer-x)_var(--pointer-y),rgba(255,255,255,0.42),transparent_0_10%),radial-gradient(circle_at_var(--pointer-x)_var(--pointer-y),rgba(124,141,255,0.22),transparent_10_18%)]" />
      <div className="pointer-events-none absolute inset-0 animate-light-sweep opacity-45 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.12)_48%,transparent_64%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(rgba(255,255,255,0.95)_0.7px,transparent_0.7px)] [background-size:18px_18px]" />

      <div className="relative z-10">
        <header className="flex items-center justify-between px-6 py-6 md:px-10">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand-star-logo.png"
              alt="Wuilli"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                filter: "drop-shadow(0 4px 12px rgba(37,99,235,0.3))",
              }}
            />
            <span className="text-[18px] font-semibold text-white">Wuilli</span>
          </div>
          <Link
            to="/login"
            className="rounded-full bg-[#1b1b1b] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
          >
            Entrar
          </Link>
        </header>

        <main className="px-6 pb-16 pt-10 md:px-10 md:pb-24 md:pt-16">
          <section className="mx-auto flex max-w-[800px] flex-col items-center text-center">
            <img
              src="/brand-star-logo.png"
              alt="Wuilli"
              style={{
                width: 96,
                height: 96,
                marginBottom: 40,
                filter: "drop-shadow(0 8px 24px rgba(37,99,235,0.25))",
              }}
            />

            <h1 className="text-[48px] font-medium tracking-[-0.05em] text-[#0a0a0a] md:text-[64px]">
              Wuilli
            </h1>

            <p className="mt-6 max-w-[600px] text-[17px] leading-8 text-[#6b7280]">
              Sua operação de vendas, automatizada por IA.
            </p>

            <div className="mt-10">
              <Link
                to="/cadastro"
                className="inline-flex items-center justify-center rounded-full bg-[#151515] px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
              >
                Criar workspace
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
                  <div className="mb-6 text-sm font-medium text-white/84">Navegação</div>
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
      </div>
    </div>
  );
};

export default Index;
