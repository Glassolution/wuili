import { useEffect, useLayoutEffect, useRef, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  FileText,
  Flame,
  FolderOpen,
  Image as ImageIcon,
  LayoutTemplate,
  Plus,
  Rocket,
  ScanFace,
  Search,
  ShoppingBag,
  Sprout,
  TrendingUp,
  UserRound,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserProjects } from "@/lib/userProjects";
import { ENTRADA_POS_ONBOARDING, hasPlayedDashboardIntro, markDashboardIntroAsPlayed } from "@/lib/dashboardIntro";
import { ONBOARDING_COMPLETED_EVENT, shouldShowOnboarding } from "@/components/onboarding/OnboardingModal";
import agenteEstrela from "@/assets/agentes/estrela.png";
import agenteLua from "@/assets/agentes/lua.png";
import agenteSino from "@/assets/agentes/sino.png";
import agenteConcha from "@/assets/agentes/concha.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import { ABRIR_BUSCA_EVENT } from "@/lib/abrirBusca";
import { useProfile } from "@/lib/profileContext";
import MobileHome from "@/components/dashboard/MobileHome";
import { useIsMobile } from "@/hooks/use-mobile";

// Curva das entradas: desaceleração suave, sem a cauda longa do ease-out exponencial.
const INTRO = {
  revealEase: [0.22, 1, 0.36, 1] as const,
  revealDuration: 0.7,
};

// Tokens da Início no layout de referência: fundo cinza-claro, cartões brancos
// bem arredondados, um cartão de destaque azul na grade.
const HOME_CSS = `
.velo-inicio-card { background: #FFFFFF; border-radius: 24px; transition: transform 180ms ease-out, box-shadow 180ms ease-out; }
.velo-inicio-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(16,24,40,0.07); }
.velo-inicio-card:focus-visible, .velo-inicio-tab:focus-visible, .velo-inicio-pill:focus-visible, .velo-inicio-search:focus-visible, .velo-inicio-plus:focus-visible, .velo-inicio-vendas:focus-visible {
  outline: none; box-shadow: 0 0 0 2px #F2F3F6, 0 0 0 4px rgba(47,91,234,0.45);
}
.velo-inicio-tab { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-inicio-tab:hover { color: #0B0D12; }
.velo-inicio-pill { transition: background-color 150ms ease-out; }
.velo-inicio-pill:hover { background: #F7F8FA; }
.velo-inicio-search { transition: background-color 150ms ease-out; }
.velo-inicio-search:hover { background: #FAFAFB; }
.velo-inicio-plus {
  background: linear-gradient(180deg, #3A64EE 0%, #2A51DA 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.20), inset 0 0 0 1px rgba(11,13,18,0.06), 0 1px 2px rgba(16,24,40,0.10);
  transition: filter 150ms ease-out, transform 150ms ease-out;
}
.velo-inicio-plus:hover { filter: brightness(0.94); }
.velo-inicio-plus:active { transform: scale(0.97); }
.velo-inicio-vendas .velo-inicio-seta { transition: transform 150ms ease-out; }
.velo-inicio-vendas:hover .velo-inicio-seta { transform: translateX(3px); }
/* O painel força Hanken Grotesk com !important; a Início usa Inter sem números tabulares. */
.dashboard-inter .velo-fonte-inter.velo-inicio-root, .dashboard-inter .velo-fonte-inter.velo-inicio-root * { font-feature-settings: normal !important; }
.dashboard-inter .velo-fonte-inter h1, .dashboard-inter .velo-fonte-inter h2, .dashboard-inter .velo-fonte-inter h3 { font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important; letter-spacing: -0.02em; }
@media (prefers-reduced-motion: reduce) {
  .velo-inicio-card, .velo-inicio-card:hover { transition: none; transform: none; }
}
`;

type Ferramenta = {
  id: string;
  titulo: string;
  categoria: string;
  descricao: string;
  etiquetas: string[];
  destaque?: string;
  icone: ElementType;
  cor: string;
  agente: string;
  to: string;
};

