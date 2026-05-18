import { useNavigate } from "react-router-dom";

type IconName = "search" | "supplier" | "sale" | "spark" | "chart" | "package";

const productCards = [
  {
    name: "Mini Impressora Térmica",
    metric: "Preço médio R$49",
    result: "Potencial +R$18.240",
    accent: "bg-[#4F7CFF]",
  },
  {
    name: "Luminária LED",
    metric: "Alta demanda",
    result: "+214%",
    accent: "bg-white",
  },
  {
    name: "Garrafa portátil",
    metric: "Baixa concorrência",
    result: "Score 91",
    accent: "bg-[#4F7CFF]",
  },
];

const insightCards = [
  "Produto viral detectado",
  "Fornecedor encontrado",
  "Baixa concorrência",
];

const socialProof = [
  "+12.000 produtos analisados",
  "Atualizado diariamente",
  "Feito para iniciantes",
];

const howItWorks = [
  {
    icon: "search" as const,
    title: "Encontre um produto viral",
    text: "Veja oportunidades com demanda real antes de apostar tempo e dinheiro.",
  },
  {
    icon: "supplier" as const,
    title: "Veja fornecedores e dados",
    text: "Compare preço, margem, concorrência e sinais de venda em poucos segundos.",
  },
  {
    icon: "sale" as const,
    title: "Comece sua primeira venda",
    text: "Publique com mais confiança e dê o primeiro passo sem experiência prévia.",
  },
];

function VeloLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white text-black shadow-[0_16px_40px_rgba(255,255,255,0.08)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M16.5 7.6A6.4 6.4 0 1 0 16.5 16.4"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M14.4 14.1L17.2 16.8L20 14.1"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-[22px] font-semibold tracking-[-0.04em] text-white">Velo</span>
    </div>
  );
}

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const common = "h-5 w-5";

  if (name === "search") {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M16 16L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "supplier") {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 9.5L12 5L20 9.5V18.5L12 23L4 18.5V9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M4.5 10L12 14.3L19.5 10M12 14.3V22" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "sale") {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 17.5L9.5 13L13 15.8L19 8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 8H19V10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 19V11M12 19V5M19 19V8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === "package") {
    return (
      <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 8L12 4L19 8V16L12 20L5 16V8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="M5.5 8.5L12 12.2L18.5 8.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={`${common} ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3L13.8 8.9L20 10.5L14.6 13.8L16 20L12 15.8L8 20L9.4 13.8L4 10.5L10.2 8.9L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function PlatformMockup() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-[620px] lg:mt-0">
      <div className="absolute -left-10 top-8 hidden h-40 w-40 rounded-full bg-[#4F7CFF]/20 blur-3xl sm:block" />
      <div className="absolute -right-8 bottom-4 h-52 w-52 rounded-full bg-[#4F7CFF]/10 blur-3xl" />

      <div className="relative rounded-[32px] border border-white/[0.08] bg-[#0B0B0B]/90 p-3 shadow-[0_40px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="rounded-[26px] border border-white/[0.06] bg-[#111111] p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
            <div>
              <div className="text-[12px] font-medium uppercase tracking-[0.2em] text-white/36">Radar de oportunidades</div>
              <div className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-white">Produtos certos para começar</div>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-[#4F7CFF]/20 bg-[#4F7CFF]/10 px-3 py-2 text-[12px] font-medium text-[#AFC0FF] sm:flex">
              <span className="h-2 w-2 rounded-full bg-[#4F7CFF] shadow-[0_0_18px_rgba(79,124,255,0.8)]" />
              ao vivo
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {productCards.map((product, index) => (
              <article
                key={product.name}
                className="group grid grid-cols-[56px_1fr_auto] items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-[#4F7CFF]/35 hover:bg-white/[0.055]"
              >
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04]">
                  <div className={`absolute left-3 top-3 h-8 w-8 rounded-xl ${product.accent} opacity-90`} />
                  <div className="absolute bottom-2 right-2 h-5 w-5 rounded-lg border border-white/20 bg-white/20 backdrop-blur" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-white">{product.name}</div>
                  <div className="mt-1 text-[12px] text-white/48">{product.metric}</div>
                </div>
                <div className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${index === 1 ? "bg-white text-black" : "bg-[#4F7CFF]/14 text-[#AFC0FF]"}`}>
                  {product.result}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { label: "Margem", value: "42%", icon: "chart" as const },
              { label: "Demanda", value: "Alta", icon: "spark" as const },
              { label: "Fornec.", value: "12", icon: "package" as const },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-black/24 p-3">
                <Icon name={item.icon} className="text-[#4F7CFF]" />
                <div className="mt-4 text-[18px] font-semibold tracking-[-0.04em] text-white">{item.value}</div>
                <div className="mt-0.5 text-[11px] text-white/40">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute -left-2 -top-5 hidden rounded-2xl border border-white/[0.08] bg-[#111111]/90 px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:block">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
          <span className="h-2 w-2 rounded-full bg-[#4F7CFF]" />
          Produto viral detectado
        </div>
      </div>

      <div className="absolute -right-1 top-28 hidden rounded-2xl border border-white/[0.08] bg-[#111111]/90 px-4 py-3 shadow-[0_20px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl md:block">
        <div className="text-[12px] text-white/44">Luminária LED</div>
        <div className="mt-1 text-[22px] font-semibold tracking-[-0.05em] text-white">+214%</div>
      </div>

      <div className="absolute -bottom-6 left-6 hidden gap-2 sm:flex">
        {insightCards.map((item) => (
          <div key={item} className="rounded-full border border-white/[0.08] bg-[#111111]/90 px-3 py-2 text-[12px] font-medium text-white/70 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Index() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#050505] font-sans text-white">
      <section className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top,rgba(79,124,255,0.15),transparent_40%),#050505]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_0%,rgba(255,255,255,0.035)_46%,transparent_72%)]" />
        <div className="pointer-events-none absolute left-1/2 top-[-18rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-[#4F7CFF]/10 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(circle_at_top,black,transparent_70%)]" />

        <header className="relative z-20 mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 py-5 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate("/")} aria-label="Velo" className="rounded-2xl">
            <VeloLogo />
          </button>

          <nav className="hidden items-center gap-8 text-[14px] font-medium text-white/58 lg:flex">
            <a className="transition hover:text-white" href="#como-funciona">Como funciona</a>
            <a className="transition hover:text-white" href="#produtos">Produtos</a>
            <a className="transition hover:text-white" href="#fornecedores">Fornecedores</a>
            <a className="transition hover:text-white" href="#precos">Preços</a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="hidden h-11 rounded-full px-5 text-[14px] font-medium text-white/68 transition hover:bg-white/[0.06] hover:text-white sm:inline-flex sm:items-center"
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => navigate("/cadastro")}
              className="inline-flex h-11 items-center rounded-full bg-white px-5 text-[14px] font-semibold text-black shadow-[0_10px_35px_rgba(255,255,255,0.08)] transition hover:-translate-y-0.5 hover:bg-white/90 sm:px-6"
            >
              Começar grátis
            </button>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-88px)] w-full max-w-[1180px] items-center gap-14 px-5 pb-20 pt-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:pb-24 lg:pt-10">
          <div className="max-w-[650px] text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3.5 py-2 text-[13px] font-medium text-white/76 shadow-[0_12px_48px_rgba(0,0,0,0.25)] backdrop-blur-xl">
              <Icon name="spark" className="text-[#4F7CFF]" />
              Produtos virais atualizados diariamente
            </div>

            <h1 className="mt-7 text-[clamp(3.2rem,7vw,6.9rem)] font-semibold leading-[0.88] tracking-[-0.08em] text-white">
              Sua primeira venda começa com o produto certo.
            </h1>

            <p className="mx-auto mt-7 max-w-[590px] text-[18px] leading-8 text-white/64 sm:text-[20px] lg:mx-0">
              Encontre produtos virais, fornecedores e oportunidades para começar no dropshipping mesmo sem experiência.
            </p>

            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <button
                type="button"
                onClick={() => navigate("/cadastro")}
                className="inline-flex h-14 items-center justify-center rounded-full bg-[#4F7CFF] px-8 text-[15px] font-semibold text-white shadow-[0_18px_60px_rgba(79,124,255,0.32)] transition hover:-translate-y-0.5 hover:bg-[#638cff]"
              >
                Começar gratuitamente
              </button>
              <button
                type="button"
                onClick={() => navigate("/cadastro?next=/dashboard/produtos")}
                className="inline-flex h-14 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] px-8 text-[15px] font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
              >
                Explorar produtos
              </button>
            </div>

            <div className="mt-8 flex flex-col items-center gap-3 text-[13px] font-medium text-white/48 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start">
              {socialProof.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#4F7CFF]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div id="produtos" className="relative">
            <PlatformMockup />
          </div>
        </div>
      </section>

      <section id="como-funciona" className="relative border-t border-white/[0.06] bg-[#050505] px-5 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(circle_at_center,rgba(79,124,255,0.1),transparent_58%)]" />
        <div className="relative mx-auto max-w-[1180px]">
          <div className="max-w-[620px]">
            <div className="text-[13px] font-medium uppercase tracking-[0.22em] text-[#4F7CFF]">Como funciona</div>
            <h2 className="mt-4 text-[clamp(2.4rem,5vw,4.6rem)] font-semibold leading-[0.95] tracking-[-0.07em] text-white">
              Três passos para sair do zero.
            </h2>
            <p className="mt-5 text-[17px] leading-8 text-white/54">
              A Velo simplifica a parte difícil: encontrar o produto, entender os dados e começar com uma direção clara.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {howItWorks.map((step, index) => (
              <article
                key={step.title}
                className="group rounded-[28px] border border-white/[0.08] bg-[#111111] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-[#4F7CFF]/35 hover:bg-[#131313]"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[#4F7CFF]">
                    <Icon name={step.icon} />
                  </div>
                  <span className="text-[13px] font-semibold text-white/22">0{index + 1}</span>
                </div>
                <h3 className="mt-8 text-[24px] font-semibold leading-[1.08] tracking-[-0.04em] text-white">{step.title}</h3>
                <p className="mt-4 text-[15px] leading-7 text-white/52">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] bg-[#050505] px-5 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 text-[13px] text-white/38 sm:flex-row sm:items-center sm:justify-between">
          <VeloLogo />
          <span>© 2026 Velo. Produtos certos para sua primeira venda.</span>
        </div>
      </footer>
    </main>
  );
}
