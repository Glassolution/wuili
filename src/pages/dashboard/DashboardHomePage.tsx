import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Archive, ArrowRight, ArrowUp, BadgePercent, Check, LayoutTemplate, PlayCircle, Plus, Search, Sparkles, Store, UserRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
import { useAuth } from "@/contexts/AuthContext";
import AtlasHistoryMenu from "@/components/dashboard/AtlasHistoryMenu";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import { ENTRADA_POS_ONBOARDING, hasPlayedDashboardIntro, markDashboardIntroAsPlayed } from "@/lib/dashboardIntro";
import { ONBOARDING_COMPLETED_EVENT, shouldShowOnboarding } from "@/components/onboarding/OnboardingModal";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import cardProdutoImg from "@/assets/home-card-produto.webp";
import cardTemasImg from "@/assets/home-card-temas.webp";
import { ABRIR_BUSCA_EVENT } from "@/lib/abrirBusca";
import { useProfile } from "@/lib/profileContext";
import MobileHome from "@/components/dashboard/MobileHome";
import VideoTutorialModal from "@/components/dashboard/VideoTutorialModal";
import { Button } from "@/components/ui/button";

import { useIsMobile } from "@/hooks/use-mobile";

type AtlasMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  product_data?: AtlasMessageData | null;
};

type AtlasNavigationAction = {
  type: "navigation";
  label: string;
  route: string;
  /** "primary" usa o Botão Pilot (fundo escuro sólido). */
  variant?: "primary";
  reason?: string;
};

type AtlasProductCardAction = {
  type: "product_card";
  product_id: string;
  reason?: string;
  product?: {
    id?: string;
    title?: string;
    image_url?: string | null;
    margin_percent?: number | null;
    suggested_price?: number | null;
    route?: string;
  };
};

type AtlasQuickReplyAction = {
  type: "quick_reply";
  label: string;
  message: string;
};

type AtlasConnectMlAction = {
  type: "connect_ml";
  label: string;
};

type AtlasAction =
  | AtlasNavigationAction
  | AtlasProductCardAction
  | AtlasQuickReplyAction
  | AtlasConnectMlAction;

type AtlasMessageData = {
  actions?: AtlasAction[];
};

type OnboardingStatus = {
  mlConnected: boolean;
  hasPublication: boolean;
};

const CHAT_SUGGESTIONS = [
  "Crie um anúncio de produto",
  "Ajude-me a encontrar produtos",
  "Ajude-me a começar",
  "Gere imagens para um produto",
  "Escreva uma descrição de produto",
  "Ajude-me a encontrar uma ideia de negócio",
];
const CHAT_PROMPT_SUGGESTIONS = [
  "Ajude-me a começar",
  "Encontre produtos vencedores",
  "Crie um anúncio para meu produto",
  "Gere imagens para meu produto",
  "Escreva uma descrição persuasiva",
  "Me dê uma ideia de negócio",
];

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
const CARD_SHADOW_FOCO = "0 1px 2px rgba(16,24,40,0.05), 0 12px 32px rgba(47,91,234,0.10)";

// Estados de hover/foco dos botões e cards desta tela (tokens do redesign).
const HOME_CSS = `
.velo-home-card { background: #FFFFFF; border: 1px solid #ECEEF2; border-radius: 20px; box-shadow: ${CARD_SHADOW}; }
.velo-home-dark { background: #0B0D12; transition: background-color 150ms ease-out, transform 150ms ease-out; }
.velo-home-dark:hover { background: #1F232B; }
.velo-home-accent { background: #2F5BEA; transition: background-color 150ms ease-out, opacity 150ms ease-out; }
.velo-home-accent:hover:not(:disabled) { background: #2449C7; }
.velo-home-secondary { background: #FFFFFF; border: 1px solid #ECEEF2; transition: background-color 150ms ease-out, border-color 150ms ease-out; }
.velo-home-secondary:hover:not(:disabled) { background: #F7F8FA; border-color: #DCE0E7; }
.velo-home-ghost { background: transparent; transition: background-color 150ms ease-out, color 150ms ease-out; }
.velo-home-ghost:hover { background: #F1F3F6; color: #0B0D12; }
.velo-home-search { transition: background-color 150ms ease-out; }
.velo-home-search:hover { background: #ECEEF2; }
.velo-home-dark:focus-visible, .velo-home-accent:focus-visible, .velo-home-secondary:focus-visible, .velo-home-ghost:focus-visible, .velo-home-search:focus-visible {
  outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(47,91,234,0.45);
}
`;