// Cada cartão é uma tela que já existe no painel; nada de número inventado.
const FERRAMENTAS: Record<"comecar" | "avancado", Ferramenta[]> = {
  comecar: [
    {
      id: "catalogo",
      titulo: "Catálogo",
      categoria: "Produtos",
      descricao: "Escolha produtos para vender na sua loja.",
      destaque: "Comece aqui",
      etiquetas: ["Produtos", "Fornecedor"],
      icone: ShoppingBag,
      cor: "#2F5BEA",
      agente: agenteEstrela,
      to: "/dashboard/catalogo",
    },
    {
      id: "modelos",
      titulo: "Templates",
      categoria: "Loja",
      descricao: "Escolha o visual do site da sua loja.",
      destaque: "Comece aqui",
      etiquetas: ["Site", "Visual"],
      icone: LayoutTemplate,
      cor: "#7C5CFA",
      agente: agenteCubo,
      to: "/dashboard/modelos",
    },
    {
      id: "paginas-com-ia",
      titulo: "Páginas com IA",
      categoria: "Vendas",
      descricao: "Gere a página de venda de um produto.",
      etiquetas: ["IA", "Página de venda"],
      icone: FileText,
      cor: "#0E7C66",
      agente: agenteFolha,
      to: "/dashboard/paginas-com-ia",
    },
  ],
  avancado: [
    {
      id: "produtos-em-alta",
      titulo: "Produtos em Alta",
      categoria: "Pesquisa",
      descricao: "Veja os produtos que estão vendendo mais.",
      destaque: "Tendências",
      etiquetas: ["Mercado", "Ranking"],
      icone: TrendingUp,
      cor: "#E5484D",
      agente: agenteLua,
      to: "/dashboard/produtos-em-alta",
    },
    {
      id: "imagens-ia",
      titulo: "Imagens com IA",
      categoria: "Criativos",
      descricao: "Crie fotos de produto para anúncios e site.",
      etiquetas: ["IA", "Fotos"],
      icone: ImageIcon,
      cor: "#D9469B",
      agente: agenteConcha,
      to: "/dashboard/imagens-ia",
    },
    {
      id: "avatares",
      titulo: "Avatares",
      categoria: "Criativos",
      descricao: "Vídeos com avatar apresentando o produto.",
      etiquetas: ["IA", "Vídeo"],
      icone: ScanFace,
      cor: "#F08A24",
      agente: agenteSino,
      to: "/dashboard/avatares",
    },
    {
      id: "publicacoes",
      titulo: "Publicações",
      categoria: "Anúncios",
      descricao: "Acompanhe os produtos que você publicou.",
      etiquetas: ["Anúncios", "Mercado Livre"],
      icone: Archive,
      cor: "#0B0D12",
      agente: agenteEstrela,
      to: "/dashboard/publicacoes",
    },
  ],
};

