import { ArrowUpRight, FlaskConical, PackageOpen, Store } from "lucide-react";
import { Link } from "react-router-dom";
import StoreMockupPreview from "@/components/onboarding/StoreMockupPreview";

export type ExampleProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
};

const VeloWordmark = () => (
  <Link to="/" className="inline-flex items-center gap-2.5 text-white" aria-label="Velo">
    <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M33 18 A11 11 0 1 0 33 30" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M30 26 L34 30 L38 26" stroke="currentColor" strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className="text-[17px] font-bold tracking-[-0.04em]">Velo</span>
  </Link>
);

const StartChoicePage = () => {
  return (
  <main
    className="min-h-screen bg-black text-white"
    style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
  >
    <div className="grid min-h-screen lg:grid-cols-[55%_45%]">
      <section className="relative flex min-h-screen flex-col overflow-hidden px-7 py-7 sm:px-10 lg:px-16 lg:py-8 xl:px-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_38%_48%,rgba(255,255,255,0.045),transparent_38%)]" />
        <header className="relative z-10 flex min-h-7 items-center">
          <VeloWordmark />
          <div
            className="absolute right-0 hidden w-[42%] max-w-[310px] sm:block"
            role="progressbar"
            aria-label="Progresso da configuração"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={18}
          >
            <div className="h-[4px] overflow-hidden rounded-full bg-white/[0.09] shadow-[0_0_8px_rgba(255,255,255,0.03)]">
              <div className="h-full w-[18%] rounded-full bg-white/30" />
            </div>
          </div>
        </header>

        <div className="relative z-10 mt-14 w-full max-w-[640px] pb-10 sm:mt-16 lg:mt-10 xl:mt-12">
          <p className="mb-3 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/38">Seu primeiro passo</p>
          <h1 className="max-w-[560px] text-[30px] font-medium leading-[1.08] tracking-[-0.045em] text-white sm:text-[34px] lg:text-[36px]">
            Como você quer começar?
          </h1>
          <p className="mt-3 max-w-[520px] text-[13px] font-normal leading-[1.55] text-white/52 sm:text-[14px]">
            Escolha o caminho que combina com o seu momento. Você pode montar sua loja ou publicar produtos diretamente no Mercado Livre.
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <Link
              to="/onboarding/criar-loja"
              className="group relative flex min-h-[184px] flex-col rounded-[6px] bg-white/[0.09] p-5 outline-none transition duration-300 hover:-translate-y-1 hover:bg-white/[0.12] focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span className="absolute right-4 top-4 rounded-[4px] bg-[#f3efe8] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-black">
                Recomendado
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-white/10 text-white">
                <Store size={18} strokeWidth={1.7} />
              </span>
              <div className="mt-auto pt-10">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[16px] font-medium tracking-[-0.03em]">Criar minha loja</h2>
                  <ArrowUpRight size={17} className="text-white/35 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
                <p className="mt-2 text-[13px] leading-[1.55] text-white/52">
                  Monte sua loja com produtos selecionados do catálogo Velo.
                </p>
              </div>
            </Link>

            <Link
              to="/dashboard/catalogo"
              className="group flex min-h-[184px] flex-col rounded-[6px] bg-white/[0.045] p-5 outline-none transition duration-300 hover:-translate-y-1 hover:bg-white/[0.07] focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[5px] bg-white/[0.06] text-white/72">
                <PackageOpen size={18} strokeWidth={1.7} />
              </span>
              <div className="mt-auto pt-10">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-[16px] font-medium tracking-[-0.03em] text-white/88">Importar produtos</h2>
                  <ArrowUpRight size={17} className="text-white/25 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/80" />
                </div>
                <p className="mt-2 text-[13px] leading-[1.55] text-white/45">
                  Escolha no catálogo e publique direto no Mercado Livre.
                </p>
              </div>
            </Link>
          </div>

          <div className="my-5 flex items-center gap-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/25">
            <span className="h-px flex-1 bg-white/[0.08]" />
            ou
            <span className="h-px flex-1 bg-white/[0.08]" />
          </div>

          <Link
            to="/onboarding/escolher-produto"
            className="group flex w-full items-center gap-4 rounded-[6px] bg-white/[0.025] p-4 text-left outline-none transition hover:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-wait disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] bg-white/[0.05] text-white/55">
              <FlaskConical size={18} strokeWidth={1.7} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium tracking-[-0.02em] text-white/78">Testar com um produto de exemplo</span>
              <span className="mt-1 block text-[12px] leading-relaxed text-white/38">Veja como funciona antes de importar seus próprios produtos.</span>
            </span>
            <ArrowUpRight size={16} className="shrink-0 text-white/20 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white/60" />
          </Link>
        </div>
      </section>

      <aside className="relative hidden min-h-screen items-center justify-center overflow-hidden bg-[#010101] lg:flex">
        <div className="absolute inset-0 [background-image:radial-gradient(circle,rgba(255,255,255,0.16)_1px,transparent_1.2px)] [background-position:2px_2px] [background-size:32px_32px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,transparent_0%,rgba(0,0,0,0.08)_48%,rgba(0,0,0,0.55)_100%)]" />
        <StoreMockupPreview className="relative z-10" />
      </aside>
    </div>
  </main>
  );
};
    </div>
  </main>
  );
};

export default StartChoicePage;
