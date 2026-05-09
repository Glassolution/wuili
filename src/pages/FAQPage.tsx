import { useState } from "react";
import { Flame, Rocket, Lightbulb, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { VeloLogo } from "@/components/VeloLogo";

const sidebarItems = [
  "Começar",
  "Guias",
  "Funcionalidades",
  "Atualizações",
  "Comunidade",
] as const;

export default function FAQPage() {
  const [activeItem, setActiveItem] = useState<(typeof sidebarItems)[number]>("Começar");

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center">
            <VeloLogo size="md" variant="dark" />
          </Link>
          <Link
            to="/cadastro"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 ease-in-out hover:bg-white/10"
          >
            Começar grátis
            <ChevronRight size={14} />
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1200px] gap-0 px-6 py-8 lg:grid-cols-[250px_1fr]">
        <aside className="top-[88px] h-fit rounded-2xl border border-white/10 bg-white/[0.02] p-4 lg:sticky lg:max-h-[calc(100vh-120px)]">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Navegação</p>
          <nav className="space-y-1.5">
            {sidebarItems.map((item) => (
              <button
                key={item}
                onClick={() => setActiveItem(item)}
                className={cn(
                  "w-full rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 ease-in-out",
                  activeItem === item
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-transparent text-white/70 hover:border-white/10 hover:bg-white/5 hover:text-white",
                )}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 space-y-6 rounded-2xl border border-white/10 bg-white/[0.02] p-6 lg:ml-6 lg:p-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Central de Ajuda</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-white/70">
              Aprenda a usar a plataforma, veja atualizações e explore conteúdos da comunidade
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Flame size={15} /> 🔥 Começar aqui</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Guia rápido para gerar seu primeiro vídeo com IA, copiar o prompt e iniciar seus testes de criativo.
              </p>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Rocket size={15} /> 🚀 Novidades</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Acompanhe melhorias recentes, novas features e ajustes que deixam o fluxo mais rápido e confiável.
              </p>
            </article>

            <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><Lightbulb size={15} /> 💡 Dicas da comunidade</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                Boas práticas para anúncios, estrutura de criativos e insights reais para aumentar conversão.
              </p>
            </article>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/25 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">Hub completo</p>
            <p className="mt-2 text-sm leading-6 text-white/75">
              Para uma experiência completa de Documentação + Comunidade com atualização em timeline e feed de posts,
              acesse a versão dentro do dashboard.
            </p>
            <Link
              to="/dashboard/documentacao"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-white/90 transition-colors hover:text-white"
            >
              Abrir Documentação + Comunidade
              <ChevronRight size={14} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