const AssistantAvatar = () => (
  <AtlasAvatarIcon style={{ display: "block", width: "100%", height: "100%" }} />
);

const AnimatedPromptText = ({
  text,
  reduceMotion,
}: {
  text: string;
  reduceMotion: boolean;
}) => {
  const containerVariants = reduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    : {
        hidden: {
          opacity: 1,
          transition: { staggerChildren: 0.008, staggerDirection: -1 },
        },
        visible: {
          opacity: 1,
          transition: { staggerChildren: 0.012 },
        },
      };
  const letterVariants = reduceMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      }
    : {
        hidden: { opacity: 0, filter: "blur(5px)" },
        visible: { opacity: 1, filter: "blur(0px)" },
      };

  return (
    <motion.span
      aria-hidden="true"
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={containerVariants}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        textAlign: "left",
        color: "#8A93A3",
        fontSize: 15,
        fontWeight: 400,
        lineHeight: 1,
        overflow: "hidden",
        pointerEvents: "none",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        willChange: "opacity, filter",
      }}
    >
      {Array.from(text).map((letter, index) => (
        <motion.span
          key={`${text}-${index}`}
          variants={letterVariants}
          transition={{
            duration: reduceMotion ? 0.14 : 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          style={{ display: "inline-block", whiteSpace: letter === " " ? "pre" : "normal" }}
        >
          {letter}
        </motion.span>
      ))}
    </motion.span>
  );
};

const isAtlasAction = (action: unknown): action is AtlasAction => {
  if (!action || typeof action !== "object") return false;
  const candidate = action as Record<string, unknown>;
  if (candidate.type === "navigation") {
    return typeof candidate.label === "string" && typeof candidate.route === "string";
  }
  if (candidate.type === "product_card") {
    return typeof candidate.product_id === "string";
  }
  if (candidate.type === "quick_reply") {
    return typeof candidate.label === "string" && typeof candidate.message === "string";
  }
  if (candidate.type === "connect_ml") {
    return typeof candidate.label === "string";
  }
  return false;
};

