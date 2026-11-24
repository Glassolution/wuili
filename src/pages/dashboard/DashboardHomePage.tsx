import { useEffect, useLayoutEffect, useRef, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  Archive,
  ArrowRight,
  Flame,
  FolderOpen,
  Image as ImageIcon,
  LayoutTemplate,
  Info,
  Link2,
  Menu,
  Plus,
  SlidersHorizontal,
  Settings2,
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
.velo-inicio-card:focus-visible, .velo-inicio-tab:focus-visible, .velo-inicio-pill:focus-visible, .velo-inicio-search:focus-visible, .velo-inicio-link:focus-visible, .velo-inicio-conta:focus-visible, .velo-inicio-item:focus-visible, .velo-inicio-novo:focus-visible, .velo-inicio-vendas:focus-visible {
  outline: none; box-shadow: 0 0 0 2px #F2F3F6, 0 0 0 4px rgba(47,91,234,0.45);
}
.velo-inicio-tab { transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-inicio-tab:hover { color: #0B0D12; }
.velo-inicio-pill { transition: background-color 150ms ease-out; }
.velo-inicio-pill:hover { background: #F7F8FA; }
.velo-inicio-search { transition: background-color 150ms ease-out; }
.velo-inicio-search:hover { background: #FAFAFB; }
.velo-inicio-link { transition: color 150ms ease-out; }
.velo-inicio-link:hover { color: #0B0D12; }
.velo-inicio-conta { transition: background-color 150ms ease-out; }
.velo-inicio-conta:hover { background: #FAFAFB; }
.velo-inicio-novo { transition: border-color 150ms ease-out, background-color 150ms ease-out; }
.velo-inicio-novo:hover { border-color: #AEB6C3; background: rgba(255,255,255,0.5); }
.velo-inicio-item { transition: background-color 150ms ease-out; }
.velo-inicio-item:hover { background: #F5F6F8; }
.velo-inicio-vendas .velo-inicio-seta { transition: transform 150ms ease-out; }
.velo-inicio-vendas:hover .velo-inicio-seta { transform: translateX(3px); }
/* O painel força Hanken Grotesk com !important; a Início usa Inter sem números tabulares. */
.dashboard-inter .velo-fonte-inter.velo-inicio-root, .dashboard-inter .velo-fonte-inter.velo-inicio-root * { font-feature-settings: normal !important; }
.dashboard-inter .velo-fonte-inter h1, .dashboard-inter .velo-fonte-inter h2, .dashboard-inter .velo-fonte-inter h3 { font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important; letter-spacing: -0.02em; }
@media (prefers-reduced-motion: reduce) {
  .velo-inicio-card, .velo-inicio-card:hover { transition: none; transform: none; }
}
`;

type AbaId = "comecar" | "avancado";

type Ferramenta = {
  id: string;
  aba: AbaId;
  titulo: string;
  categoria: string;
  descricao: string;
  selo: string;
  destaque?: string;
  etiquetas: string[];
  rotuloAcao: string;
  acao: string;
  icone?: ElementType;
  logo?: string;
  cor: string;
  fundoIcone: string;
  agente: string;
  to: string;
};

// Cada cartão é uma tela que já existe no painel; nada de número inventado.
// Em "Para começar" a ordem é o caminho sugerido (etapa 1, 2, 3).
const FERRAMENTAS: Ferramenta[] = [
  {
    id: "catalogo",
    aba: "comecar",
    titulo: "Catálogo",
    categoria: "Produtos",
    descricao: "Escolha produtos para vender na sua loja.",
    selo: "Fornecedor",
    destaque: "Comece aqui",
    etiquetas: ["Produtos", "Estoque"],
    rotuloAcao: "Ação",
    acao: "Escolher",
    icone: ShoppingBag,
    cor: "#2F5BEA",
    fundoIcone: "linear-gradient(160deg, #5B7FF2 0%, #2F5BEA 100%)",
    agente: agenteEstrela,
    to: "/dashboard/catalogo",
  },
  {
    id: "modelos",
    aba: "comecar",
    titulo: "Templates",
    categoria: "Loja",
    descricao: "Escolha o visual do site da sua loja.",
    selo: "Site",
    destaque: "Comece aqui",
    etiquetas: ["Visual", "Tema"],
    rotuloAcao: "Ação",
    acao: "Montar",
    icone: LayoutTemplate,
    cor: "#7C5CFA",
    fundoIcone: "linear-gradient(160deg, #9C84FF 0%, #7C5CFA 100%)",
    agente: agenteCubo,
    to: "/dashboard/modelos",
  },
  {
    id: "mercado-livre",
    aba: "comecar",
    titulo: "Mercado Livre",
    categoria: "Vendas",
    descricao: "Conecte sua conta para publicar e receber pedidos.",
    selo: "Integração",
    destaque: "Essencial",
    etiquetas: ["Anúncios", "Pedidos"],
    rotuloAcao: "Ação",
    acao: "Conectar",
    logo: "/brand/mercado-livre.png",
    cor: "#E6C600",
    fundoIcone: "linear-gradient(160deg, #FFF06A 0%, #FFE600 100%)",
    agente: agenteFolha,
    to: "/dashboard/configuracoes?tab=Integrações",
  },
  {
    id: "produtos-em-alta",
    aba: "avancado",
    titulo: "Produtos em Alta",
    categoria: "Pesquisa",
    descricao: "Veja os produtos que estão vendendo mais.",
    selo: "Ranking",
    destaque: "Tendências",
    etiquetas: ["Mercado"],
    rotuloAcao: "Ação",
    acao: "Descobrir",
    icone: TrendingUp,
    cor: "#E5484D",
    fundoIcone: "linear-gradient(160deg, #F37A7E 0%, #E5484D 100%)",
    agente: agenteLua,
    to: "/dashboard/produtos-em-alta",
  },
  {
    id: "imagens-ia",
    aba: "avancado",
    titulo: "Imagens com IA",
    categoria: "Criativos",
    descricao: "Crie fotos de produto para anúncios e site.",
    selo: "IA",
    destaque: "Com IA",
    etiquetas: ["Fotos"],
    rotuloAcao: "Ação",
    acao: "Criar",
    icone: ImageIcon,
    cor: "#D9469B",
    fundoIcone: "linear-gradient(160deg, #EC78B9 0%, #D9469B 100%)",
    agente: agenteConcha,
    to: "/dashboard/imagens-ia",
  },
  {
    id: "avatares",
    aba: "avancado",
    titulo: "Avatares",
    categoria: "Criativos",
    descricao: "Vídeos com avatar apresentando o produto.",
    selo: "Vídeo",
    destaque: "Com IA",
    etiquetas: ["Vídeo"],
    rotuloAcao: "Ação",
    acao: "Gravar",
    icone: ScanFace,
    cor: "#F08A24",
    fundoIcone: "linear-gradient(160deg, #F7AE62 0%, #F08A24 100%)",
    agente: agenteSino,
    to: "/dashboard/avatares",
  },
  {
    id: "publicacoes",
    aba: "avancado",
    titulo: "Publicações",
    categoria: "Anúncios",
    descricao: "Acompanhe os produtos que você publicou.",
    selo: "Anúncios",
    destaque: "Mercado Livre",
    etiquetas: [],
    rotuloAcao: "Ação",
    acao: "Acompanhar",
    icone: Archive,
    cor: "#0B0D12",
    fundoIcone: "linear-gradient(160deg, #3A3F4A 0%, #0B0D12 100%)",
    agente: agenteEstrela,
    to: "/dashboard/publicacoes",
  },
];

const ABAS = [
  { id: "comecar" as const, label: "Para começar", icone: Sprout },
  { id: "avancado" as const, label: "Avançado", icone: Rocket },
];

// Quais cartões a pessoa escondeu: preferência deste navegador, por usuário.
const chaveCartoesOcultos = (userId: string) => `velo:inicio:cartoes-ocultos:${userId}`;
const lerCartoesOcultos = (userId: string): string[] => {
  try {
    const bruto = window.localStorage.getItem(chaveCartoesOcultos(userId));
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
};
const salvarCartoesOcultos = (userId: string, ids: string[]) => {
  try {
    window.localStorage.setItem(chaveCartoesOcultos(userId), JSON.stringify(ids));
  } catch {
    // Sem armazenamento (aba anônima, bloqueio): a escolha vale só nesta visita.
  }
};

// Selo colorido da ferramenta (ícone ou logo), com gradiente curto e filete de luz.
const IconeFerramenta = ({ ferramenta, tamanho }: { ferramenta: Ferramenta; tamanho: number }) => {
  const Icone = ferramenta.icone;
  return (
    <span
      className="relative z-[1] flex shrink-0 items-center justify-center text-white"
      style={{
        width: tamanho,
        height: tamanho,
        borderRadius: tamanho * 0.34,
        background: ferramenta.fundoIcone,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(16,24,40,0.10)",
      }}
    >
      {ferramenta.logo ? (
        <img src={ferramenta.logo} alt="" className="object-contain" style={{ width: tamanho * 0.62, height: tamanho * 0.62 }} draggable={false} />
      ) : Icone ? (
        <Icone size={Math.round(tamanho * 0.42)} strokeWidth={1.7} aria-hidden="true" />
      ) : null}
    </span>
  );
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nomeCurto, foto } = useProfile();
  const [avatarFalhou, setAvatarFalhou] = useState(false);
  const [menuContaAberto, setMenuContaAberto] = useState(false);
  const [aba, setAba] = useState<AbaId>("comecar");
  const [personalizarAberto, setPersonalizarAberto] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
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

  useEffect(() => {
    if (!menuContaAberto && !personalizarAberto) return;
    const fecharComEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMenuContaAberto(false);
      setPersonalizarAberto(false);
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [menuContaAberto, personalizarAberto]);

  useEffect(() => {
    setOcultos(user?.id ? lerCartoesOcultos(user.id) : []);
  }, [user?.id]);

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
  const atualizarOcultos = (ids: string[]) => {
    setOcultos(ids);
    if (user?.id) salvarCartoesOcultos(user.id, ids);
  };
  const alternarCartao = (id: string) =>
    atualizarOcultos(ocultos.includes(id) ? ocultos.filter((item) => item !== id) : [...ocultos, id]);
  const caminho = FERRAMENTAS.filter((f) => f.aba === "comecar");
  const ferramentas = FERRAMENTAS.filter((f) => f.aba === aba && !ocultos.includes(f.id));
  const ocultasNaAba = FERRAMENTAS.filter((f) => f.aba === aba && ocultos.includes(f.id)).length;
  const primeiroNome = nomeCurto && nomeCurto !== "Usuario" ? nomeCurto.split(" ")[0] : "Sua conta";

  return (
    <main className="velo-fonte-inter velo-inicio-root shrink-0 overflow-auto bg-[#F2F3F6] text-[#0B0D12] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]">
      <style>{HOME_CSS}</style>

      {/* Barra do topo no desenho da referência: links centralizados; à direita,
          botão redondo de busca e pílula da conta com menu. */}
      <motion.header {...revealProps(0, -6)} className="grid h-[72px] w-full grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:px-8">
        <span aria-hidden="true" />
        <nav aria-label="Atalhos" className="flex items-center gap-10">
          {[
            { label: "Projetos", to: "/dashboard/projetos" },
            { label: "Pedidos", to: "/dashboard/pedidos" },
            { label: "Comunidade", to: "/dashboard/comunidade" },
          ].map((link) => (
            <button
              key={link.to}
              type="button"
              onClick={go(link.to)}
              className="velo-inicio-link rounded-md text-[15px] text-[#2B2F36]"
            >
              {link.label}
            </button>
          ))}
        </nav>
        <div className="relative flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={abrirBusca}
            aria-label="Buscar produtos, lojas e telas"
            title="Buscar"
            className="velo-inicio-search flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2F5BEA]"
          >
            <Search size={17} strokeWidth={1.7} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setMenuContaAberto((aberto) => !aberto)}
            aria-label="Menu da conta"
            aria-haspopup="menu"
            aria-expanded={menuContaAberto}
            className="velo-inicio-conta flex h-10 items-center gap-2.5 rounded-full bg-white pl-2 pr-3.5 text-[15px] text-[#2B2F36]"
          >
            <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-[#F2F3F6] text-[#8A93A3]">
              {foto && !avatarFalhou ? (
                <img src={foto} alt="" onError={() => setAvatarFalhou(true)} className="h-full w-full object-cover" />
              ) : (
                <UserRound size={14} strokeWidth={1.6} aria-hidden="true" />
              )}
            </span>
            <span className="max-w-[140px] truncate">{primeiroNome}</span>
            <Menu size={18} strokeWidth={1.7} aria-hidden="true" className="ml-1.5" />
          </button>
          {menuContaAberto && (
            <>
              <button
                type="button"
                aria-label="Fechar menu"
                tabIndex={-1}
                className="fixed inset-0 z-40 cursor-default"
                onClick={() => setMenuContaAberto(false)}
              />
              <div
                role="menu"
                className="absolute right-0 top-12 z-50 w-56 rounded-[16px] bg-white p-1.5"
                style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 12px 32px rgba(16,24,40,0.10)" }}
              >
                {[
                  { label: "Configurações", icon: Settings2, to: "/dashboard/configuracoes" },
                  { label: "Integrações", icon: Link2, to: "/dashboard/configuracoes?tab=Integrações" },
                  { label: "Comunidade e Ajuda", icon: Info, to: "/dashboard/comunidade" },
                ].map((item) => {
                  const Icone = item.icon;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuContaAberto(false);
                        navigate(item.to);
                      }}
                      className="velo-inicio-item flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-medium text-[#4B5563]"
                    >
                      <Icone size={16} strokeWidth={1.5} aria-hidden="true" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </motion.header>

      <div className="mx-auto w-full max-w-[720px] px-4 pb-16 pt-4">
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

        {/* Ferramentas: título, abas em pílula e, à direita, personalizar os
            cartões e atalho para Projetos (no desenho do seletor da referência). */}
        <motion.div {...revealProps(0.15, 10)} className="mt-12">
          <h2 className="m-0 px-1 text-[28px] font-normal text-[#2B2F36]">Ferramentas</h2>
          <div className="relative mt-5 flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Ferramentas" className="flex rounded-[16px] bg-white p-1">
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
                    className={`velo-inicio-tab flex h-10 items-center gap-2 rounded-[12px] px-4 text-[15px] ${
                      ativa ? "bg-[#F2F3F6] text-[#0B0D12]" : "text-[#4B5563]"
                    }`}
                  >
                    <Icone size={17} strokeWidth={1.7} aria-hidden="true" />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[15px] text-[#9AA1AE]">Seus cards</span>
              <div className="flex rounded-[16px] bg-white p-1">
                <button
                  type="button"
                  onClick={() => setPersonalizarAberto((aberto) => !aberto)}
                  aria-label="Personalizar cards"
                  aria-haspopup="dialog"
                  aria-expanded={personalizarAberto}
                  title="Personalizar cards"
                  className={`velo-inicio-tab flex h-10 w-10 items-center justify-center rounded-[12px] ${
                    personalizarAberto ? "bg-[#F2F3F6] text-[#0B0D12]" : "text-[#0B0D12]"
                  }`}
                >
                  <SlidersHorizontal size={17} strokeWidth={1.7} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={go("/dashboard/projetos")}
                  aria-label="Abrir projetos"
                  title="Projetos"
                  className="velo-inicio-tab flex h-10 w-10 items-center justify-center rounded-[12px] text-[#2F5BEA]"
                >
                  <FolderOpen size={17} strokeWidth={1.7} aria-hidden="true" />
                </button>
              </div>
            </div>

            {personalizarAberto && (
              <>
                <button
                  type="button"
                  aria-label="Fechar personalização"
                  tabIndex={-1}
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setPersonalizarAberto(false)}
                />
                <div
                  role="dialog"
                  aria-label="Personalizar cards"
                  className="absolute right-0 top-[52px] z-50 w-[320px] rounded-[20px] bg-white p-4"
                  style={{ boxShadow: "0 1px 2px rgba(16,24,40,0.04), 0 16px 40px rgba(16,24,40,0.12)" }}
                >
                  <p className="m-0 text-[15px] font-medium text-[#0B0D12]">Seus cards</p>
                  <p className="m-0 mt-0.5 text-[13px] text-[#8A93A3]">Escolha o que aparece na sua Início.</p>
                  {ABAS.map((grupo) => (
                    <div key={grupo.id} className="mt-4">
                      <p className="m-0 mb-1.5 text-[12px] text-[#9AA1AE]">{grupo.label}</p>
                      <ul className="m-0 list-none p-0">
                        {FERRAMENTAS.filter((f) => f.aba === grupo.id).map((f) => {
                          const visivel = !ocultos.includes(f.id);
                          return (
                            <li key={f.id}>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={visivel}
                                onClick={() => alternarCartao(f.id)}
                                className="velo-inicio-item flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left"
                              >
                                <IconeFerramenta ferramenta={f} tamanho={28} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[14px] text-[#0B0D12]">{f.titulo}</span>
                                  <span className="block truncate text-[12px] text-[#8A93A3]">{f.descricao}</span>
                                </span>
                                <span
                                  aria-hidden="true"
                                  className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 ${visivel ? "bg-[#2F5BEA]" : "bg-[#DCE0E7]"}`}
                                >
                                  <span
                                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${visivel ? "translate-x-[18px]" : "translate-x-0.5"}`}
                                  />
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                  {ocultos.length > 0 && (
                    <button
                      type="button"
                      onClick={() => atualizarOcultos([])}
                      className="velo-inicio-item mt-3 h-9 w-full rounded-[12px] text-[13px] font-medium text-[#2F5BEA]"
                    >
                      Mostrar todos
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ferramentas.map((ferramenta, indice) => {
            const etapa = ferramenta.aba === "comecar" ? caminho.findIndex((f) => f.id === ferramenta.id) + 1 : null;
            return (
              <motion.button
                key={ferramenta.id}
                {...revealProps(0.2 + indice * 0.05, 10)}
                type="button"
                onClick={go(ferramenta.to)}
                aria-label={`${ferramenta.titulo}: ${ferramenta.descricao}`}
                className="velo-inicio-card flex min-h-[330px] flex-col p-5 text-left"
              >
                <span className="flex items-start justify-between">
                  <span className="flex items-center">
                    <IconeFerramenta ferramenta={ferramenta} tamanho={48} />
                    <span className="-ml-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-[#F2F3F6]">
                      <img src={ferramenta.agente} alt="" className="h-10 w-10 object-contain" draggable={false} />
                    </span>
                  </span>
                  <span className="flex h-7 items-center gap-1.5 rounded-full border border-[#ECEEF2] px-2.5 text-[12px] text-[#4B5563]">
                    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: ferramenta.cor }} />
                    {ferramenta.selo}
                  </span>
                </span>
                <span className="mt-6 block text-[13px] text-[#9AA1AE]">{ferramenta.categoria}</span>
                <span className="mt-0.5 block text-[21px] font-medium leading-tight tracking-[-0.01em] text-[#2B2F36]">{ferramenta.titulo}</span>
                <span className="mt-3.5 flex flex-wrap gap-1.5">
                  {ferramenta.destaque && (
                    <span className="flex h-7 items-center gap-1.5 rounded-full bg-[#F2F3F6] px-2.5 text-[12.5px] text-[#2B2F36]">
                      <Flame size={12} strokeWidth={2.2} aria-hidden="true" className="text-[#0B0D12]" />
                      {ferramenta.destaque}
                    </span>
                  )}
                  {ferramenta.etiquetas.map((etiqueta) => (
                    <span key={etiqueta} className="flex h-7 items-center rounded-full border border-[#ECEEF2] px-2.5 text-[12.5px] text-[#4B5563]">
                      {etiqueta}
                    </span>
                  ))}
                </span>
                <span className="mt-auto block pt-6 text-[13px] text-[#9AA1AE]">{ferramenta.rotuloAcao}</span>
                <span className="block text-[32px] font-light leading-tight tracking-[-0.02em] text-[#2B2F36]">{ferramenta.acao}</span>
                <span className="mt-4 block h-1 w-full overflow-hidden rounded-full bg-[#ECEEF2]">
                  <span
                    className="block h-full rounded-full"
                    style={{ background: ferramenta.cor, width: etapa ? `${(etapa / caminho.length) * 100}%` : "100%" }}
                  />
                </span>
                <span className="mt-2 flex items-center justify-between text-[13px] text-[#9AA1AE]">
                  {etapa ? (
                    <>
                      <span>Etapa {etapa}</span>
                      <span>de {caminho.length}</span>
                    </>
                  ) : (
                    <>
                      <span>Abrir</span>
                      <ArrowRight size={14} strokeWidth={1.6} aria-hidden="true" />
                    </>
                  )}
                </span>
              </motion.button>
            );
          })}

          {/* Cartão de destaque (o colorido da referência): leva para Projetos. */}
          <motion.button
            {...revealProps(0.2 + ferramentas.length * 0.05, 10)}
            type="button"
            onClick={go("/dashboard/projetos")}
            className="velo-inicio-card relative flex min-h-[330px] flex-col overflow-hidden p-5 text-left text-white"
            style={{ background: "linear-gradient(160deg, #4A72F0 0%, #2F5BEA 55%, #2449C7 100%)" }}
          >
            <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/10" />
            <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-12 h-52 w-52 rounded-full bg-white/[0.06]" />
            <span className="relative flex items-start justify-between">
              <span className="flex items-center">
                <span className="relative z-[3] flex h-12 w-12 items-center justify-center rounded-[16px] bg-white text-[#2F5BEA]">
                  <FolderOpen size={20} strokeWidth={1.7} aria-hidden="true" />
                </span>
                {[agenteCubo, agenteLua, agenteFolha].map((foto, i) => (
                  <span
                    key={foto}
                    className="-ml-3 flex h-12 w-12 items-center justify-center rounded-full border border-white/25 bg-white/15"
                    style={{ zIndex: 2 - i }}
                  >
                    <img src={foto} alt="" className="h-10 w-10 object-contain" draggable={false} />
                  </span>
                ))}
              </span>
            </span>
            <span className="relative mt-6 block text-[13px] text-white/70">Sua loja</span>
            <span className="relative mt-0.5 block text-[21px] font-medium leading-tight tracking-[-0.01em]">Projetos</span>
            <span className="relative mt-3.5 flex flex-wrap gap-1.5">
              <span className="flex h-7 items-center rounded-full bg-white/15 px-2.5 text-[12.5px]">Sites</span>
              <span className="flex h-7 items-center rounded-full border border-white/30 px-2.5 text-[12.5px]">Agentes</span>
            </span>
            <span className="relative mt-auto block pt-6 text-[13px] text-white/70">Projetos criados</span>
            <span className="relative block text-[32px] font-light leading-tight tracking-[-0.02em]">
              {typeof totalProjetos === "number" ? totalProjetos : "—"}
            </span>
            <span className="relative mt-4 block h-1 w-full rounded-full bg-white/25">
              <span className="block h-full w-full rounded-full bg-white" />
            </span>
            <span className="relative mt-2 flex items-center justify-between text-[13px] text-white/75">
              <span>Abrir projetos</span>
              <ArrowRight size={14} strokeWidth={1.6} aria-hidden="true" />
            </span>
          </motion.button>

          {/* Cartões escondidos na aba: um atalho para trazê-los de volta. */}
          {ocultasNaAba > 0 && (
            <motion.button
              {...revealProps(0.25 + ferramentas.length * 0.05, 10)}
              type="button"
              onClick={() => setPersonalizarAberto(true)}
              className="velo-inicio-novo flex min-h-[330px] flex-col items-center justify-center gap-3 rounded-[24px] border-[1.5px] border-dashed border-[#D5D9E0] text-[14px] text-[#6B7280]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#2F5BEA]">
                <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
              </span>
              Adicionar card
              <span className="text-[12px] text-[#9AA1AE]">
                {ocultasNaAba} {ocultasNaAba === 1 ? "escondido" : "escondidos"}
              </span>
            </motion.button>
          )}
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
