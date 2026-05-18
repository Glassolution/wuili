import { useNavigate } from "react-router-dom";

type IconName = "search" | "supplier" | "sale";

const howItWorks = [
  {
    icon: "search" as const,
    title: "Encontre um produto viral",
    text: "Descubra produtos com sinais reais de demanda para começar com mais clareza.",
  },
  {
    icon: "supplier" as const,
    title: "Veja fornecedores e dados",
    text: "Entenda preço, margem e fornecedores sem precisar ser especialista.",
  },
  {
    icon: "sale" as const,
    title: "Comece sua primeira venda",
    text: "Dê o primeiro passo com uma direção simples, prática e possível.",
  },
];

function VeloLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-black shadow-[0_14px_40px_rgba(255,255,255,0.08)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M16.5 7.6A6.4 6.4 0 1 0 16.5 16.4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="2.35"
          />
          <path
            d="M14.4 14.1L17.2 16.8L20 14.1"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.05"
          />
        </svg>
      </div>
      <span className="text-[22px] font-semibold tracking-[-0.04em] text-white">Velo</span>
    </div>
  );
}

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  if (name === "search") {
    return (
      <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 16L20 20" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      </svg>
    );
  }

  if (name === "supplier") {
    return (
      <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 9.5L12 5L20 9.5V18.5L12 23L4 18.5V9.5Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
        <path d="M4.5 10L12 14.3L19.5 10M12 14.3V22" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
      </svg>
    );
  }

  return (
    <svg className={`h-5 w-5 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 17.5L9.5 13L13 15.8L19 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M17 8H19V10" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

export default function Index() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen overflow-x-hidden bg-black font-sans text-white">
      <section className="relative min-h-screen overflow-hidden bg-black">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-70"
          style={{
            backgroundImage:
              "url('/hero-bg.jpg'), url('https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=2400&q=85')",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/75 to-black/20" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" aria-hidden="true" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_35%,rgba(79,124,255,0.12),transparent_34%)]" aria-hidden="true" />

        <header className="relative z-20 mx-auto flex w-full max-w-[1280px] items-center justify-between px-5 py-6 sm:px-8 lg:px-10">
          <button type="button" onClick={() => navigate("/")} aria-label="Velo" className="rounded-2xl">
            <VeloLogo />
          </button>

          <nav className="hidden items-center gap-8 text-[14px] font-medium text-white/68 lg:flex">
            <a className="transition hover:text-white" href="#como-funciona">Como funciona</a>
            <a className="transition hover:text-white" href="#produtos">Produtos</a>
            <a className="transition hover:text-white" href="#fornecedores">Fornecedores</a>
            <a className="transition hover:text-white" href="#precos">Preços</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="hidden h-12 items-center rounded-full px-5 text-[15px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white sm:inline-flex"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => navigate("/cadastro")}
              className="inline-flex h-12 items-center rounded-full bg-white px-5 text-[15px] font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white/90 sm:px-7"
            >
              Começar gratuitamente
            </button>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-96px)] w-full max-w-[1280px] items-center px-5 pb-24 pt-14 sm:px-8 lg:px-10">
          <div className="max-w-[820px]">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[13px] font-medium text-white/82 shadow-[0_18px_60px_rgba(0,0,0,0.28)] backdrop-blur-md">
              🚀 Produtos virais atualizados diariamente
            </div>

            <h1 className="mt-8 max-w-[980px] text-[clamp(4rem,8vw,7rem)] font-light leading-[0.95] tracking-[-0.06em] text-white">
              Sua primeira venda está mais perto do que parece.
            </h1>

            <p className="mt-7 max-w-[560px] text-[20px] font-normal leading-8 text-white/78 sm:text-[22px] sm:leading-9">
              Encontre produtos virais e comece sua jornada no dropshipping mesmo sem experiência.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/cadastro")}
                className="inline-flex h-16 items-center justify-center rounded-full bg-white px-9 text-[17px] font-semibold text-black transition hover:-translate-y-0.5 hover:bg-white/90"
              >
                Começar gratuitamente
              </button>
              <a
                href="#como-funciona"
                className="inline-flex h-16 items-center justify-center rounded-full border border-white/60 bg-white/[0.03] px-9 text-[17px] font-semibold text-white backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white/10"
              >
                Ver como funciona
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="relative bg-black px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-[48px] bg-black" />
        <div className="relative mx-auto max-w-[1280px]">
          <div className="max-w-[720px]">
            <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-[#4F7CFF]">Como funciona</div>
            <h2 className="mt-5 text-[clamp(2.7rem,5vw,5.2rem)] font-light leading-[0.98] tracking-[-0.06em] text-white">
              Um começo simples para quem nunca vendeu online.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {howItWorks.map((step, index) => (
              <article
                key={step.title}
                className="rounded-[32px] border border-white/[0.08] bg-[#0B0B0B] p-7 shadow-[0_24px_70px_rgba(0,0,0,0.2)] transition duration-300 hover:-translate-y-1 hover:border-white/16 hover:bg-[#111111]"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[#4F7CFF]">
                    <Icon name={step.icon} />
                  </div>
                  <span className="text-[13px] font-medium text-white/26">0{index + 1}</span>
                </div>
                <h3 className="mt-8 text-[25px] font-normal leading-[1.08] tracking-[-0.04em] text-white">{step.title}</h3>
                <p className="mt-4 text-[15px] leading-7 text-white/58">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] bg-black px-5 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4 text-[13px] text-white/42 sm:flex-row sm:items-center sm:justify-between">
          <VeloLogo />
          <span>© 2026 Velo. Sua primeira venda começa com o produto certo.</span>
        </div>
      </footer>
    </main>
  );
}