const ABAS = [
  { id: "comecar" as const, label: "Para começar", icone: Sprout },
  { id: "avancado" as const, label: "Avançado", icone: Rocket },
];

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { foto } = useProfile();
  const [avatarFalhou, setAvatarFalhou] = useState(false);
  const [aba, setAba] = useState<"comecar" | "avancado">("comecar");
  // Mesma leitura da página Projetos (RPC get_user_projects), sem consulta nova.
  const projetos = useQuery({
    queryKey: ["home-projetos-da-loja", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchUserProjects,
  });
  const reduceMotion = useReducedMotion();
  const introDecisionMade = useRef<string | null>(null);
  // "waiting": o onboarding está na frente da home. A intro fica guardada para
  // tocar quando ele fecha — antes ela rodava escondida atrás do modal.
  const [introState, setIntroState] = useState<"pending" | "waiting" | "play" | "done">("pending");

  useLayoutEffect(() => {
    const userId = user?.id;
    if (!userId || introDecisionMade.current === userId) return;

    // Decidido uma vez por montagem/usuário: navegar dentro do app e voltar para a
    // home não repete a introdução, mas recarregar o site ou reentrar na conta sim.
    introDecisionMade.current = userId;

    if (user && shouldShowOnboarding(user)) {
      setIntroState("waiting");
      return;
    }

    const shouldPlay = !reduceMotion && !hasPlayedDashboardIntro(userId);
    if (shouldPlay) markDashboardIntroAsPlayed(userId);

    setIntroState(shouldPlay ? "play" : "done");
  }, [reduceMotion, user]);

  useEffect(() => {
    if (introState !== "waiting" || !user?.id) return;
    const userId = user.id;
    let timer: number | undefined;
    const aoConcluirOnboarding = () => {
      // Espera o modal começar a desbotar para a home entrar por baixo dele.
      timer = window.setTimeout(() => {
        markDashboardIntroAsPlayed(userId);
        setIntroState(reduceMotion ? "done" : "play");
      }, reduceMotion ? 0 : ENTRADA_POS_ONBOARDING.homeStart * 1000);
    };
    window.addEventListener(ONBOARDING_COMPLETED_EVENT, aoConcluirOnboarding);
    return () => {
      window.removeEventListener(ONBOARDING_COMPLETED_EVENT, aoConcluirOnboarding);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [introState, reduceMotion, user?.id]);

  const playIntro = introState === "play";
  // O blur de saída suaviza o fade: sem ele a opacidade sozinha lê como um "liga/desliga".
  const revealProps = (delay: number, distance = 12) => playIntro
    ? {
        initial: { opacity: 0, y: distance, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        transition: { delay, duration: INTRO.revealDuration, ease: INTRO.revealEase },
      }
    : { initial: false as const, animate: { opacity: 1, y: 0 } };

  if (introState === "pending" || introState === "waiting") {
    return (
      <main
        aria-hidden="true"
        className="shrink-0 bg-[#F2F3F6] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
      />
    );
  }

  const go = (path: string) => () => navigate(path);
  const abrirBusca = () => window.dispatchEvent(new Event(ABRIR_BUSCA_EVENT));
  const totalProjetos = projetos.data?.length;
  const ferramentas = FERRAMENTAS[aba];

  return (
    <main className="velo-fonte-inter velo-inicio-root shrink-0 overflow-auto bg-[#F2F3F6] text-[#0B0D12] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]">
      <style>{HOME_CSS}</style>

      {/* Barra do topo: busca, "+" e avatar. */}
      <motion.header {...revealProps(0, -6)} className="mx-auto flex h-[72px] w-full max-w-[1120px] items-center gap-3 px-4 md:px-10">
        <button
          type="button"
          onClick={abrirBusca}
          aria-label="Buscar produtos, lojas e telas"
          className="velo-inicio-search flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-white px-4 text-left text-[14px] text-[#8A93A3]"
        >
          <Search size={16} strokeWidth={1.5} aria-hidden="true" />
          <span className="flex-1 truncate">Buscar produtos, lojas...</span>
        </button>
        <button
          type="button"
          onClick={go("/dashboard/catalogo")}
          aria-label="Adicionar produto"
          title="Adicionar produto"
          className="velo-inicio-plus flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
        >
          <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={go("/dashboard/configuracoes")}
          aria-label="Configurações da conta"
          className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-[#8A93A3]"
        >
          {foto && !avatarFalhou ? (
            <img src={foto} alt="" onError={() => setAvatarFalhou(true)} className="h-full w-full object-cover" />
          ) : (
            <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />
          )}
        </button>
      </motion.header>

      <div className="mx-auto w-full max-w-[660px] px-4 pb-16 pt-4">
        {/* Cartão de vendas: sem número por enquanto (não há leitura de vendas
            pronta para a Início); leva para Pedidos. */}
        <motion.button
          {...revealProps(0.05, 10)}
          type="button"
          onClick={go("/dashboard/pedidos")}
          data-dashboard-tour="home-primeiros-passos"
          className="velo-inicio-vendas relative block w-full overflow-hidden rounded-[28px] bg-white p-6 text-left"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 right-[-40px] h-[300px] w-[420px] rounded-full opacity-90 blur-[60px]"
            style={{ background: "radial-gradient(closest-side, #F3B8EE 0%, #D9C2FF 45%, #BFD7FF 75%, transparent 100%)" }}
          />
          <span aria-hidden="true" className="relative flex items-center justify-between text-[13px] text-[#9AA1AE] blur-[2.5px] select-none">
            <span>Suas vendas</span>
            <span className="flex gap-4">
              <span>7D</span>
              <span>30D</span>
              <span>3M</span>
              <span>Tudo</span>
            </span>
          </span>
          <span className="relative mt-12 flex items-end justify-between gap-6">
            <span className="min-w-0">
              <span className="block text-[26px] font-normal leading-[1.2] tracking-[-0.01em] text-[#2B2F36]">
                Acompanhe as vendas da
                <br />
                sua loja em um só lugar
              </span>
              <span className="mt-3 flex items-center gap-1.5 text-[13px] text-[#8A93A3]">
                Seus pedidos ficam em Pedidos
                <ArrowRight size={14} strokeWidth={1.6} aria-hidden="true" className="velo-inicio-seta" />
              </span>
            </span>
            <ShoppingBag size={76} strokeWidth={1} aria-hidden="true" className="mb-1 shrink-0 text-[#2B2F36]" />
          </span>
        </motion.button>

        {/* Ferramentas: título, abas em pílula e atalho para Projetos. */}
        <motion.div {...revealProps(0.15, 10)} className="mt-12">
          <h2 className="m-0 px-1 text-[26px] font-normal text-[#2B2F36]">Ferramentas</h2>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Ferramentas" className="flex rounded-[14px] bg-white p-1">
              {ABAS.map((item) => {
                const Icone = item.icone;
                const ativa = aba === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => setAba(item.id)}
                    className={`velo-inicio-tab flex h-9 items-center gap-2 rounded-[10px] px-3.5 text-[14px] ${
                      ativa ? "bg-[#F2F3F6] font-medium text-[#0B0D12]" : "text-[#6B7280]"
                    }`}
                  >
                    <Icone size={16} strokeWidth={1.6} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={go("/dashboard/projetos")}
              className="velo-inicio-pill flex h-11 items-center gap-2 rounded-[14px] bg-white px-4 text-[14px] text-[#6B7280]"
            >
              Seus projetos
              <FolderOpen size={16} strokeWidth={1.6} aria-hidden="true" className="text-[#2F5BEA]" />
            </button>
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ferramentas.map((ferramenta, indice) => {
            const Icone = ferramenta.icone;
            return (
              <motion.button
                key={ferramenta.id}
                {...revealProps(0.2 + indice * 0.05, 10)}
                type="button"
                onClick={go(ferramenta.to)}
                className="velo-inicio-card flex min-h-[300px] flex-col p-4 text-left"
              >
                <span className="flex items-start justify-between">
                  <span className="flex items-center">
                    <span className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-[14px] text-white" style={{ background: ferramenta.cor }}>
                      <Icone size={18} strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <span className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#F2F3F6]">
                      <img src={ferramenta.agente} alt="" className="h-8 w-8 object-contain" draggable={false} />
                    </span>
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#ECEEF2] text-[#8A93A3]">
                    <ArrowUpRight size={14} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                </span>
                <span className="mt-5 block text-[12px] text-[#8A93A3]">{ferramenta.categoria}</span>
                <span className="mt-0.5 block text-[18px] font-medium leading-snug text-[#0B0D12]">{ferramenta.titulo}</span>
                <span className="mt-3 flex flex-wrap gap-1.5">
                  {ferramenta.destaque && (
                    <span className="flex h-6 items-center gap-1 rounded-full border border-[#ECEEF2] px-2.5 text-[11.5px] text-[#4B5563]">
                      <Flame size={11} strokeWidth={2} aria-hidden="true" className="text-[#0B0D12]" />
                      {ferramenta.destaque}
                    </span>
                  )}
                  {ferramenta.etiquetas.map((etiqueta) => (
                    <span key={etiqueta} className="flex h-6 items-center rounded-full border border-[#ECEEF2] px-2.5 text-[11.5px] text-[#4B5563]">
                      {etiqueta}
                    </span>
                  ))}
                </span>
                <span className="mt-auto block pt-5 text-[15px] font-light leading-snug text-[#2B2F36]">{ferramenta.descricao}</span>
                <span className="mt-4 block h-[3px] w-full rounded-full bg-[#ECEEF2]">
                  <span className="block h-full w-full rounded-full" style={{ background: ferramenta.cor }} />
                </span>
                <span className="mt-2 flex items-center justify-between text-[12px] text-[#8A93A3]">
                  <span>Abrir</span>
                  <ArrowRight size={13} strokeWidth={1.6} aria-hidden="true" />
                </span>
              </motion.button>
            );
          })}

          {/* Cartão de destaque (o colorido da referência): leva para Projetos. */}
          <motion.button
            {...revealProps(0.2 + ferramentas.length * 0.05, 10)}
            type="button"
            onClick={go("/dashboard/projetos")}
            className="velo-inicio-card relative flex min-h-[300px] flex-col overflow-hidden p-4 text-left text-white"
            style={{ background: "#2F5BEA" }}
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10" />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 -left-10 h-44 w-44 rounded-full bg-white/[0.06]" />
            <span className="relative flex items-start justify-between">
              <span className="flex items-center">
                <span className="relative z-[1] flex h-10 w-10 items-center justify-center rounded-[14px] bg-white text-[#2F5BEA]">
                  <FolderOpen size={18} strokeWidth={1.7} aria-hidden="true" />
                </span>
                <span className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <img src={agenteCubo} alt="" className="h-8 w-8 object-contain" draggable={false} />
                </span>
              </span>
              {typeof totalProjetos === "number" && (
                <span
                  className="flex h-7 items-center gap-1 rounded-full border border-white/40 px-2.5 text-[12px]"
                  aria-label={`${totalProjetos} ${totalProjetos === 1 ? "projeto" : "projetos"}`}
                >
                  <FolderOpen size={12} strokeWidth={1.8} aria-hidden="true" />
                  {totalProjetos}
                </span>
              )}
            </span>
            <span className="relative mt-5 block text-[12px] text-white/70">Sua loja</span>
            <span className="relative mt-0.5 block text-[18px] font-medium leading-snug">Projetos</span>
            <span className="relative mt-auto block pt-5 text-[15px] font-light leading-snug text-white/90">
              Veja os sites das suas lojas e o que os agentes estão fazendo neles.
            </span>
            <span className="relative mt-4 flex items-center justify-between text-[12px] text-white/80">
              <span>Abrir projetos</span>
              <ArrowRight size={13} strokeWidth={1.6} aria-hidden="true" />
            </span>
          </motion.button>
        </div>
      </div>
    </main>
  );
};

// No celular a home volta ao estilo marketplace (busca, categorias e grade de
// produtos), mais simples e direto do que o painel do desktop.
const DashboardHomeRoute = () => {
  const isMobile = useIsMobile();

  if (isMobile) return <MobileHome />;

  return <DashboardHomePage />;
};

export default DashboardHomeRoute;