const normalizeAtlasActions = (value: unknown): AtlasAction[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isAtlasAction).slice(0, 12);
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nomeCurto, foto } = useProfile();
  const [avatarFalhou, setAvatarFalhou] = useState(false);
  const {
    enviar: enviarParaAtlas,
    mensagens: chatMessages,
    threadId,
    abrirConversa,
    aoApagarConversa,
  } = useAtlasChat();
  const reduceMotion = useReducedMotion();
  const introDecisionMade = useRef<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const welcomeChatRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);
  const suggestionListRef = useRef<HTMLDivElement>(null);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  // "waiting": o onboarding está na frente da home. A intro fica guardada para
  // tocar quando ele fecha — antes ela rodava escondida atrás do modal e a pessoa
  // caía numa tela já parada.
  const [introState, setIntroState] = useState<"pending" | "waiting" | "play" | "done">("pending");
  const [chatActive, setChatActive] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [tutorialOpen, setTutorialOpen] = useState(false);

  /**
   * Existe conversa anterior para mostrar no histórico?
   *
   * A contagem é de mensagens, não de threads, de propósito: abrir o chat em
   * tela cheia cria uma thread vazia, e uma lista só de "Nova conversa" não é
   * histórico nenhum. Se a pessoa já escreveu alguma coisa, aí sim tem o que
   * reabrir. Só consulta quando o chat abre — antes disso o botão nem existe.
   */
  const { data: temHistorico = false } = useQuery({
    queryKey: ["atlas-tem-historico", user?.id],
    enabled: Boolean(user?.id) && chatActive,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("atlas_messages")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id);
      if (error) throw new Error(error.message);
      return (count ?? 0) > 0;
    },
  });
  const [conectandoMl, setConectandoMl] = useState(false);
  
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus | null>(null);
  // Inicia o OAuth do Mercado Livre a partir do próprio chat. O helper só
  // redireciona para auth.mercadolivre.com, então uma resposta adulterada da
  // função não consegue mandar o usuário para outro domínio.
  const conectarMercadoLivre = async () => {
    if (conectandoMl) return;
    setConectandoMl(true);
    try {
      // Nova aba: o guia do Atlas continua aberto enquanto o usuário conecta.
      await startMercadoLivreOAuth({ novaAba: true });
      setConectandoMl(false);
    } catch (erro) {
      setConectandoMl(false);
      veloToast.error(erro instanceof Error ? erro.message : "Não foi possível abrir a conexão com o Mercado Livre");
    }
  };

  const [hoveredSuggestion, setHoveredSuggestion] = useState<string | null>(null);
  const [promptSuggestionIndex, setPromptSuggestionIndex] = useState(0);

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
    if (!chatActive) return;

    const focusTimer = window.setTimeout(() => chatInputRef.current?.focus(), reduceMotion ? 0 : 180);
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && chatMessages.length === 0) {
        setChatActive(false);
        setChatInput("");
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [chatActive, chatMessages.length, reduceMotion]);

  useEffect(() => {
    if (!chatActive || chatMessages.length > 0) return;

    const closeWelcomeChat = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        welcomeChatRef.current?.contains(target) ||
        historyMenuRef.current?.contains(target) ||
        suggestionListRef.current?.contains(target)
      ) return;

      setChatActive(false);
      setChatInput("");
      setHoveredSuggestion(null);
      chatInputRef.current?.blur();
    };

    window.addEventListener("pointerdown", closeWelcomeChat);
    return () => window.removeEventListener("pointerdown", closeWelcomeChat);
  }, [chatActive, chatMessages.length]);

  useEffect(() => {
    if (chatActive || chatInput.trim()) return;

    const suggestionTimer = window.setInterval(() => {
      setPromptSuggestionIndex((current) => (current + 1) % CHAT_PROMPT_SUGGESTIONS.length);
    }, 2600);

    return () => window.clearInterval(suggestionTimer);
  }, [chatActive, chatInput]);

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

  useEffect(() => {
    const scrollArea = conversationScrollRef.current;
    if (!scrollArea) return;
    if (scrollArea.scrollHeight <= scrollArea.clientHeight) return;

    scrollArea.scrollTo({
      top: scrollArea.scrollHeight,
      behavior: "auto",
    });
  }, [chatMessages.length]);

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
  // Toda a conversa (mensagens, ações, envio) vive no AtlasChatProvider e é
  // desenhada pelo AtlasDockPanel. Aqui sobrou só disparar a primeira mensagem.
  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!chatActive) {
      setChatActive(true);
      return;
    }
    const texto = chatInput.trim();
    if (!texto) return;
    setChatInput("");
    void enviarParaAtlas(texto);
  };

  if (introState === "pending" || introState === "waiting") {
    return (
      <main
        aria-hidden="true"
        className="shrink-0 bg-[#F7F8FA] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
      />
    );
  }

  // A conversa não vive mais aqui: ela é renderizada pelo AtlasDockPanel, que
  // fica no layout e por isso sobrevive à navegação. Esta página cuida só da
  // tela de boas-vindas e de disparar a primeira mensagem.

  const primeiroNome = nomeCurto && nomeCurto !== "Usuario" ? nomeCurto.split(" ")[0] : null;
  const mlConectado = Boolean(onboardingStatus?.mlConnected);
  const temPublicacao = Boolean(onboardingStatus?.hasPublication);
  const abrirBusca = () => window.dispatchEvent(new Event(ABRIR_BUSCA_EVENT));
  const acaoMercadoLivre = mlConectado ? go("/dashboard/configuracoes?tab=Integrações") : conectarMercadoLivre;
  const atividades = [
    {
      id: "proximo-passo",
      icon: Sparkles,
      title: "Próximo passo",
      description: nextStepCopy,
      label: conectandoMl ? "Abrindo…" : nextStepLabel,
      onClick: handleNextStep,
      done: false,
    },
    {
      id: "mercado-livre",
      icon: Store,
      title: mlConectado ? "Mercado Livre conectado" : "Conectar o Mercado Livre",
      description: mlConectado
        ? "Sua conta está pronta para publicar e receber pedidos."
        : "Conecte sua conta para publicar produtos e receber pedidos.",
      label: conectandoMl ? "Conectando…" : mlConectado ? "Gerenciar conta" : "Conectar conta",
      onClick: acaoMercadoLivre,
      done: mlConectado,
    },
    {
      id: "publicacao",
      icon: Archive,
      title: temPublicacao ? "Primeira publicação feita" : "Fazer a primeira publicação",
      description: temPublicacao
        ? "Acompanhe seus anúncios publicados."
        : "Escolha um produto do catálogo e publique no Mercado Livre.",
      label: temPublicacao ? "Ver publicações" : "Escolher produto",
      onClick: go(temPublicacao ? "/dashboard/publicacoes" : "/dashboard/catalogo"),
      done: temPublicacao,
    },
  ];

  return (
    <main
      className="shrink-0 overflow-auto bg-[#F7F8FA] text-[#0B0D12] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
    >
      <style>{HOME_CSS}</style>

      {/* Header da área principal */}
      <motion.header
        {...revealProps(0, -6)}
        className="flex h-[72px] items-center justify-between gap-4 px-4 md:px-10"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-[13px] font-medium text-[#8A93A3]">Início</span>
          {/* Histórico das conversas: só com o chat aberto e com conversa
              anterior de verdade — num primeiro acesso abriria uma lista vazia. */}
          <AnimatePresence>
            {chatActive && temHistorico && (
              <motion.div
                ref={historyMenuRef}
                key="atalho-historico"
                initial={reduceMotion ? false : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <AtlasHistoryMenu
                  userId={user?.id}
                  activeThreadId={threadId}
                  onSelectThread={abrirConversa}
                  onThreadDeleted={aoApagarConversa}
                  triggerLabel="Suas conversas"
                  triggerStyle={{
                    height: 36,
                    borderRadius: 999,
                    border: "1px solid #ECEEF2",
                    background: "#FFFFFF",
                    boxShadow: "none",
                    color: "#0B0D12",
                    fontSize: 13,
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={abrirBusca}
            aria-label="Buscar produtos, lojas e telas"
            className="velo-home-search hidden h-10 w-[320px] items-center gap-2.5 rounded-full bg-[#F1F3F6] px-4 text-left text-[14px] text-[#8A93A3] lg:flex"
          >
            <Search size={16} strokeWidth={1.5} aria-hidden="true" />
            <span className="flex-1 truncate">Buscar produtos, lojas...</span>
            <kbd className="rounded-md bg-white px-1.5 text-[11px] font-medium text-[#8A93A3]">/</kbd>
          </button>
          <button
            type="button"
            onClick={() => setTutorialOpen(true)}
            aria-label="Ver tutorial de início"
            className="velo-home-ghost flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium text-[#4B5563]"
          >
            <PlayCircle size={18} strokeWidth={1.5} aria-hidden="true" />
            Ver tutorial
          </button>
          <button
            type="button"
            onClick={go("/dashboard/catalogo")}
            aria-label="Adicionar produto"
            title="Adicionar produto"
            className="velo-home-accent flex h-10 w-10 items-center justify-center rounded-full text-white"
          >
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={go("/dashboard/configuracoes")}
            aria-label="Configurações da conta"
            className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#ECEEF2] bg-[#F1F3F6] text-[#8A93A3]"
          >
            {foto && !avatarFalhou ? (
              <img src={foto} alt="" onError={() => setAvatarFalhou(true)} className="h-full w-full object-cover" />
            ) : (
              <UserRound size={18} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </motion.header>

      <div className="mx-auto w-full max-w-[1200px] px-4 pb-12 md:px-10">
        {/* Hero */}
        <div className="flex flex-col items-center pt-8 text-center md:pt-12">
          <motion.h1
            {...revealProps(0.05, 10)}
            className="m-0 text-[28px] font-semibold leading-tight tracking-[-0.02em] text-[#0B0D12] md:text-[32px]"
          >
            {primeiroNome ? `Bem-vindo, ${primeiroNome}` : "Bem-vindo à Velo"}
          </motion.h1>
          <motion.p
            {...revealProps(0.12, 10)}
            className="m-0 mt-1.5 text-[15px] text-[#8A93A3]"
          >
            Por onde você quer começar?
          </motion.p>

          <motion.div
            {...revealProps(0.22, 12)}
            ref={welcomeChatRef}
            data-dashboard-tour="home-atlas-chat"
            role="search"
            aria-label="Assistente Atlas"
            aria-expanded={chatActive}
            onClick={() => setChatActive(true)}
            className="relative z-[32] mt-7 flex h-14 w-full max-w-[720px] items-center rounded-full border bg-white pl-3 pr-2.5"
            style={{
              borderColor: chatActive ? "rgba(47, 91, 234, 0.28)" : "#ECEEF2",
              boxShadow: chatActive ? CARD_SHADOW_FOCO : CARD_SHADOW,
              transition: "border-color 320ms ease, box-shadow 420ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <form onSubmit={handleChatSubmit} className="flex min-w-0 flex-1 items-center">
              <span aria-hidden="true" className="mr-3 inline-flex h-8 w-8 shrink-0 items-center justify-center">
                <AssistantAvatar />
              </span>
              <span className="relative flex h-full min-w-0 flex-1 items-center">
                <AnimatePresence mode="wait" initial={false}>
                  {!chatActive && !chatInput.trim() && (
                    <AnimatedPromptText
                      key={CHAT_PROMPT_SUGGESTIONS[promptSuggestionIndex]}
                      text={CHAT_PROMPT_SUGGESTIONS[promptSuggestionIndex]}
                      reduceMotion={Boolean(reduceMotion)}
                    />
                  )}
                </AnimatePresence>
                <input
                  ref={chatInputRef}
                  value={chatInput}
                  onFocus={() => setChatActive(true)}
                  onChange={(event) => setChatInput(event.target.value)}
                  aria-label="Mensagem para o Atlas"
                  placeholder={chatActive ? "Pergunte qualquer coisa..." : ""}
                  className="relative z-[1] w-full min-w-0 border-0 bg-transparent text-left text-[15px] text-[#0B0D12] outline-none placeholder:text-[#8A93A3]"
                  style={{ caretColor: "#2F5BEA" }}
                />
              </span>
            </form>
            <button
              type="button"
              aria-label="Escolher produto"
              onClick={(event) => {
                event.stopPropagation();
                navigate("/dashboard/catalogo");
              }}
              className="velo-home-ghost mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[#4B5563]"
            >
              <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Enviar"
              disabled={chatActive && !chatInput.trim()}
              onClick={(event) => {
                event.stopPropagation();
                if (!chatActive) {
                  setChatActive(true);
                  return;
                }
                void enviarParaAtlas(chatInput);
              }}
              className="velo-home-accent flex h-9 w-9 items-center justify-center rounded-full text-white disabled:cursor-default disabled:opacity-40"
            >
              <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </motion.div>
        </div>

        <div className="relative mx-auto mt-10 w-full max-w-[1120px]">
          <motion.div
            aria-hidden={chatActive}
            initial={false}
            animate={chatActive
              ? { opacity: 0, y: reduceMotion ? 0 : 16, filter: "blur(6px)" }
              : { opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: reduceMotion ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
            style={{ pointerEvents: chatActive ? "none" : "auto" }}
          >
            {/* Linha 1: primeiros passos */}
            <motion.div
              {...revealProps(0.34, 14)}
              data-dashboard-tour="home-primeiros-passos"
              className="grid grid-cols-1 gap-4 lg:grid-cols-2"
            >
              <section aria-labelledby="home-card-produto" className="velo-home-card grid grid-cols-1 gap-6 p-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                <div className="flex min-w-0 flex-col items-start">
                  <span className="text-[12px] font-medium text-[#8A93A3]">01</span>
                  <h2 id="home-card-produto" className="m-0 mt-3 text-[20px] font-semibold leading-tight tracking-[-0.02em]">
                    Adicione seu primeiro produto
                  </h2>
                  <p className="m-0 mt-2 text-[14px] leading-relaxed text-[#4B5563]">
                    Comece com nome, preço e fotos. Você pode adicionar mais detalhes depois.
                  </p>
                  <button
                    type="button"
                    onClick={go("/dashboard/catalogo")}
                    className="velo-home-dark mt-6 flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-white sm:mt-auto"
                  >
                    Adicionar produto
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
                <div className="relative min-h-[200px] overflow-hidden rounded-[14px] bg-[#F7F8FA]">
                  <img src={cardProdutoImg} alt="" className="absolute inset-0 h-full w-full select-none object-cover" draggable={false} />
                  {/* O "+" é parte da foto: este botão fica por cima e leva ao mesmo destino. */}
                  <button
                    type="button"
                    onClick={go("/dashboard/catalogo")}
                    aria-label="Adicionar produto"
                    title="Adicionar produto"
                    className="absolute rounded-[16%] transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(11,13,18,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F5BEA]/60"
                    style={{ left: "30%", top: "65%", width: "23%", height: "28.6%" }}
                  />
                </div>
              </section>

              <section aria-labelledby="home-card-temas" className="velo-home-card grid grid-cols-1 gap-6 p-7 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
                <div className="flex min-w-0 flex-col items-start">
                  <span className="text-[12px] font-medium text-[#8A93A3]">02</span>
                  <h2 id="home-card-temas" className="m-0 mt-3 text-[20px] font-semibold leading-tight tracking-[-0.02em]">
                    Escolha o visual da sua loja
                  </h2>
                  <p className="m-0 mt-2 text-[14px] leading-relaxed text-[#4B5563]">
                    Selecione um template profissional e personalize para refletir a sua marca.
                  </p>
                  <button
                    type="button"
                    onClick={go("/dashboard/modelos")}
                    className="velo-home-secondary mt-6 flex h-10 items-center gap-2 rounded-full px-5 text-[14px] font-medium text-[#0B0D12] sm:mt-auto"
                  >
                    Ver temas
                    <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
                <div className="relative min-h-[200px] overflow-hidden rounded-[14px] bg-[#F7F8FA]">
                  <img src={cardTemasImg} alt="" className="absolute inset-0 h-full w-full select-none object-cover" draggable={false} />
                </div>
              </section>
            </motion.div>

            {/* Linha 2: atalhos */}
            <motion.div {...revealProps(0.46, 14)} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <section aria-labelledby="affiliate-card-title" className="velo-home-card flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#F1F3F6] text-[#2F5BEA]">
                    <BadgePercent size={18} strokeWidth={1.5} />
                  </span>
                  <span className="rounded-full bg-[#EEF2FE] px-2.5 py-1 text-[12px] font-medium text-[#2F5BEA]">
                    30% na primeira venda
                  </span>
                </div>
                <h3 id="affiliate-card-title" className="m-0 mt-5 text-[16px] font-semibold tracking-[-0.02em]">
                  Programa de afiliados
                </h3>
                <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-[#4B5563]">
                  Indique a Velo e ganhe 30% na primeira venda de cada novo cliente.
                </p>
                <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                  {["Por novo cliente", "Ganhos acompanhados"].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2 text-[13px] text-[#4B5563]">
                      <Check size={14} strokeWidth={1.75} className="text-[#2F5BEA]" aria-hidden="true" />
                      {benefit}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={go("/dashboard/comissoes")}
                  className="velo-home-secondary mt-6 flex h-10 w-fit items-center gap-2 rounded-full px-5 text-[14px] font-medium text-[#0B0D12]"
                >
                  Quero ser afiliado
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </section>

              <section aria-labelledby="ai-page-card-title" className="velo-home-card flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#F1F3F6] text-[#2F5BEA]">
                    <LayoutTemplate size={18} strokeWidth={1.5} />
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-[#F1F3F6] px-2.5 py-1 text-[12px] font-medium text-[#4B5563]">
                    <Sparkles size={12} strokeWidth={1.75} aria-hidden="true" /> Velo IA
                  </span>
                </div>
                <h3 id="ai-page-card-title" className="m-0 mt-5 text-[16px] font-semibold tracking-[-0.02em]">
                  Página de vendas com IA
                </h3>
                <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-[#4B5563]">
                  Crie uma página profissional para apresentar e vender seu produto.
                </p>
                <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                  <li className="flex items-center gap-2 text-[13px] text-[#4B5563]">
                    <Check size={14} strokeWidth={1.75} className="text-[#2F5BEA]" aria-hidden="true" />
                    Pronta para publicar
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={go("/dashboard/paginas-com-ia/criar")}
                  className="velo-home-secondary mt-6 flex h-10 w-fit items-center gap-2 rounded-full px-5 text-[14px] font-medium text-[#0B0D12] xl:mt-auto"
                >
                  Criar página
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </section>

              <section aria-labelledby="ml-card-title" className="velo-home-card flex flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#F1F3F6]">
                    <img src="/brand/mercado-livre.png" alt="" width={200} height={200} className="h-6 w-6 object-contain" />
                  </span>
                  <span className="flex items-center gap-1.5 rounded-full bg-[#F1F3F6] px-2.5 py-1 text-[12px] font-medium text-[#4B5563]">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: mlConectado ? "#16A34A" : "#B4BBC6" }}
                    />
                    {mlConectado ? "Conta conectada" : "Pronta para conectar"}
                  </span>
                </div>
                <h3 id="ml-card-title" className="m-0 mt-5 text-[16px] font-semibold tracking-[-0.02em]">
                  Venda no Mercado Livre
                </h3>
                <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-[#4B5563]">
                  Conecte sua conta, publique anúncios e acompanhe os pedidos.
                </p>
                <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
                  {["Publicação simplificada", "Pedidos sincronizados"].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-2 text-[13px] text-[#4B5563]">
                      <Check size={14} strokeWidth={1.75} className="text-[#2F5BEA]" aria-hidden="true" />
                      {benefit}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  // /dashboard/integracoes é a tela de lojas Shopify; a conta do
                  // Mercado Livre se gerencia na aba Integrações das configurações.
                  onClick={acaoMercadoLivre}
                  disabled={conectandoMl}
                  className="velo-home-secondary mt-6 flex h-10 w-fit items-center gap-2 rounded-full px-5 text-[14px] font-medium text-[#0B0D12] disabled:cursor-wait disabled:opacity-70"
                >
                  {conectandoMl ? "Conectando…" : mlConectado ? "Gerenciar conta" : "Conectar conta"}
                  <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </section>
            </motion.div>

            {/* Atividade recente (antes "Próximo passo") */}
            <motion.section {...revealProps(0.58, 14)} aria-labelledby="home-atividade" className="velo-home-card px-6 pb-2 pt-5">
              <div className="flex items-center justify-between gap-4 pb-2">
                <h3 id="home-atividade" className="m-0 text-[15px] font-semibold tracking-[-0.02em]">
                  Atividade recente
                </h3>
                <span
                  aria-label={onboardingProgress === null ? "Progresso indisponível" : `${onboardingProgress}% concluído`}
                  className="flex items-center gap-2 text-[13px] text-[#8A93A3]"
                >
                  <span
                    aria-hidden="true"
                    className="block h-5 w-5 rounded-full p-[2.5px]"
                    style={{
                      background: onboardingProgress === null
                        ? "#ECEEF2"
                        : `conic-gradient(#2F5BEA ${onboardingProgress}%, #ECEEF2 0)`,
                    }}
                  >
                    <span className="block h-full w-full rounded-full bg-white" />
                  </span>
                  {onboardingProgress === null ? "—" : `${onboardingProgress}% concluído`}
                </span>
              </div>
              <ul className="m-0 list-none p-0">
                {atividades.map((atividade) => {
                  const Icone = atividade.icon;
                  return (
                    <li
                      key={atividade.id}
                      className="flex min-h-16 items-center gap-3.5 py-3"
                      style={{ borderTop: "1px solid #F1F3F6" }}
                    >
                      <span
                        aria-hidden="true"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: atividade.done ? "#EEF2FE" : "#F1F3F6",
                          color: atividade.done ? "#2F5BEA" : "#4B5563",
                        }}
                      >
                        {atividade.done ? <Check size={16} strokeWidth={1.75} /> : <Icone size={16} strokeWidth={1.5} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-medium text-[#0B0D12]">{atividade.title}</span>
                        <span className="block truncate text-[13px] text-[#8A93A3]">{atividade.description}</span>
                      </span>
                      <button
                        type="button"
                        onClick={atividade.onClick}
                        disabled={conectandoMl && atividade.id !== "publicacao"}
                        className="velo-home-secondary flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-medium text-[#0B0D12] disabled:cursor-wait disabled:opacity-70"
                      >
                        {atividade.label}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.section>
          </motion.div>

          {/* Sugestões do Atlas: ocupam o lugar dos cards enquanto o chat está aberto. */}
          <AnimatePresence>
            {chatActive && (
              <motion.div
                ref={suggestionListRef}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ delay: reduceMotion ? 0 : 0.16, duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 top-[-16px] z-[33] mx-auto flex w-full max-w-[720px] flex-col"
              >
                {CHAT_SUGGESTIONS.map((suggestion, index) => (
                  <motion.button
                    key={suggestion}
                    type="button"
                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{
                      delay: reduceMotion ? 0 : 0.22 + index * 0.06,
                      duration: reduceMotion ? 0 : 0.38,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    onClick={() => void enviarParaAtlas(suggestion)}
                    onMouseEnter={() => setHoveredSuggestion(suggestion)}
                    onMouseLeave={() => setHoveredSuggestion(null)}
                    onFocus={() => setHoveredSuggestion(suggestion)}
                    onBlur={() => setHoveredSuggestion(null)}
                    className="flex h-12 items-center gap-3.5 rounded-xl border-0 px-4 text-left text-[15px] focus-visible:outline-none"
                    style={{
                      background: hoveredSuggestion === suggestion ? "#FFFFFF" : "transparent",
                      boxShadow: hoveredSuggestion === suggestion ? "0 1px 2px rgba(16,24,40,0.04)" : "none",
                      color: hoveredSuggestion === suggestion ? "#0B0D12" : "#4B5563",
                      transition: "background-color 160ms ease, color 160ms ease",
                    }}
                    whileTap={reduceMotion ? undefined : { scale: 0.995 }}
                  >
                    <ArrowRight
                      size={18}
                      strokeWidth={1.5}
                      aria-hidden="true"
                      style={{ opacity: hoveredSuggestion === suggestion ? 0.9 : 0.5, transition: "opacity 150ms ease" }}
                    />
                    <span>{suggestion}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
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

// No celular a home volta ao estilo marketplace (busca, categorias e grade de
// produtos), mais simples e direto do que o painel de onboarding do desktop.
const DashboardHomeRoute = () => {
  const isMobile = useIsMobile();

  if (isMobile) return <MobileHome />;

  return <DashboardHomePage />;
};

export default DashboardHomeRoute;
