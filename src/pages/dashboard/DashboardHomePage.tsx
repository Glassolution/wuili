import { AlertTriangle, BookOpen, Briefcase, Home, Package, Search } from "lucide-react";

const DASHBOARD_IMAGE_SRC = "/assets/dashboard-inicio-colado.png";

const metricCards = [
  {
    left: "3.4%",
    icon: Package,
    title: "Produtos na biblioteca",
    value: "36.013.057",
    description: "Total de produtos rastreados na Biblioteca de Produtos.",
  },
  {
    left: "27.1%",
    icon: BookOpen,
    title: "Anuncios monitorados",
    value: "23.543.955",
    description: "Total de anuncios rastreados na Biblioteca de Anuncios.",
  },
  {
    left: "50.8%",
    icon: Briefcase,
    title: "Produtos no portfolio",
    value: "7,716",
    description: "Total de produtos vencedores adicionados ao seu portfolio.",
  },
  {
    left: "74.5%",
    icon: Search,
    title: "Produtos Shopify",
    value: "773.023.500",
    description: "Total de listagens Shopify monitoradas na pesquisa de concorrentes.",
  },
];

const toolCards = [
  {
    left: "7.9%",
    title: "Biblioteca de Produtos",
    badge: "NOVO",
    description: "Descubra produtos vencedores e analise o potencial de receita.",
  },
  {
    left: "26.2%",
    title: "Busca com IA",
    badge: "NOVO",
    description: "Encontre produtos e ofertas promissoras com inteligencia artificial.",
  },
  {
    left: "43.8%",
    title: "Sistema de indicacao",
    description: "Convide amigos e ganhe beneficios recorrentes na sua conta.",
  },
  {
    left: "62.2%",
    title: "Biblioteca de Anuncios",
    description: "Analise anuncios e produtos com maior tracao no mercado.",
  },
  {
    left: "79.2%",
    title: "Pesquisa de Concorrentes",
    description: "Encontre lojas, produtos e oportunidades com poucos cliques.",
  },
];

const friendCards = [0, 1, 2, 3, 4];

export const MobileResultsOverview = () => <DashboardHomePage />;

