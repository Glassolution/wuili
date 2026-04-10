import { Link } from "react-router-dom";

/* ─── Data ─── */
const sidebarItems = ["Novo chat", "Automacoes", "Skills", "Wuilli", "Landing principal", "Revisar anuncios"];
const activityRows = [
  "Vou simplificar o hero e reforcar a clareza da proposta.",
  "Ajustei a hierarquia visual para um visual mais leve.",
  "CTA principal mais direto e sem ruido.",
];
const codeLines = [
  'export const hero = {',
  '  title: "Wuilli",',
  '  subtitle: "Sua operacao automatizada por IA.",',
  '  primaryCta: "Criar workspace",',
  '};',
];

const testimonials = [
  { name: "João Mendes", role: "Empreendedor, Fortaleza", text: "Tentei dropshipping três vezes antes e desisti sempre na hora de criar os anúncios. Com a Wuilli, publiquei meu primeiro produto em menos de 5 minutos.", img: "JM" },
  { name: "Camila Souza", role: "Vendedora, São Paulo", text: "No primeiro mês faturei R$ 3.200. Não sei nada de e-commerce. A IA escolheu os produtos, criou os anúncios e ajustou os preços. Eu só aprovei.", img: "CS" },
  { name: "Rafael Teixeira", role: "Freelancer, BH", text: "Trabalho 8h por dia e não tenho tempo pra aprender dropshipping do zero. A Wuilli resolveu isso. Renda extra de verdade, sem virar meu segundo emprego.", img: "RT" },
  { name: "Ana Clara", role: "Estudante, Curitiba", text: "Comecei sem investir nada e já no segundo mês estava tirando R$ 1.800 líquido. A IA faz tudo: acha produto, cria anúncio e ajusta preço.", img: "AC" },
  { name: "Lucas Ferreira", role: "Gestor de tráfego, RJ", text: "A Wuilli automatizou toda a parte de catálogo que eu fazia manualmente. Agora consigo escalar muito mais rápido e focar no que importa.", img: "LF" },
  { name: "Mariana Lima", role: "Designer, Recife", text: "Nunca imaginei vender online. Em 20 minutos a IA já tinha criado 3 anúncios profissionais no Mercado Livre. Fiquei impressionada.", img: "ML" },
];

const logos = ["Mercado Livre", "Shopee", "AliExpress", "Shopify", "WooCommerce", "Pix", "Stripe"];

const featureCards = [
  { title: "Comece pelo app da Wuilli", desc: "Acesse o workspace, escolha seu nicho e deixe a IA criar anúncios automaticamente.", cta: "Criar workspace" },
  { title: "Vá para o catálogo", desc: "Explore milhares de produtos com margem calculada e publique com um clique.", cta: "Explorar catálogo" },
  { title: "Continue pelo chat", desc: "Converse com a IA para encontrar produtos, ajustar preços e resolver dúvidas.", cta: "Abrir chat IA" },
];

