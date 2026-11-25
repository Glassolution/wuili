import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import { AiMagicIcon, PlusSignIcon, Search01Icon } from "hugeicons-react";
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

const IMAGE_WIDTH = 1536;
// Layout da Início no estilo da referência (unidades de 1536 de largura).
const PAGE_BG = "#FFFFFF";
const LAYOUT = {
  canvas: 940,
  title: 262,
  box: 342,
  boxHeight: 232,
  cards: 618,
  cardsHeight: 196,
  width: 920,
} as const;
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

// Coreografia da introdução, em segundos. Os blocos entram enquanto o título ainda
// está subindo: a sobreposição é o que faz a sequência ler como um movimento só,
// em vez de uma fila de elementos esperando a vez.
const INTRO = {
  // Desaceleração suave, sem a cauda longa do ease-out exponencial.
  travelEase: [0.32, 0.72, 0, 1] as const,
  revealEase: [0.22, 1, 0.36, 1] as const,
  titleFade: 0.66,
  titleTravelDelay: 0.56,
  titleTravel: 1.05,
  revealDuration: 0.9,
  // O chat vem logo depois do título; o atalho do tutorial entra junto dos cards.
  chatDelay: 1.28,
  promoDelay: 1.5,
  // As faixas são o que descobre os cards de baixo: é aqui que mais se percebia
  // a pressa. Fade mais longo e mais espaço entre elas, para revelarem em cascata
  // em vez de quase juntas.
  bandDuration: 1,
  bandDelays: [1.4, 1.68, 1.96],
};

// Todo o layout desta tela é dimensionado em cqw (relativo à largura do
// container), então sem um teto ele cresce junto com o monitor e no desktop
// fica desproporcional. Travamos a largura do canvas: acima disso o conteúdo
// para de inflar e apenas ganha margem lateral (da mesma cor do fundo, PAGE_BG).
// Abaixo desse valor o comportamento responsivo continua exatamente o mesmo.
// Este é o único número a mexer para calibrar a escala geral da página.
const MAX_CANVAS_WIDTH = 1280;

const x = (value: number) => `${(value / IMAGE_WIDTH) * 100}%`;
const y = (value: number) => `${(value / IMAGE_WIDTH) * 100}cqw`;
const fs = (value: number) => `${(value / IMAGE_WIDTH) * 100}cqw`;

// Os três atalhos embaixo da caixa do Atlas, no estilo da referência (ícone,
// título e uma linha curta). Só levam para páginas que já existem.
const ATALHOS_HOME = [
  { id: "criar", icone: PlusSignIcon, titulo: "Criar", texto: "Site da sua loja", rota: "/dashboard/minha-loja" },
  { id: "encontrar", icone: Search01Icon, titulo: "Encontrar", texto: "Produtos do catálogo", rota: "/dashboard/catalogo" },
  { id: "agentes", icone: AiMagicIcon, titulo: "Agentes", texto: "Projetos e mudanças", rota: "/dashboard/projetos" },
] as const;