const DashboardHomePage = () => {
  return (
    <main className="-m-5 min-h-[calc(100%+2.5rem)] bg-white sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]">
      <section className="relative w-full overflow-hidden bg-white text-[#252936]">
        <img
          src={DASHBOARD_IMAGE_SRC}
          alt=""
          className="block h-auto w-full select-none"
          draggable={false}
        />

        <div className="pointer-events-none absolute inset-0 font-sans">
          <div className="absolute inset-x-0 top-0 h-[35.2%] bg-white" />

          <div className="absolute left-[0.7%] top-[1.5%] h-[7.6%] w-[98.6%] rounded-t-[1vw] border-b border-black/[0.07] bg-[#fff5f6]">
            <AlertTriangle
              className="absolute left-[2.55%] top-1/2 h-[clamp(16px,1.65vw,32px)] w-[clamp(16px,1.65vw,32px)] -translate-y-1/2 text-[#e8c74d]"
              strokeWidth={1.8}
            />
            <p className="absolute left-[5.45%] top-1/2 max-w-[83%] -translate-y-1/2 text-[clamp(8px,0.82vw,16px)] font-semibold leading-[1.35] text-[#2f333c]">
              A Dropship passara por manutencao programada em 27 de agosto, das 7:00 as 10:00 UTC. Durante esse periodo, a plataforma ficara indisponivel.
              <br />
              Planeje-se com antecedencia. Agradecemos pela paciencia e compreensao.
            </p>
          </div>

          <div className="absolute left-[0.7%] top-[9.1%] h-[9.0%] w-[98.6%] border-b border-black/[0.06] bg-white">
            <span className="absolute left-[2.45%] top-1/2 flex h-[clamp(22px,2.2vw,42px)] w-[clamp(22px,2.2vw,42px)] -translate-y-1/2 items-center justify-center rounded-[0.45vw] bg-black text-white shadow-[0_0.45vw_0.95vw_rgba(0,0,0,0.16)]">
              <Home className="h-[55%] w-[55%]" fill="currentColor" strokeWidth={2} />
            </span>
            <div className="absolute left-[5.45%] top-1/2 flex -translate-y-1/2 items-baseline gap-[0.55vw]">
              <span className="text-[clamp(10px,0.9vw,18px)] font-bold text-[#252936]">Painel</span>
              <span className="text-[clamp(9px,0.82vw,16px)] font-medium text-[#676d79]">Visao geral das nossas solucoes</span>
            </div>
          </div>

          <div className="absolute left-[0.7%] top-[18.1%] h-[17.0%] w-[98.6%] border-b border-black/[0.06] bg-white">
            <span className="absolute left-[25.2%] top-[16%] h-[66%] w-px bg-black/[0.07]" />
            <span className="absolute left-[49.0%] top-[16%] h-[66%] w-px bg-black/[0.07]" />
            <span className="absolute left-[72.8%] top-[16%] h-[66%] w-px bg-black/[0.07]" />
            {metricCards.map((card) => {
              const Icon = card.icon;

              return (
                <div key={card.title} className="absolute top-[20%] w-[19.0%]" style={{ left: card.left }}>
                  <div className="flex items-center gap-[0.45vw] text-[clamp(8px,0.78vw,15px)] font-semibold leading-none text-[#8f95a3]">
                    <Icon className="h-[clamp(11px,1.05vw,20px)] w-[clamp(11px,1.05vw,20px)] text-[#c3c8d4]" strokeWidth={1.9} />
                    <span>{card.title}</span>
                  </div>
                  <p className="mt-[0.75vw] text-[clamp(16px,1.65vw,32px)] font-semibold leading-none text-black">{card.value}</p>
                  <p className="mt-[0.9vw] text-[clamp(8px,0.82vw,16px)] font-medium leading-[1.36] text-[#6f7582]">{card.description}</p>
                </div>
              );
            })}
          </div>

          <div className="absolute left-[4.8%] top-[36.8%] h-[30.0%] w-[33.4%] bg-white" />
          <div className="absolute left-[36.9%] top-[35.2%] h-[5.5%] w-[20.4%] bg-white" />
          <div className="absolute left-[6.55%] top-[38.5%] h-[27.2%] w-[30.6%] overflow-hidden rounded-[1.05vw] border border-black/[0.06] bg-white shadow-[0_0.65vw_1.5vw_rgba(15,23,42,0.045)]">
            <div className="absolute inset-x-[5.5%] top-[13.5%] flex items-start justify-between">
              {friendCards.map((item) => {
                const isActive = item === 2;

                return (
                  <div
                    key={item}
                    className={`flex w-[17%] flex-col items-center rounded-[0.55vw] bg-white py-[0.68vw] ${
                      isActive
                        ? "border border-black/[0.12] shadow-[0_0.5vw_1.2vw_rgba(0,0,0,0.08)]"
                        : "opacity-35"
                    }`}
                  >
                    <span
                      className={`relative flex h-[clamp(16px,1.75vw,34px)] w-[clamp(16px,1.75vw,34px)] items-center justify-center rounded-full ${
                        isActive ? "bg-black" : "bg-[#eef1f7]"
                      }`}
                    >
                      <span className="absolute top-[22%] h-[24%] w-[24%] rounded-full bg-white" />
                      <span className="absolute bottom-[22%] h-[29%] w-[54%] rounded-t-full bg-white" />
                    </span>
                    <span className={`mt-[0.35vw] text-[clamp(7px,0.72vw,14px)] font-semibold ${isActive ? "text-[#242832]" : "text-[#8e98ad]"}`}>
                      Amigo
                    </span>
                    <span className={`mt-[0.2vw] text-[clamp(7px,0.72vw,14px)] font-bold ${isActive ? "text-[#14a06f]" : "text-[#9fdac8]"}`}>
                      +$20.00
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="absolute -bottom-[5%] left-[6%] right-[5%] h-[35%]">
              {[0, 1, 2, 3, 4, 5].map((item) => (
                <span
                  key={item}
                  className="absolute bottom-0 flex h-[64%] w-[25%] items-center justify-center rounded-[0.18vw] bg-black shadow-[0_0.4vw_0.7vw_rgba(0,0,0,0.12)]"
                  style={{
                    left: `${item * 14}%`,
                    transform: `rotate(${[-8, 6, -4, 3, -5, 7][item]}deg)`,
                  }}
                >
                  <span className="absolute left-[7%] top-[10%] h-[16%] w-[12%] border-l-[0.22vw] border-t-[0.22vw] border-white/95" />
                  <span className="absolute bottom-[10%] right-[7%] h-[16%] w-[12%] border-b-[0.22vw] border-r-[0.22vw] border-white/95" />
                  <span className="flex h-[44%] w-[28%] items-center justify-center rounded-full bg-white text-[clamp(7px,0.95vw,18px)] font-black text-black">
                    $
                  </span>
                </span>
              ))}
            </div>
          </div>

          <div className="absolute left-[38.6%] top-[39.4%] h-[22.2%] w-[53.0%] bg-white" />

          <div className="absolute left-[39.1%] top-[40.9%] flex items-center gap-[2.1vw]">
            <span className="rounded-[0.38vw] bg-[#f1f2f4] px-[0.58vw] py-[0.27vw] text-[clamp(7px,0.66vw,13px)] font-semibold text-black">
              Sistema de indicacao
            </span>
            <span className="text-[clamp(7px,0.66vw,13px)] font-semibold text-[#606876]">0 indicacoes</span>
          </div>

          <h1 className="absolute left-[39.1%] top-[44.6%] max-w-[51.5%] text-[clamp(16px,1.52vw,30px)] font-semibold leading-[1.16] tracking-[-0.022em] text-[#272b34]">
            Convide amigos e ganhe 15% sobre as compras deles
          </h1>

          <p className="absolute left-[39.1%] top-[51.8%] max-w-[44.5%] text-[clamp(8px,0.82vw,16px)] font-medium leading-[1.42] text-[#666d7a]">
            Compartilhe seu link exclusivo e receba recompensas quando seus amigos entrarem na Dropship e completarem a primeira assinatura. Quanto mais indicacoes, maior o retorno.
          </p>

          <span className="absolute left-[39.35%] top-[60.9%] z-20 flex h-[clamp(22px,2.22vw,42px)] items-center rounded-[0.48vw] bg-black px-[0.95vw] text-[clamp(8px,0.82vw,16px)] font-semibold text-white shadow-[0_0.55vw_1.1vw_rgba(0,0,0,0.16)]">
            Convidar amigo
          </span>

          <div className="absolute left-[42.4%] top-[63.9%] z-0 h-[5.6%] w-[11.4%] bg-white" />
          <div className="absolute left-[45.0%] top-[71.1%] z-10 h-[3.2%] w-[6.0%] rounded-full bg-white shadow-[0_0.35vw_1vw_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05]">
            <span className="absolute left-[20%] top-1/2 h-[clamp(7px,0.65vw,13px)] w-[clamp(7px,0.65vw,13px)] -translate-y-1/2 rounded-full bg-black shadow-[0_0.15vw_0.4vw_rgba(0,0,0,0.16)]" />
            <span className="absolute left-[45%] top-1/2 h-[clamp(7px,0.65vw,13px)] w-[clamp(7px,0.65vw,13px)] -translate-y-1/2 rounded-full bg-[#dfe1e6]" />
            <span className="absolute left-[70%] top-1/2 h-[clamp(7px,0.65vw,13px)] w-[clamp(7px,0.65vw,13px)] -translate-y-1/2 rounded-full bg-[#dfe1e6]" />
          </div>

          <div className="absolute left-[2.65%] top-[75.2%] bg-white/90 pr-[1.5vw]">
            <h2 className="text-[clamp(12px,1.08vw,21px)] font-semibold tracking-[-0.02em] text-[#262b35]">Explore nossas ferramentas</h2>
            <p className="mt-[0.45vw] text-[clamp(8px,0.82vw,16px)] font-medium text-[#606876]">Um guia pratico para usar as solucoes da plataforma</p>
          </div>

          {toolCards.map((card) => (
            <div key={card.title} className="absolute top-[91.55%] w-[13.8%]" style={{ left: card.left }}>
              <div className="flex items-start justify-between gap-[0.5vw]">
                <h3 className="text-[clamp(9px,1.02vw,20px)] font-semibold leading-[1.08] tracking-[-0.018em] text-[#242832]">{card.title}</h3>
                {card.badge ? (
                  <span className="rounded-[0.32vw] bg-[#f1f2f4] px-[0.4vw] py-[0.16vw] text-[clamp(6px,0.58vw,11px)] font-bold text-black">
                    {card.badge}
                  </span>
                ) : null}
              </div>
              <p className="mt-[0.72vw] text-[clamp(7px,0.72vw,14px)] font-medium leading-[1.36] text-[#68707d]">{card.description}</p>
            </div>
          ))}

          <span className="absolute bottom-[4.85%] right-[9.1%] text-[clamp(8px,0.82vw,16px)] font-semibold text-white">
            Comecando
          </span>
        </div>
      </section>
    </main>
  );
};

export default DashboardHomePage;