/* ─── Component ─── */
const Index = () => {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-['Manrope']">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4 md:px-8">
          <div className="flex items-center gap-10">
            <Link to="/" className="text-[17px] font-semibold tracking-[-0.01em] text-white">
              Wuilli
            </Link>
            <nav className="hidden items-center gap-7 text-[14px] font-normal text-white/60 md:flex">
              <a href="#como-funciona" className="transition hover:text-white">Como funciona</a>
              <a href="#plataformas" className="transition hover:text-white">Plataformas</a>
              <a href="#depoimentos" className="transition hover:text-white">Resultados</a>
              <a href="#planos" className="transition hover:text-white">Planos</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden text-[14px] text-white/60 transition hover:text-white md:inline-flex">
              Entrar
            </Link>
            <Link to="/cadastro" className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.15] bg-transparent px-4 py-2.5 text-[13.5px] font-medium text-white transition hover:bg-white/10">
              Criar workspace
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-[1280px] px-6 pb-24 pt-20 md:px-8 md:pb-32 md:pt-28">
        <h1 className="mx-auto max-w-[900px] text-center font-['Sora'] text-[clamp(2.6rem,5.5vw,4.2rem)] font-medium leading-[1.08] tracking-[-0.04em]">
          Sua operação de vendas online, automatizada por IA
        </h1>

        {/* Split: text left + visual right */}
        <div className="mt-20 grid items-start gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-16">
          <div className="flex flex-col justify-center pt-4 lg:pt-16">
            <h2 className="font-['Sora'] text-[clamp(1.6rem,3vw,2.4rem)] font-medium leading-[1.15] tracking-[-0.03em]">
              Feito para impulsionar vendas de verdade
            </h2>
            <p className="mt-5 max-w-[480px] text-[15px] leading-[1.7] text-white/50">
              De encontrar produtos lucrativos aos seus primeiros anúncios no ar, a Wuilli conclui tarefas ponta a ponta com confiabilidade — como criar anúncios, ajustar preços, monitorar concorrentes e muito mais — com inteligência artificial de ponta.
            </p>
          </div>

          {/* Gradient visual card */}
          <div className="relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #818cf8 40%, #c4b5fd 70%, #e0e7ff 100%)" }}>
            <div className="flex min-h-[480px] items-end justify-center p-6 pt-20">
              {/* Mock chat UI */}
              <div className="w-full max-w-[380px] overflow-hidden rounded-xl bg-[#1a1a1a]/95 shadow-2xl">
                <div className="px-5 py-4">
                  <div className="mb-3 ml-auto w-fit max-w-[240px] rounded-xl bg-white/10 px-4 py-3 text-[13px] leading-[1.5] text-white/90">
                    Encontre produtos de eletrônicos com margem acima de 40%
                  </div>
                  <p className="text-[13px] leading-[1.6] text-white/60">
                    Vou analisar o mercado de eletrônicos, filtrar os produtos com maior margem e preparar os anúncios para publicação.
                  </p>
                  <p className="mt-2 text-[11px] text-white/30">Pensando 4s</p>
                </div>
                <div className="border-t border-white/[0.08] px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-[12px] text-white/40">
                      <span>+</span>
                      <span>Wuilli IA</span>
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8l5 5 5-5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Logos strip ── */}
      <div className="border-y border-white/[0.06]">
        <div className="mx-auto flex max-w-[1280px] items-center gap-16 overflow-hidden px-6 py-8 md:px-8">
          {logos.map((logo) => (
            <span key={logo} className="flex-shrink-0 text-[15px] font-bold tracking-wide text-white/20">
              {logo}
            </span>
          ))}
        </div>
      </div>

      {/* ── Feature: background work ── */}
      <section id="como-funciona" className="mx-auto max-w-[1280px] px-6 py-24 md:px-8 md:py-32">
        <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          {/* Gradient visual card LEFT */}
          <div className="relative overflow-hidden rounded-2xl" style={{ background: "linear-gradient(135deg, #4338ca 0%, #6366f1 35%, #818cf8 65%, #a78bfa 100%)" }}>
            <div className="flex min-h-[480px] items-center justify-center p-8">
              {/* Task list UI */}
              <div className="w-full max-w-[400px] overflow-hidden rounded-xl bg-[#1a1a1a]/95 p-5 shadow-2xl">
                <div className="mb-4 text-[12px] font-medium text-white/40">Próximas tarefas</div>
                {[
                  { task: "Verificar estoque fornecedor", status: "Em andamento", badge: "bg-green-500/20 text-green-400" },
                  { task: "Ajustar preço competitivo", status: "Começa em 13m", badge: "bg-blue-500/20 text-blue-400" },
                  { task: "Publicar 3 novos anúncios", status: "Começa em 4h", badge: "bg-purple-500/20 text-purple-400" },
                  { task: "Responder perguntas ML", status: "Começa em 3d", badge: "bg-orange-500/20 text-orange-400" },
                ].map((item) => (
                  <div key={item.task} className="flex items-center justify-between border-b border-white/[0.06] py-3 last:border-0">
                    <span className="text-[13px] text-white/80">{item.task}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${item.badge}`}>{item.status}</span>
                  </div>
                ))}
                <div className="mt-4 text-[12px] font-medium text-white/40">Concluído</div>
                {[
                  { task: "Análise de tendências semanal", time: "1d" },
                  { task: "Criação automática de anúncio", time: "1d" },
                ].map((item) => (
                  <div key={item.task} className="flex items-center justify-between border-b border-white/[0.06] py-3 last:border-0">
                    <span className="text-[13px] text-white/50">{item.task}</span>
                    <span className="text-[11px] text-white/30">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Text RIGHT */}
          <div className="flex flex-col justify-center pt-4 lg:pt-16">
            <h2 className="font-['Sora'] text-[clamp(1.6rem,3vw,2.4rem)] font-medium leading-[1.15] tracking-[-0.03em]">
              Feito para trabalhar em segundo plano, sempre
            </h2>
            <p className="mt-5 max-w-[480px] text-[15px] leading-[1.7] text-white/50">
              Com as automações, a Wuilli trabalha sem você precisar pedir, assumindo tarefas rotineiras mas importantes como monitoramento de preços, ajuste de estoque, respostas a compradores e mais — para você continuar focado em escalar.
            </p>
          </div>
        </div>
      </section>

      {/* ── Platforms section (3 cards) ── */}
      <section id="plataformas" className="mx-auto max-w-[1280px] px-6 py-24 md:px-8 md:py-32">
        <div className="mx-auto max-w-[700px] text-center">
          <h2 className="font-['Sora'] text-[clamp(1.6rem,3vw,2.4rem)] font-medium italic leading-[1.15] tracking-[-0.03em]">
            O mesmo agente em qualquer plataforma que você vende
          </h2>
          <p className="mt-4 text-[15px] leading-[1.7] text-white/50">
            Use a Wuilli em várias interfaces, todas conectadas pela sua conta.
          </p>
          <Link to="/cadastro" className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-white/[0.15] px-5 py-3 text-[13.5px] font-medium text-white transition hover:bg-white/10">
            Começar agora
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {featureCards.map((card, i) => (
            <div key={card.title} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-[#111]">
              {/* Card gradient top */}
              <div className="h-[240px]" style={{
                background: i === 0
                  ? "linear-gradient(135deg, #312e81 0%, #6366f1 50%, #a78bfa 100%)"
                  : i === 1
                  ? "linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #93c5fd 100%)"
                  : "linear-gradient(135deg, #4338ca 0%, #7c3aed 50%, #c4b5fd 100%)"
              }}>
                <div className="flex h-full items-center justify-center">
                  <div className="w-[200px] rounded-lg bg-[#1a1a1a]/80 p-4 shadow-xl">
                    <div className="mb-2 flex gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                      <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                      <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="text-[11px] text-white/60">{i === 2 ? "> wuilli chat" : "Wuilli"}</div>
                    <div className="mt-2 h-2 w-3/4 rounded bg-white/10" />
                    <div className="mt-1.5 h-2 w-1/2 rounded bg-white/10" />
                  </div>
                </div>
              </div>
              <div className="p-6">
                <h3 className="font-['Sora'] text-[16px] font-medium tracking-[-0.02em]">{card.title}</h3>
                <p className="mt-2 text-[13px] leading-[1.6] text-white/50">{card.desc}</p>
                <button className="mt-5 w-full rounded-full border border-white/[0.12] bg-transparent py-3 text-[13px] font-medium text-white transition hover:bg-white/[0.06]">
                  {card.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section id="depoimentos" className="mx-auto max-w-[1280px] px-6 py-24 md:px-8 md:py-32">
        <h2 className="mx-auto mb-16 max-w-[600px] text-center font-['Sora'] text-[clamp(1.6rem,3vw,2.4rem)] font-medium leading-[1.15] tracking-[-0.03em]">
          O que nossos usuários estão dizendo
        </h2>

        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] md:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-[#0a0a0a] p-8">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-white/10 font-['Sora'] text-[14px] font-bold text-white/70">
                {t.img}
              </div>
              <p className="text-[14px] leading-[1.7] text-white/80">"{t.text}"</p>
              <p className="mt-6 text-[13px] text-white/40">{t.name}, {t.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-32 text-center md:py-44">
        <h2 className="font-['Sora'] text-[clamp(2rem,4vw,3.2rem)] font-medium tracking-[-0.03em]">
          Experimente a Wuilli hoje
        </h2>
        <p className="mx-auto mt-4 max-w-[480px] text-[15px] leading-[1.7] text-white/50">
          Um agente de vendas que ajuda você a publicar e vender no e-commerce com IA — automatizado ponta a ponta.
        </p>
        <Link to="/cadastro" className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-white px-7 py-4 text-[14px] font-medium text-[#0a0a0a] transition hover:bg-white/90">
          Criar workspace
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M5 11 11 5M6 5h5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] px-6 py-10 md:px-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-6 md:flex-row">
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Wuilli</span>
          <span className="text-[13px] text-white/30">© 2025 Wuilli. Todos os direitos reservados.</span>
          <div className="flex gap-7">
            <a href="#" className="text-[13px] text-white/30 transition hover:text-white/60">Termos</a>
            <a href="#" className="text-[13px] text-white/30 transition hover:text-white/60">Privacidade</a>
            <a href="#" className="text-[13px] text-white/30 transition hover:text-white/60">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
