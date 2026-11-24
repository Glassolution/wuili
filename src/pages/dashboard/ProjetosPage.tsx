import { useEffect, useState, type ElementType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Archive, ArrowRight, BadgePercent, Check, ExternalLink, FileText, Info, LayoutTemplate, Link2, MoreHorizontal, PenLine, Plus, Search, Settings2, ShoppingBag, Sparkles, UserRound, Wand2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { fetchUserProjects, type UserProject } from "@/lib/userProjects";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import cardTemasImg from "@/assets/home-card-temas.webp";
import bannerResultados from "@/assets/home-banner-resultados.webp";
import agenteLua from "@/assets/agentes/lua.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import agenteSino from "@/assets/agentes/sino.png";
import { ABRIR_BUSCA_EVENT } from "@/lib/abrirBusca";
import { useProfile } from "@/lib/profileContext";
import VideoTutorialModal from "@/components/dashboard/VideoTutorialModal";

type OnboardingStatus = {
  mlConnected: boolean;
  hasPublication: boolean;
};

const TUTORIAL_INICIO = {
  src: "https://player.vimeo.com/video/1226153949?badge=0&autopause=0&player_id=0&app_id=58479",
  aspectPadding: "62.5%",
  title: "Tutorial de início",
  description: "Veja como dar os primeiros passos na Velo.",
} as const;

// Curva das entradas: desaceleração suave, sem a cauda longa do ease-out exponencial.
const INTRO = {
  revealEase: [0.22, 1, 0.36, 1] as const,
  revealDuration: 0.7,
};

const CARD_SHADOW = "0 1px 2px rgba(16,24,40,0.04), 0 8px 24px rgba(16,24,40,0.04)";

// Estados de hover/foco dos botões e cards desta tela (tokens do redesign).
const HOME_CSS = `
.velo-home-card { background: #FFFFFF; border: 1px solid #ECEEF2; border-radius: 20px; box-shadow: ${CARD_SHADOW}; }
.velo-home-dark { background: #0B0D12; transition: background-color 150ms ease-out, transform 150ms ease-out; }
.velo-home-dark:hover { background: #1F232B; }
.velo-home-accent { background: #2F5BEA; transition: background-color 150ms ease-out, opacity 150ms ease-out; }
.velo-home-accent:hover:not(:disabled) { background: #2449C7; }
/* "+" do header: sem brilho difuso; volume só com gradiente curto, filete de luz no topo e sombra rente. */
.velo-home-plus {
  background: linear-gradient(180deg, #3A64EE 0%, #2A51DA 100%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.20), inset 0 0 0 1px rgba(11,13,18,0.06), 0 1px 2px rgba(16,24,40,0.10);
  transition: filter 150ms ease-out, transform 150ms ease-out;
}
.velo-home-plus:hover { filter: brightness(0.94); }
.velo-home-plus:active { transform: scale(0.97); }
.velo-home-plus:focus-visible { outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(47,91,234,0.45); }
.velo-home-secondary { background: #FFFFFF; border: 1px solid #ECEEF2; transition: background-color 150ms ease-out, border-color 150ms ease-out; }
.velo-home-secondary:hover:not(:disabled) { background: #F7F8FA; border-color: #DCE0E7; }
.velo-home-ghost { background: transparent; transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-home-ghost:hover { background: #F1F3F6; color: #0B0D12; }
/* A exceção velo-fonte-inter liga números tabulares, que abrem o hífen de "Bem-vindo". */
.dashboard-inter .velo-fonte-inter.velo-home-root, .dashboard-inter .velo-fonte-inter.velo-home-root * { font-feature-settings: normal !important; }
/* O painel força Hanken Grotesk com !important; o título do destaque usa a serifa da referência. */
.dashboard-inter .velo-fonte-inter .velo-home-serif, .velo-fonte-inter .velo-home-serif {
  font-family: "Instrument Serif", ui-serif, Georgia, serif !important; font-weight: 400 !important; letter-spacing: -0.01em !important;
  font-feature-settings: normal !important;
}
.dashboard-inter .velo-fonte-inter h1, .dashboard-inter .velo-fonte-inter h3 { font-family: "Inter", ui-sans-serif, system-ui, sans-serif !important; letter-spacing: -0.02em; }
.velo-home-row { transition: background-color 150ms ease-out; }
.velo-home-row:hover { background: #F7F8FA; }
.velo-home-search { transition: background-color 150ms ease-out; }
.velo-home-search:hover { background: #EEF0F3; }
.velo-home-dark:focus-visible, .velo-home-accent:focus-visible, .velo-home-secondary:focus-visible, .velo-home-ghost:focus-visible, .velo-home-search:focus-visible {
  outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(47,91,234,0.45);
}
`;

// "há 5 min", "há 3 h", "há 2 d" — e a data curta para o que passou de uma semana.
const tempoRelativo = (iso: string, agora = Date.now()) => {
  const diff = Math.max(0, agora - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `há ${dias} d`;
  return new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
};

type EventoDoSite = {
  id: string;
  projeto: UserProject;
  acao: string;
  quando: string;
  /** Foto do agente responsável por esse tipo de trabalho no site. */
  agente: string;
};

// Cada agente representa um tipo de trabalho no site. O banco ainda não grava
// qual agente fez cada mudança, então a foto segue o tipo da mudança.
// (Também há estrela.png e concha.png em src/assets/agentes para os próximos.)
const AGENTE_POR_ACAO = {
  criado: agenteLua,
  editado: agenteCubo,
  publicado: agenteFolha,
} as const;

/**
 * Atividade do site da loja, montada só com o que o banco registra de cada
 * projeto (criação, última edição e publicação). Ainda não existe registro de
 * qual agente fez cada mudança: a foto vem do tipo de trabalho e nenhuma linha
 * leva nome de agente.
 */
const eventosDoSite = (projetos: UserProject[]): EventoDoSite[] => {
  const eventos: EventoDoSite[] = [];
  for (const projeto of projetos) {
    const criado = new Date(projeto.created_at).getTime();
    eventos.push({ id: `${projeto.id}-criado`, projeto, acao: "Criou o rascunho do site", quando: projeto.created_at, agente: AGENTE_POR_ACAO.criado });
    const editado = projeto.last_edited_at ? new Date(projeto.last_edited_at).getTime() : 0;
    if (editado - criado > 60_000) {
      eventos.push({ id: `${projeto.id}-editado`, projeto, acao: "Atualizou o site", quando: projeto.last_edited_at, agente: AGENTE_POR_ACAO.editado });
    }
    if (projeto.published_at) {
      eventos.push({ id: `${projeto.id}-publicado`, projeto, acao: "Publicou o site", quando: projeto.published_at, agente: AGENTE_POR_ACAO.publicado });
    }
  }
  return eventos.sort((a, b) => new Date(b.quando).getTime() - new Date(a.quando).getTime()).slice(0, 5);
};

const slugDoProjeto = (projeto: UserProject) => {
  const meta = projeto.metadata as Record<string, unknown> | null;
  return meta && typeof meta.slug === "string" && meta.slug.trim() ? meta.slug.trim() : null;
};

const ProjetosPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { foto } = useProfile();
  const reduceMotion = useReducedMotion();
  const [avatarFalhou, setAvatarFalhou] = useState(false);
  const [menuMaisAberto, setMenuMaisAberto] = useState(false);
  const [aba, setAba] = useState<"visao-geral" | "primeiros-passos" | "ferramentas" | "atividade">("visao-geral");
  // Mesma leitura da tela "Minha loja" (RPC get_user_projects), sem consulta nova.
  const projetosDaLoja = useQuery({
    queryKey: ["home-projetos-da-loja", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 60_000,
    queryFn: fetchUserProjects,
  });
  // A animação de primeira entrada é da Início; aqui a página abre já parada.
  const introState = "done" as "pending" | "waiting" | "play" | "done";
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const [conectandoMl, setConectandoMl] = useState(false);
  
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  // Inicia o OAuth do Mercado Livre. O helper só
  // redireciona para auth.mercadolivre.com, então uma resposta adulterada da
  // função não consegue mandar o usuário para outro domínio.
  const conectarMercadoLivre = async () => {
    if (conectandoMl) return;
    setConectandoMl(true);
    try {
      // Nova aba: a Velo continua aberta enquanto o usuário conecta.
      await startMercadoLivreOAuth({ novaAba: true });
      setConectandoMl(false);
    } catch (erro) {
      setConectandoMl(false);
      veloToast.error(erro instanceof Error ? erro.message : "Não foi possível abrir a conexão com o Mercado Livre");
    }
  };

  useEffect(() => {
    if (!menuMaisAberto) return;
    const fecharComEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuMaisAberto(false);
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [menuMaisAberto]);

  useEffect(() => {
    if (!user?.id) {
      setOnboardingStatus(null);
      return;
    }

    let cancelled = false;

    const loadOnboardingStatus = async () => {
      const [integrationResult, publicationsResult] = await Promise.all([
        supabase
          .from("user_integrations")
          .select("id,access_token")
          .eq("user_id", user.id)
          .eq("platform", "mercadolivre")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("user_publications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      if (cancelled) return;

      if (integrationResult.error || publicationsResult.error) {
        setOnboardingStatus(null);
        return;
      }

      setOnboardingStatus({
        mlConnected: Boolean(integrationResult.data?.access_token),
        hasPublication: (publicationsResult.count ?? 0) > 0,
      });
    };

    void loadOnboardingStatus();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const playIntro = introState === "play";
  // O blur de saída suaviza o fade: sem ele a opacidade sozinha lê como um "liga/desliga".
  const revealProps = (delay: number, distance = 12) => playIntro
    ? {
        initial: { opacity: 0, y: distance, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        transition: { delay, duration: INTRO.revealDuration, ease: INTRO.revealEase },
      }
    : {
        // Sem introdução não há blur a desfazer — evita criar camada de composição à toa.
        initial: false as const,
        animate: { opacity: 1, y: 0 },
      };

  const go = (path: string) => () => navigate(path);
  const onboardingProgress = onboardingStatus
    ? Math.round(
        ([onboardingStatus.mlConnected, onboardingStatus.hasPublication].filter(Boolean).length / 2) * 100,
      )
    : null;
  const nextStepCopy = !onboardingStatus
    ? "Consulte suas integrações e continue a configuração da sua conta."
    : !onboardingStatus.mlConnected
      ? "Conecte o Mercado Livre para publicar produtos e receber seus pedidos na Velo."
      : !onboardingStatus.hasPublication
        ? "Sua conta está conectada. Agora escolha um produto e faça a primeira publicação."
        : "Tudo pronto: acompanhe seus anúncios publicados e continue expandindo o catálogo.";
  const nextStepLabel = !onboardingStatus
    ? "Ver integrações"
    : !onboardingStatus.mlConnected
      ? "Conectar agora"
      : !onboardingStatus.hasPublication
        ? "Escolher produto"
        : "Ver publicações";
  const handleNextStep = () => {
    if (!onboardingStatus) {
      // Este passo é sobre o Mercado Livre, que mora nas configurações —
      // /dashboard/integracoes é a tela de lojas Shopify.
      navigate("/dashboard/configuracoes?tab=Integrações");
      return;
    }
    if (!onboardingStatus.mlConnected) {
      void conectarMercadoLivre();
      return;
    }
    navigate(onboardingStatus.hasPublication ? "/dashboard/publicacoes" : "/dashboard/catalogo");
  };
  if (introState === "pending" || introState === "waiting") {
    return (
      <main
        aria-hidden="true"
        className="shrink-0 bg-white -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
      />
    );
  }

  const mlConectado = Boolean(onboardingStatus?.mlConnected);
  const temPublicacao = Boolean(onboardingStatus?.hasPublication);
  const abrirBusca = () => window.dispatchEvent(new Event(ABRIR_BUSCA_EVENT));
  const acaoMercadoLivre = mlConectado ? go("/dashboard/configuracoes?tab=Integrações") : conectarMercadoLivre;

  // Linhas no estilo "Recent activity" da referência: miniatura, título,
  // descrição, uma linha de apoio e ações em botões-ícone à direita.
  type Linha = {
    id: string;
    thumb: ReactNode;
    title: string;
    description: string;
    meta: string;
    actions: { label: string; icon: ElementType; onClick: () => void; busy?: boolean }[];
  };
  const thumbIcone = (Icone: ElementType, cor: string, fundo: string) => (
    <span className="flex h-full w-full items-center justify-center" style={{ background: fundo, color: cor }}>
      <Icone size={18} strokeWidth={1.5} />
    </span>
  );
  const thumbImagem = (src: string, extra = "object-cover") => (
    <img src={src} alt="" className={`h-full w-full ${extra}`} draggable={false} />
  );

  const linhaProximoPasso: Linha = {
    id: "proximo-passo",
    thumb: thumbIcone(Sparkles, "#2F5BEA", "#EEF2FE"),
    title: "Próximo passo",
    description: nextStepCopy,
    meta: onboardingProgress === null ? "Progresso indisponível" : `${onboardingProgress}% concluído`,
    actions: [{ label: conectandoMl ? "Abrindo…" : nextStepLabel, icon: ArrowRight, onClick: handleNextStep, busy: conectandoMl }],
  };
  const linhaMercadoLivre: Linha = {
    id: "mercado-livre",
    thumb: (
      <span className="flex h-full w-full items-center justify-center bg-[#FFF8CC]">
        <img src="/brand/mercado-livre.png" alt="" width={200} height={200} className="h-6 w-6 object-contain" />
      </span>
    ),
    title: "Venda no Mercado Livre",
    description: "Conecte sua conta, publique anúncios e acompanhe os pedidos.",
    meta: mlConectado ? "Conta conectada" : "Pronta para conectar",
    actions: [{
      label: conectandoMl ? "Conectando…" : mlConectado ? "Gerenciar conta" : "Conectar conta",
      icon: mlConectado ? Settings2 : Link2,
      onClick: acaoMercadoLivre,
      busy: conectandoMl,
    }],
  };
  const linhaPublicacao: Linha = {
    id: "publicacao",
    thumb: thumbIcone(temPublicacao ? Check : Archive, temPublicacao ? "#16A34A" : "#4B5563", temPublicacao ? "#E9F7EF" : "#F1F3F6"),
    title: temPublicacao ? "Primeira publicação feita" : "Fazer a primeira publicação",
    description: temPublicacao ? "Acompanhe seus anúncios publicados." : "Escolha um produto do catálogo e publique no Mercado Livre.",
    meta: temPublicacao ? "Concluído" : "Pendente",
    actions: [{
      label: temPublicacao ? "Ver publicações" : "Escolher produto",
      icon: temPublicacao ? FileText : ShoppingBag,
      onClick: go(temPublicacao ? "/dashboard/publicacoes" : "/dashboard/catalogo"),
    }],
  };
  const linhaTemas: Linha = {
    id: "temas",
    thumb: thumbImagem(cardTemasImg),
    title: "Escolha o visual da sua loja",
    description: "Selecione um template profissional e personalize para refletir a sua marca.",
    meta: "Templates",
    actions: [{ label: "Ver temas", icon: LayoutTemplate, onClick: go("/dashboard/modelos") }],
  };
  const linhaAfiliados: Linha = {
    id: "afiliados",
    thumb: thumbIcone(BadgePercent, "#6D28D9", "#F3EEFF"),
    title: "Programa de afiliados",
    description: "Indique a Velo e ganhe 30% na primeira venda de cada novo cliente.",
    meta: "30% de comissão · por novo cliente",
    actions: [{ label: "Quero ser afiliado", icon: ArrowRight, onClick: go("/dashboard/comissoes") }],
  };
  const linhaPaginaIa: Linha = {
    id: "pagina-ia",
    thumb: thumbIcone(Wand2, "#0F766E", "#E6F6F3"),
    title: "Página de vendas com IA",
    description: "Crie uma página profissional para apresentar e vender seu produto.",
    meta: "Velo IA · pronta para publicar",
    actions: [{ label: "Criar página", icon: Plus, onClick: go("/dashboard/paginas-com-ia/criar") }],
  };

  const ABAS = [
    { id: "visao-geral", label: "Visão geral" },
    { id: "primeiros-passos", label: "Primeiros passos" },
    { id: "ferramentas", label: "Ferramentas" },
    { id: "atividade", label: "Atividade" },
  ] as const;
  const mostrarDestaque = aba === "visao-geral" || aba === "primeiros-passos";
  const mostrarAtividade = aba === "visao-geral" || aba === "atividade";
  const eventos = eventosDoSite(projetosDaLoja.data ?? []);
  const abrirEditor = (projeto: UserProject) =>
    navigate(`/minha-loja/editor/${projeto.id}`, { state: { projectId: projeto.id, sourceId: projeto.source_id } });
  const listas: { titulo: string; linhas: Linha[] }[] =
    aba === "visao-geral"
      ? [{ titulo: "Ferramentas", linhas: [linhaTemas, linhaPaginaIa, linhaAfiliados] }]
      : aba === "primeiros-passos"
        ? [{ titulo: "Primeiros passos", linhas: [linhaProximoPasso, linhaTemas, linhaMercadoLivre, linhaPublicacao] }]
        : aba === "ferramentas"
          ? [{ titulo: "Ferramentas", linhas: [linhaTemas, linhaPaginaIa, linhaAfiliados] }]
          : [];

  return (
    <main
      className="velo-fonte-inter velo-home-root shrink-0 overflow-auto bg-white text-[#0B0D12] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
    >
      <style>{HOME_CSS}</style>

      {/* Header: busca à esquerda, "+" azul e avatar à direita (como na referência). */}
      <motion.header {...revealProps(0, -6)} className="mx-auto flex h-[72px] w-full max-w-[1120px] items-center justify-between gap-4 px-4 md:px-10">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={abrirBusca}
            aria-label="Buscar produtos, lojas e telas"
            className="velo-home-search flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-[#F5F6F8] px-4 text-left text-[14px] text-[#8A93A3]"
          >
            <Search size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="flex-1 truncate">Buscar produtos, lojas...</span>
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={go("/dashboard/catalogo")}
            aria-label="Adicionar produto"
            title="Adicionar produto"
            className="velo-home-plus flex h-10 w-10 items-center justify-center rounded-full text-white"
          >
            <Plus size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={go("/dashboard/configuracoes")}
            aria-label="Configurações da conta"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#F1F3F6] text-[#8A93A3]"
          >
            {foto && !avatarFalhou ? (
              <img src={foto} alt="" onError={() => setAvatarFalhou(true)} className="h-full w-full object-cover" />
            ) : (
              <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </motion.header>

      <div className="mx-auto w-full max-w-[1120px] px-4 pb-14 md:px-10">
        {/* Topo no desenho da referência: breadcrumb, título com ações à direita,
            subtítulo e abas logo abaixo. */}
        <motion.div {...revealProps(0.05, 10)} className="pt-4">
          <p className="m-0 text-[13px] text-[#8A93A3]">Início / Projetos</p>
          <div className="mt-3 flex items-center justify-between gap-6">
            <h1 className="m-0 min-w-0 truncate text-[32px] font-semibold leading-tight tracking-[-0.02em]">
              Seus projetos
            </h1>
            <div className="relative flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setTutorialOpen(true)}
                aria-label="Ver tutorial de início"
                className="velo-home-ghost flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium text-[#0B0D12]"
              >
                Ver tutorial
              </button>
              <button
                type="button"
                onClick={() => setMenuMaisAberto((aberto) => !aberto)}
                aria-label="Mais opções"
                aria-haspopup="menu"
                aria-expanded={menuMaisAberto}
                className="velo-home-ghost flex h-9 w-9 items-center justify-center rounded-full text-[#4B5563]"
              >
                <MoreHorizontal size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
              {menuMaisAberto && (
                <>
                  <button
                    type="button"
                    aria-label="Fechar menu"
                    tabIndex={-1}
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setMenuMaisAberto(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 top-11 z-50 w-56 rounded-[14px] border border-[#ECEEF2] bg-white p-1.5"
                    style={{ boxShadow: CARD_SHADOW }}
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
                            setMenuMaisAberto(false);
                            navigate(item.to);
                          }}
                          className="velo-home-row flex h-9 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-left text-[13px] font-medium text-[#4B5563]"
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
          </div>
          <p className="m-0 mt-1.5 text-[15px] text-[#8A93A3]">Os sites das suas lojas e o que os agentes estão fazendo neles.</p>
        </motion.div>

        {/* Abas */}
        <motion.div {...revealProps(0.1, 8)} role="tablist" aria-label="Seções da Início" className="mt-7 flex gap-10">
          {ABAS.map((item) => {
            const ativa = aba === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={() => setAba(item.id)}
                className="relative h-10 text-[14px] font-medium transition-colors duration-150 hover:text-[#4B5563]"
                style={ativa ? { color: "#2F5BEA" } : { color: "#8A93A3" }}
              >
                {item.label}
                {ativa && (
                  <motion.span
                    layoutId="projetos-aba-ativa"
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#2F5BEA]"
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  />
                )}
              </button>
            );
          })}
        </motion.div>

        <div className="relative">
          <div>
            {/* Banner "Loja, Agentes, Resultados": imagem inteira (sem corte) numa faixa de 280px; o fundo da faixa tem a cor do fundo dela. */}
            {mostrarDestaque && (
              <motion.section
                {...revealProps(0.3, 12)}
                                aria-label="Destaque da Velo"
                className="mt-6 overflow-hidden rounded-[20px] bg-[#F7F3ED]"
              >
                <img
                  src={bannerResultados}
                  alt="Loja, Agentes, Resultados. Você cria a loja. Os agentes cuidam dela."
                  width={1672}
                  height={941}
                  className="mx-auto block h-[280px] w-auto select-none object-contain"
                  draggable={false}
                />
              </motion.section>
            )}

            {/* Atividade recente: o trabalho dos agentes no site da loja, no desenho
                "Recent activity" da referência. */}
            {mostrarAtividade && (
              <motion.section {...revealProps(0.38, 12)} aria-labelledby="home-atividade" className="mt-8">
                <div className="flex items-baseline justify-between gap-4">
                  <h3 id="home-atividade" className="m-0 text-[15px] font-semibold tracking-[-0.02em]">Atividade recente</h3>
                  <span className="text-[13px] text-[#8A93A3]">Site da sua loja</span>
                </div>
                {projetosDaLoja.isLoading ? (
                  <ul className="m-0 mt-2 list-none p-0" aria-label="Carregando atividade">
                    {[0, 1, 2].map((i) => (
                      <li key={i} className="flex min-h-16 items-center gap-3.5 px-2 py-2.5">
                        <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-[#F1F3F6]" />
                        <span className="flex-1 space-y-2">
                          <span className="block h-3 w-40 animate-pulse rounded-full bg-[#F1F3F6]" />
                          <span className="block h-3 w-64 animate-pulse rounded-full bg-[#F5F6F8]" />
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : projetosDaLoja.isError ? (
                  <p className="m-0 mt-3 px-2 text-[13px] text-[#8A93A3]">Não foi possível carregar a atividade da loja agora.</p>
                ) : eventos.length === 0 ? (
                  <div className="mt-2 flex min-h-16 items-center gap-3.5 rounded-[14px] px-2 py-2.5">
                    <img src={agenteSino} alt="" aria-hidden="true" width={44} height={44} className="h-11 w-11 shrink-0 select-none object-contain" draggable={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-[#0B0D12]">Nenhuma atividade no site ainda</span>
                      <span className="block text-[13px] text-[#8A93A3]">Crie o site da sua loja e acompanhe aqui cada mudança.</span>
                    </span>
                    <button
                      type="button"
                      onClick={go("/dashboard/minha-loja")}
                      className="velo-home-secondary flex h-9 shrink-0 items-center gap-2 rounded-[10px] px-3 text-[13px] font-medium text-[#0B0D12]"
                    >
                      Criar minha loja
                      <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <ul className="m-0 mt-2 list-none p-0">
                    {eventos.map((evento) => {
                      const slug = evento.projeto.status === "publicado" ? slugDoProjeto(evento.projeto) : null;
                      return (
                        <li key={evento.id} className="velo-home-row flex min-h-16 items-center gap-3.5 rounded-[14px] px-2 py-2.5">
                          {/* PNG do agente solto, sem moldura: fundo transparente como na referência. */}
                          <img src={evento.agente} alt="" aria-hidden="true" width={44} height={44} className="h-11 w-11 shrink-0 select-none object-contain" draggable={false} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-[#0B0D12]">{evento.projeto.nome}</span>
                            <span className="block truncate text-[13px] text-[#8A93A3]">
                              {evento.acao} · {evento.projeto.tipo_projeto === "loja_completa" ? "Loja completa" : "Página de venda"}
                            </span>
                            <span className="block text-[12px] text-[#B4BBC6]">{tempoRelativo(evento.quando)}</span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            {slug && (
                              <button
                                type="button"
                                onClick={go(`/loja/${slug}`)}
                                aria-label="Ver site publicado"
                                title="Ver site publicado"
                                className="velo-home-secondary flex h-9 w-9 items-center justify-center rounded-[10px] text-[#4B5563]"
                              >
                                <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => abrirEditor(evento.projeto)}
                              aria-label="Abrir no editor"
                              title="Abrir no editor"
                              className="velo-home-secondary flex h-9 w-9 items-center justify-center rounded-[10px] text-[#4B5563]"
                            >
                              <PenLine size={16} strokeWidth={1.5} aria-hidden="true" />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </motion.section>
            )}

            {/* Listas no estilo "Recent activity" */}
            {listas.map((lista, indiceLista) => (
              <motion.section
                key={`${aba}-${lista.titulo}`}
                {...revealProps(0.46 + indiceLista * 0.08, 12)}
                aria-label={lista.titulo}
                className="mt-8"
              >
                <h3 className="m-0 text-[15px] font-semibold tracking-[-0.02em]">{lista.titulo}</h3>
                <ul className="m-0 mt-2 list-none p-0">
                  {lista.linhas.map((linha) => (
                    <li key={linha.id} className="velo-home-row flex min-h-16 items-center gap-3.5 rounded-[14px] px-2 py-2.5">
                      <span aria-hidden="true" className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#ECEEF2]">
                        {linha.thumb}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-[#0B0D12]">{linha.title}</span>
                        <span className="block truncate text-[13px] text-[#8A93A3]">{linha.description}</span>
                        <span className="block truncate text-[12px] text-[#B4BBC6]">{linha.meta}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {linha.actions.map((acao) => {
                          const Icone = acao.icon;
                          return (
                            <button
                              key={acao.label}
                              type="button"
                              onClick={acao.onClick}
                              disabled={acao.busy}
                              aria-label={acao.label}
                              title={acao.label}
                              className="velo-home-secondary group flex h-9 items-center gap-2 rounded-[10px] px-2.5 text-[13px] font-medium text-[#4B5563] disabled:cursor-wait disabled:opacity-70"
                            >
                              <span className="velo-home-row-label hidden sm:inline">{acao.label}</span>
                              <Icone size={16} strokeWidth={1.5} aria-hidden="true" />
                            </button>
                          );
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.section>
            ))}
          </div>

        </div>
      </div>
      <VideoTutorialModal
        open={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        title={TUTORIAL_INICIO.title}
        description={TUTORIAL_INICIO.description}
        src={TUTORIAL_INICIO.src}
        aspectPadding={TUTORIAL_INICIO.aspectPadding}
      />
    </main>
  );
};

export default ProjetosPage;