const HOME_CSS = `
.velo-home-atalho { transition: background-color 180ms ease-out, border-color 180ms ease-out, transform 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease-out; }
.velo-home-atalho:hover { background-color: #FAFAFA; border-color: #DCDCE0; transform: translateY(-2px); box-shadow: 0 6px 18px rgba(17,17,20,0.05); }
.velo-home-atalho:active { transform: translateY(0) scale(0.99); }
.velo-home-atalho .velo-home-atalho-icone { transition: color 180ms ease-out; }
.velo-home-atalho:hover .velo-home-atalho-icone { color: #18181B; }
.velo-home-atlas .velo-home-atlas-conversas span.font-bold { font-weight: 500 !important; }
.velo-home-atlas .velo-home-atlas-btn { transition: background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out; }
.velo-home-atlas .velo-home-atlas-btn:hover:not(:disabled) { background-color: #F4F4F5; color: #18181B; }
.velo-home-atlas .velo-home-atlas-enviar { transition: background-color 150ms ease-out, transform 150ms ease-out, opacity 150ms ease-out; }
.velo-home-atlas .velo-home-atlas-enviar:hover:not(:disabled) { background-color: #1D4ED8; }
.velo-home-atlas .velo-home-atlas-enviar:active:not(:disabled) { transform: scale(0.95); }
.velo-home-proximo-btn { transition: color 150ms ease-out; }
.velo-home-proximo-btn:hover:not(:disabled) { color: #1D4ED8; }
@media (prefers-reduced-motion: reduce) {
  .velo-home-atalho, .velo-home-atalho .velo-home-atalho-icone, .velo-home-atlas .velo-home-atlas-enviar { transition: none; }
  .velo-home-atalho:hover, .velo-home-atalho:active { transform: none; }
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
        color: "#A1A1AA",
        fontSize: fs(21),
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
  const introTitleOffset = typeof window === "undefined"
    ? 240
    : Math.max(190, Math.min(window.innerHeight * 0.3, 300));
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
        className="shrink-0 -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
        style={{ background: PAGE_BG }}
      />
    );
  }

  // A conversa não vive mais aqui: ela é renderizada pelo AtlasDockPanel, que
  // fica no layout e por isso sobrevive à navegação. Esta página cuida só da
  // tela de boas-vindas e de disparar a primeira mensagem.

  return (
    <main
      className="shrink-0 overflow-auto -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
      style={{ background: PAGE_BG }}
    >
      <style>{HOME_CSS}</style>
      <div
        className="relative mx-auto w-full text-[#101114]"
        style={{ containerType: "inline-size", maxWidth: MAX_CANVAS_WIDTH }}
      >
        {/* Só dá a altura do canvas: tudo abaixo é posicionado em cima dele. */}
        <div aria-hidden="true" style={{ height: y(LAYOUT.canvas) }} />

        <div className="absolute inset-0 font-sans">
          {/* Textura de pontinhos no topo, como na referência, sumindo para baixo. */}
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: y(230),
              backgroundImage: "radial-gradient(rgba(17,17,20,0.11) 1px, transparent 1.2px)",
              backgroundSize: `${fs(14)} ${fs(14)}`,
              WebkitMaskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.5) 45%, transparent 100%)",
              maskImage: "linear-gradient(180deg, #000 0%, rgba(0,0,0,0.5) 45%, transparent 100%)",
              pointerEvents: "none",
            }}
          />

          <motion.div
            {...revealProps(INTRO.promoDelay, -6)}
            style={{
              position: "absolute",
              right: x(30),
              top: y(20),
              zIndex: 40,
            }}
          >
            <Button
              type="button"
              variant="outline"
              onClick={() => setTutorialOpen(true)}
              aria-label="Ver tutorial de início"
              className="gap-2 border-black/[0.09] bg-white/95 font-semibold text-[#101114] shadow-[0_3px_8px_rgba(15,23,42,0.07)] hover:bg-white"
              style={{
                height: y(56),
                minHeight: 40,
                borderRadius: fs(18),
                paddingLeft: fs(15),
                paddingRight: fs(17),
                fontSize: fs(11.8),
              }}
            >
              <PlayCircle aria-hidden="true" style={{ width: fs(17), height: fs(17) }} />
              Ver tutorial
            </Button>
          </motion.div>

          <motion.h1
            initial={playIntro ? { opacity: 0, y: introTitleOffset, scale: 0.985 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            // Transições por propriedade em vez de keyframes com `times`: o título
            // aparece parado, depois sobe. Separar as curvas evita a pausa morta e a
            // frenagem arrastada que a sequência única produzia.
            transition={playIntro
              ? {
                  opacity: { duration: INTRO.titleFade, ease: "easeOut" },
                  scale: { duration: INTRO.titleFade, ease: INTRO.travelEase },
                  y: {
                    delay: INTRO.titleTravelDelay,
                    duration: INTRO.titleTravel,
                    ease: INTRO.travelEase,
                  },
                }
              : { duration: 0 }}
            style={{
              position: "absolute",
              zIndex: 30,
              left: "50%",
              top: y(LAYOUT.title),
              x: "-50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: fs(16),
              margin: 0,
              color: "#18181B",
              fontSize: fs(36),
              fontWeight: 500,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              whiteSpace: "nowrap",
            }}
          >
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              draggable={false}
              style={{ width: fs(38), height: fs(38), objectFit: "contain", userSelect: "none" }}
            />
            Por onde você quer começar?
          </motion.h1>

          {/* Caixa do Atlas no estilo da referência: texto em cima; à esquerda "+"
              e o Atlas, à direita Conversas e o enviar azul. A lógica do chat não mudou. */}
          <motion.div
            {...revealProps(INTRO.chatDelay, 14)}
            ref={welcomeChatRef}
            data-dashboard-tour="home-atlas-chat"
            role="search"
            aria-label="Assistente Atlas"
            aria-expanded={chatActive}
            onClick={() => {
              setChatActive(true);
              chatInputRef.current?.focus();
            }}
            className="velo-home-atlas"
            style={{
              position: "absolute",
              zIndex: 32,
              left: "50%",
              top: y(LAYOUT.box),
              width: x(LAYOUT.width),
              height: y(LAYOUT.boxHeight),
              x: "-50%",
              boxSizing: "border-box",
              borderRadius: fs(28),
              border: chatActive ? "1px solid #D4D4D8" : "1px solid #E4E4E7",
              background: "#FFFFFF",
              boxShadow: chatActive
                ? "0 1px 2px rgba(0,0,0,0.04), 0 12px 32px rgba(17,17,20,0.07)"
                : "0 1px 2px rgba(0,0,0,0.03), 0 8px 24px rgba(17,17,20,0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: `${fs(28)} ${fs(22)} ${fs(22)} ${fs(28)}`,
              cursor: "text",
              transition: "border-color 200ms ease, box-shadow 240ms ease",
            }}
          >
            <form onSubmit={handleChatSubmit} style={{ display: "block", minWidth: 0 }}>
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  minWidth: 0,
                  height: fs(28),
                }}
              >
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
                  placeholder={chatActive ? "Trabalhe com o Atlas" : ""}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    border: 0,
                    outline: 0,
                    padding: 0,
                    background: "transparent",
                    color: "#18181B",
                    caretColor: "#18181B",
                    fontSize: fs(21),
                    fontWeight: 400,
                    lineHeight: 1,
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              </span>
            </form>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: fs(12) }} onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  aria-label="Escolher produto"
                  title="Escolher produto"
                  className="velo-home-atlas-btn"
                  onClick={() => navigate("/dashboard/catalogo")}
                  style={{
                    border: "1px solid #E4E4E7",
                    borderRadius: fs(12),
                    background: "#FFFFFF",
                    color: "#52525B",
                    cursor: "pointer",
                    width: fs(46),
                    height: fs(46),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    boxShadow: "none",
                  }}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: fs(22), height: fs(22), display: "block" }}>
                    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </button>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: fs(10),
                    marginLeft: fs(6),
                    color: "#3F3F46",
                    fontSize: fs(18),
                    fontWeight: 500,
                  }}
                >
                  <span aria-hidden="true" style={{ width: fs(24), height: fs(24), display: "inline-flex", flex: "0 0 auto" }}>
                    <AssistantAvatar />
                  </span>
                  Atlas
                  <span
                    style={{
                      padding: `${fs(4)} ${fs(9)}`,
                      borderRadius: fs(8),
                      background: "#EEF3FF",
                      color: "#2563EB",
                      fontSize: fs(14),
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                  >
                    IA
                  </span>
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: fs(10) }} onClick={(event) => event.stopPropagation()}>
                {temHistorico && (
                  <>
                    <div ref={historyMenuRef} className="velo-home-atlas-conversas">
                      <AtlasHistoryMenu
                        userId={user?.id}
                        activeThreadId={threadId}
                        onSelectThread={abrirConversa}
                        onThreadDeleted={aoApagarConversa}
                        triggerLabel="Conversas"
                        triggerStyle={{
                          height: fs(40),
                          minHeight: 30,
                          borderRadius: fs(10),
                          color: "#3F3F46",
                          fontSize: fs(17),
                        }}
                      />
                    </div>
                    <span aria-hidden="true" style={{ width: 1, height: fs(20), background: "#E4E4E7", margin: `0 ${fs(4)}` }} />
                  </>
                )}
                <button
                  type="button"
                  aria-label="Enviar"
                  className="velo-home-atlas-enviar"
                  disabled={chatActive && !chatInput.trim()}
                  onClick={() => {
                    if (!chatActive) {
                      setChatActive(true);
                      chatInputRef.current?.focus();
                      return;
                    }
                    void enviarParaAtlas(chatInput);
                  }}
                  style={{
                    border: 0,
                    borderRadius: "50%",
                    color: "#FFFFFF",
                    cursor: chatActive && !chatInput.trim() ? "default" : "pointer",
                    background: "#2563EB",
                    opacity: chatActive && !chatInput.trim() ? 0.5 : 1,
                    boxShadow: "none",
                    width: fs(48),
                    height: fs(48),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: fs(22), height: fs(22), display: "block" }}>
                    <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Atalhos e próximo passo: somem quando o chat abre. */}
          <motion.div
            aria-hidden={chatActive}
            initial={false}
            animate={chatActive
              ? { opacity: 0, y: reduceMotion ? 0 : 22, scale: reduceMotion ? 1 : 0.992, filter: "blur(7px)" }
              : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: y(LAYOUT.cards),
              bottom: 0,
              pointerEvents: chatActive ? "none" : "auto",
            }}
          >
            <nav
              aria-label="Atalhos"
              data-dashboard-tour="home-primeiros-passos"
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                width: x(LAYOUT.width),
                transform: "translateX(-50%)",
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: fs(24),
              }}
            >
              {ATALHOS_HOME.map((atalho) => {
                const Icone = atalho.icone;
                return (
                  <button
                    key={atalho.id}
                    type="button"
                    onClick={go(atalho.rota)}
                    className="velo-home-atalho focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/40 focus-visible:ring-offset-2"
                    style={{
                      height: y(LAYOUT.cardsHeight),
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      padding: `${fs(28)} ${fs(28)} ${fs(30)}`,
                      border: "1px solid #E9E9EC",
                      borderRadius: fs(24),
                      background: "#FFFFFF",
                      color: "#18181B",
                      cursor: "pointer",
                      textAlign: "left",
                      boxShadow: "none",
                    }}
                  >
                    <Icone
                      aria-hidden="true"
                      className="velo-home-atalho-icone"
                      strokeWidth={1.5}
                      style={{ width: fs(30), height: fs(30), color: "#71717A" }}
                    />
                    <span style={{ display: "flex", flexDirection: "column", gap: fs(10) }}>
                      <span style={{ fontSize: fs(21), fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.01em" }}>
                        {atalho.titulo}
                      </span>
                      <span style={{ color: "#71717A", fontSize: fs(18), fontWeight: 400, lineHeight: 1.2 }}>
                        {atalho.texto}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>

            {/* Próximo passo (dados reais do Mercado Livre), numa linha discreta. */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: y(LAYOUT.cardsHeight + 34),
                width: x(LAYOUT.width),
                transform: "translateX(-50%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: fs(10),
                color: "#71717A",
                fontSize: fs(15),
                lineHeight: 1.3,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: "#3F3F46", fontWeight: 600 }}>Próximo passo:</span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{nextStepCopy}</span>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={conectandoMl}
                className="velo-home-proximo-btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: fs(4),
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  boxShadow: "none",
                  color: "#2563EB",
                  cursor: conectandoMl ? "wait" : "pointer",
                  fontSize: fs(15),
                  fontWeight: 600,
                  flex: "0 0 auto",
                }}
              >
                {conectandoMl ? "Abrindo…" : nextStepLabel}
                <ArrowRight aria-hidden="true" style={{ width: fs(15), height: fs(15) }} strokeWidth={2.2} />
              </button>
            </div>
          </motion.div>

          <AnimatePresence>
            {chatActive && (
              <>
                <motion.div
                  aria-hidden="true"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.48, ease: "easeOut" }}
                  style={{
                    position: "absolute",
                    zIndex: 24,
                    left: 0,
                    right: 0,
                    top: y(LAYOUT.box + LAYOUT.boxHeight + 6),
                    bottom: 0,
                    background: PAGE_BG,
                    pointerEvents: "none",
                  }}
                />
                <motion.div
                  ref={suggestionListRef}
                  initial={reduceMotion ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: reduceMotion ? 0 : 0.22, duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    position: "absolute",
                    zIndex: 33,
                    left: "50%",
                    top: y(LAYOUT.box + LAYOUT.boxHeight + 16),
                    width: x(LAYOUT.width),
                    x: "-50%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                  }}
                >
                  {CHAT_SUGGESTIONS.map((suggestion, index) => (
                    <motion.button
                      key={suggestion}
                      type="button"
                      initial={reduceMotion ? false : { opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{
                        delay: reduceMotion ? 0 : 0.3 + index * 0.075,
                        duration: reduceMotion ? 0 : 0.42,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                      onClick={() => void enviarParaAtlas(suggestion)}
                      onMouseEnter={() => setHoveredSuggestion(suggestion)}
                      onMouseLeave={() => setHoveredSuggestion(null)}
                      onFocus={() => setHoveredSuggestion(suggestion)}
                      onBlur={() => setHoveredSuggestion(null)}
                      className="focus-visible:outline-none"
                      style={{
                        height: y(58),
                        border: 0,
                        borderRadius: fs(14),
                        background: hoveredSuggestion === suggestion ? "#F4F4F5" : "transparent",
                        color: hoveredSuggestion === suggestion ? "#18181B" : "#71717A",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: fs(18),
                        padding: `0 ${fs(18)}`,
                        fontSize: fs(18),
                        fontWeight: 500,
                        lineHeight: 1,
                        textAlign: "left",
                        boxShadow: "none",
                        transition: "background-color 180ms ease, color 180ms ease, transform 180ms ease",
                      }}
                      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        style={{
                          width: fs(24),
                          height: fs(24),
                          flex: "0 0 auto",
                          opacity: hoveredSuggestion === suggestion ? 0.9 : 0.55,
                          transition: "opacity 150ms ease",
                        }}
                      >
                        <path d="M4 12h14M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{suggestion}</span>
                    </motion.button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Faixas da introdução: descobrem os atalhos e o próximo passo em cascata. */}
          {[
            { top: LAYOUT.cards - 10, height: LAYOUT.cardsHeight + 20, delay: INTRO.bandDelays[0] },
            { top: LAYOUT.cards + LAYOUT.cardsHeight + 10, height: LAYOUT.canvas - LAYOUT.cards - LAYOUT.cardsHeight - 10, delay: INTRO.bandDelays[1] },
          ].map((band) => (
            <motion.div
              key={band.top}
              aria-hidden="true"
              initial={playIntro ? { opacity: 1 } : false}
              animate={{ opacity: 0 }}
              transition={playIntro
                ? { delay: band.delay, duration: INTRO.bandDuration, ease: INTRO.revealEase }
                : { duration: 0 }}
              style={{
                position: "absolute",
                zIndex: 20,
                left: 0,
                right: 0,
                top: y(band.top),
                height: y(band.height),
                background: PAGE_BG,
                pointerEvents: "none",
              }}
            />
          ))}
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
