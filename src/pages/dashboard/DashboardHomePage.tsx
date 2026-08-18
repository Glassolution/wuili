import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ArrowRight, BadgePercent, Check, Copy, LayoutTemplate, Maximize2, PackageSearch, Sparkles, SquarePen, ThumbsDown, ThumbsUp, X as CloseIcon } from "lucide-react";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
import { useAuth } from "@/contexts/AuthContext";
import { getPremiumActionButtonStyle } from "@/components/PremiumActionButton";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import AtlasHistoryMenu from "@/components/dashboard/AtlasHistoryMenu";
import AtlasMessageText from "@/components/dashboard/AtlasMessageText";
import { atlasThreadsQueryKey } from "@/lib/atlasHistory";
import { hasPlayedDashboardIntro, markDashboardIntroAsPlayed } from "@/lib/dashboardIntro";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import dashboardHomeBase from "@/assets/dashboard-home-base.png";
import mercadoLivreLogo from "@/assets/mercado-livre-logo.png.asset.json";

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

type AtlasFunctionResponse = {
  message?: string;
  error?: string;
  actions?: AtlasAction[];
};

type OnboardingStatus = {
  mlConnected: boolean;
  hasPublication: boolean;
};

const IMAGE_WIDTH = 1536;
const CONTENT_SLICE_TOP = 300;
const CONTENT_OFFSET = 100;
const HERO_OFFSET = 45;
const SUPPORT_WHATSAPP_URL =
  "https://wa.me/5547999286334?text=Oi%2C%20preciso%20de%20ajuda%20com%20a%20minha%20conta%20Velo.";
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
  promoDelay: 1,
  supportDelay: 1.14,
  chatDelay: 1.28,
  // As faixas são o que descobre os cards de baixo: é aqui que mais se percebia
  // a pressa. Fade mais longo e mais espaço entre elas, para revelarem em cascata
  // em vez de quase juntas.
  bandDuration: 1,
  bandDelays: [1.4, 1.68, 1.96],
};

// Todo o layout desta tela é dimensionado em cqw (relativo à largura do
// container), então sem um teto ele cresce junto com o monitor e no desktop
// fica desproporcional. Travamos a largura do canvas: acima disso o conteúdo
// para de inflar e apenas ganha margem lateral (do mesmo #F5F4F1 do fundo).
// Abaixo desse valor o comportamento responsivo continua exatamente o mesmo.
// Este é o único número a mexer para calibrar a escala geral da página.
const MAX_CANVAS_WIDTH = 1280;

const x = (value: number) => `${(value / IMAGE_WIDTH) * 100}%`;
const y = (value: number) => `${(value / IMAGE_WIDTH) * 100}cqw`;
const fs = (value: number) => `${(value / IMAGE_WIDTH) * 100}cqw`;

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
        color: "rgba(0,0,0,0.56)",
        fontSize: fs(18),
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

const getMessageActions = (message: AtlasMessage) => normalizeAtlasActions(message.product_data?.actions);

const formatMargin = (margin?: number | null) => {
  if (typeof margin !== "number" || !Number.isFinite(margin)) return "Margem a verificar";
  return `${Math.round(margin)}% de margem`;
};

const formatPrice = (price?: number | null) => {
  if (typeof price !== "number" || !Number.isFinite(price)) return null;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { enviar: enviarParaAtlas, mensagens: chatMessages } = useAtlasChat();
  const reduceMotion = useReducedMotion();
  const introDecisionMade = useRef<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const welcomeChatRef = useRef<HTMLDivElement>(null);
  const suggestionListRef = useRef<HTMLDivElement>(null);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const [introState, setIntroState] = useState<"pending" | "play" | "done">("pending");
  const [chatActive, setChatActive] = useState(false);
  const [chatInput, setChatInput] = useState("");
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

    const shouldPlay = !reduceMotion && !hasPlayedDashboardIntro(userId);
    if (shouldPlay) markDashboardIntroAsPlayed(userId);

    setIntroState(shouldPlay ? "play" : "done");
  }, [reduceMotion, user?.id]);

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
      if (welcomeChatRef.current?.contains(target) || suggestionListRef.current?.contains(target)) return;

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

  const textStyle = (
    left: number,
    top: number,
    size: number,
    width?: number,
    extra?: CSSProperties,
  ): CSSProperties => ({
    position: "absolute",
    left: x(left),
    top: y(top),
    width: width ? x(width) : undefined,
    fontSize: fs(size),
    ...extra,
  });

  const buttonStyle = (
    left: number,
    top: number,
    width: number,
    height: number,
    size: number,
    extra?: CSSProperties,
  ): CSSProperties => ({
    position: "absolute",
    left: x(left),
    top: y(top),
    width: x(width),
    height: y(height),
    border: 0,
    background: "transparent",
    cursor: "pointer",
    fontSize: fs(size),
    display: "flex",
    alignItems: "center",
    lineHeight: 1,
    padding: 0,
    ...extra,
  });


  if (introState === "pending") {
    return (
      <main
        aria-hidden="true"
        className="shrink-0 bg-[#F5F4F1] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
      />
    );
  }

  // A conversa não vive mais aqui: ela é renderizada pelo AtlasDockPanel, que
  // fica no layout e por isso sobrevive à navegação. Esta página cuida só da
  // tela de boas-vindas e de disparar a primeira mensagem.

  return (
    <main
      className="shrink-0 overflow-auto bg-[#F5F4F1] -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
    >
      <div
        className="relative mx-auto w-full text-[#101114]"
        style={{ containerType: "inline-size", maxWidth: MAX_CANVAS_WIDTH }}
      >
        <img
          src={dashboardHomeBase}
          alt="Tela inicial da Velo"
          className="block h-auto w-full select-none"
          draggable={false}
        />
        <div aria-hidden="true" style={{ height: y(CONTENT_OFFSET) }} />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: `${y(CONTENT_SLICE_TOP)} 0 0`,
            background: "#F5F4F1",
          }}
        />
        <img
          aria-hidden="true"
          src={dashboardHomeBase}
          alt=""
          className="pointer-events-none absolute left-0 w-full select-none"
          style={{
            top: y(CONTENT_OFFSET),
            clipPath: `inset(${(CONTENT_SLICE_TOP / 1024) * 100}% 0 0 0)`,
          }}
          draggable={false}
        />

        <div className="absolute inset-0 font-sans">
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              bottom: "auto",
              height: y(320),
              background: "#F5F4F1",
            }}
          />

          <motion.div
            {...revealProps(INTRO.promoDelay, -10)}
            style={{
              position: "absolute",
              left: x(28),
              top: y(24),
              width: x(296),
              height: y(52),
              borderRadius: 999,
              border: "1px solid rgba(17, 24, 39, 0.10)",
              background: "rgba(255, 255, 255, 0.97)",
              boxShadow: "0 3px 8px rgba(15, 23, 42, 0.07)",
              display: "flex",
              alignItems: "center",
              padding: `0 ${fs(8)} 0 ${fs(17)}`,
              gap: fs(10),
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: fs(22), height: fs(22), flex: "0 0 auto" }}>
              <path d="M12 2.8c.6 4.8 2.8 7 7.6 7.6-4.8.6-7 2.8-7.6 7.6-.6-4.8-2.8-7-7.6-7.6 4.8-.6 7-2.8 7.6-7.6Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
              <path d="M19 3.2c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" fill="currentColor" />
            </svg>
            <span
              style={{
                color: "rgba(0,0,0,0.72)",
                fontSize: fs(13),
                fontWeight: 700,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              Ganhe 3 meses grátis
            </span>
            <button
              type="button"
              onClick={go("/dashboard/planos")}
              style={{
                width: fs(96),
                height: fs(40),
                marginLeft: "auto",
                borderRadius: 999,
                border: "1px solid rgba(17, 24, 39, 0.08)",
                background: "#FFFFFF",
                boxShadow: "0 2px 5px rgba(15, 23, 42, 0.06)",
                color: "#101114",
                cursor: "pointer",
                fontSize: fs(13),
                fontWeight: 800,
                lineHeight: 1,
                flex: "0 0 auto",
              }}
            >
              Ver planos
            </button>
          </motion.div>

          <motion.a
            {...revealProps(INTRO.supportDelay, -10)}
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Abrir WhatsApp do suporte Velo"
            style={{
              position: "absolute",
              right: x(30),
              top: y(20),
              width: x(195),
              height: y(56),
              borderRadius: fs(18),
              border: "1px solid rgba(17, 24, 39, 0.09)",
              background: "rgba(255, 255, 255, 0.97)",
              boxShadow: "0 3px 8px rgba(15, 23, 42, 0.07)",
              display: "flex",
              alignItems: "center",
              gap: fs(12),
              padding: `0 ${fs(15)}`,
              textAlign: "left",
              color: "#101114",
              textDecoration: "none",
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: fs(27), height: fs(27), flex: "0 0 auto" }}>
              <path d="M4.1 13.3v-1.7a7.9 7.9 0 0 1 15.8 0v1.7M5.5 12.7H4.2c-1 0-1.7.8-1.7 1.7v2.8c0 1 .8 1.7 1.7 1.7h1.3v-6.2Zm13 0h1.3c1 0 1.7.8 1.7 1.7v2.8c0 1-.8 1.7-1.7 1.7h-1.3v-6.2ZM18.5 18.1c-.7 2.1-2.4 3.1-5 3.1" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ display: "flex", flexDirection: "column", gap: fs(4), minWidth: 0 }}>
              <span style={{ fontSize: fs(11), fontWeight: 600, color: "rgba(0,0,0,0.47)", lineHeight: 1, whiteSpace: "nowrap" }}>
                Precisa de ajuda?
              </span>
              <span style={{ fontSize: fs(11.8), fontWeight: 800, lineHeight: 1, whiteSpace: "nowrap" }}>
                +55 47 99928-6334
              </span>
            </span>
          </motion.a>

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
              top: y(128 + HERO_OFFSET),
              width: x(900),
              x: "-50%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: fs(6),
              margin: 0,
              lineHeight: 1.04,
              letterSpacing: 0,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: "#666666", fontSize: fs(31), fontWeight: 600 }}>
              Bem-vindo à Velo!
            </span>
            <span style={{ color: "#303030", fontSize: fs(34), fontWeight: 600 }}>
              Por onde você quer começar?
            </span>
          </motion.h1>

          <motion.div
            {...revealProps(INTRO.chatDelay, 14)}
            ref={welcomeChatRef}
            role="search"
            aria-label="Assistente Atlas"
            aria-expanded={chatActive}
            onClick={() => setChatActive(true)}
            style={{
              position: "absolute",
              zIndex: 32,
              left: "50%",
              top: y(238 + HERO_OFFSET),
              width: x(948),
              height: y(60),
              x: "-50%",
              borderRadius: 999,
              border: chatActive
                ? "1px solid rgba(106, 124, 190, 0.18)"
                : "1px solid rgba(17, 24, 39, 0.09)",
              background: "#FFFFFF",
              boxShadow: chatActive
                ? "-14px 0 34px rgba(97, 169, 255, 0.07), 14px 0 34px rgba(255, 174, 116, 0.06), 0 8px 22px rgba(45, 55, 85, 0.08), 0 1px 4px rgba(15, 23, 42, 0.05)"
                : "0 1px 3px rgba(15, 23, 42, 0.06), 0 8px 18px rgba(15, 23, 42, 0.035)",
              display: "flex",
              alignItems: "center",
              padding: `0 ${x(14)} 0 ${x(22)}`,
              transition: "border-color 520ms ease, box-shadow 620ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <form
              onSubmit={handleChatSubmit}
              style={{
                display: "flex",
                alignItems: "center",
                flex: 1,
                minWidth: 0,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: fs(40),
                  height: fs(40),
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                  marginRight: fs(15),
                }}
              >
                <AssistantAvatar />
              </span>
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  flex: 1,
                  minWidth: 0,
                  height: "100%",
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
                  placeholder={chatActive ? "Pergunte qualquer coisa..." : ""}
                  style={{
                    width: "100%",
                    minWidth: 0,
                    border: 0,
                    outline: 0,
                    background: "transparent",
                    color: "rgba(0,0,0,0.72)",
                    caretColor: "#2563EB",
                    fontSize: fs(18),
                    fontWeight: 400,
                    lineHeight: 1,
                    position: "relative",
                    zIndex: 1,
                  }}
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
              style={{
                border: 0,
                background: "transparent",
                color: "rgba(0,0,0,0.70)",
                cursor: "pointer",
                width: fs(38),
                height: fs(38),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: fs(5),
                padding: 0,
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: fs(20), height: fs(20), display: "block" }}>
                <path d="M12 4.5v15M4.5 12h15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
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
              style={{
                border: 0,
                borderRadius: "50%",
                color: chatActive && chatInput.trim() ? "#FFFFFF" : "rgba(0,0,0,0.16)",
                cursor: chatActive && !chatInput.trim() ? "default" : "pointer",
                background: chatActive && chatInput.trim() ? "#2563EB" : "#F0F0F0",
                width: fs(40),
                height: fs(40),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "color 180ms ease, background-color 180ms ease, transform 180ms ease",
              }}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: fs(20), height: fs(20), display: "block" }}>
                <path d="M12 19V5M6.7 10.3 12 5l5.3 5.3" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </motion.div>

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
              top: y(CONTENT_OFFSET),
              bottom: 0,
              pointerEvents: chatActive ? "none" : "auto",
            }}
          >
          <span style={textStyle(117, 350, 11, undefined, { color: "rgba(0,0,0,0.45)", fontWeight: 800 })}>01</span>
          <h2 style={textStyle(111, 384, 22, 260, { fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em" })}>
            Adicione seu primeiro
            <br />
            produto
          </h2>
          <p style={textStyle(111, 460, 12.4, 276, { color: "rgba(0,0,0,0.62)", lineHeight: 1.42 })}>
            Comece com nome, preço e fotos. Você pode adicionar mais detalhes depois.
          </p>
          <button
            type="button"
            onClick={go("/dashboard/catalogo")}
            className="group transition-[transform,filter,box-shadow] duration-200 ease-out hover:-translate-y-px hover:brightness-110 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/45 focus-visible:ring-offset-2"
            style={buttonStyle(116, 541, 170, 47, 13.4, {
              ...getPremiumActionButtonStyle(),
              borderRadius: fs(11),
              fontWeight: 800,
              justifyContent: "space-between",
              paddingLeft: fs(18),
              paddingRight: fs(16),
              textAlign: "left",
            })}
          >
            <span>Adicionar produto</span>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              style={{ width: fs(22), height: fs(22), flex: "0 0 auto" }}
            >
              <path
                d="M5 12h13M13 7l5 5-5 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <span style={textStyle(813, 350, 11, undefined, { color: "rgba(0,0,0,0.45)", fontWeight: 800 })}>02</span>
          <h2 style={textStyle(806, 384, 22, 245, { fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em" })}>
            Escolha o visual
            <br />
            da sua loja
          </h2>
          <p style={textStyle(806, 460, 12.4, 270, { color: "rgba(0,0,0,0.62)", lineHeight: 1.42 })}>
            Selecione um template profissional e personalize para refletir a sua marca.
          </p>
          <button
            type="button"
            onClick={go("/dashboard/modelos")}
            style={buttonStyle(806, 541, 132, 47, 13.4, {
              color: "#101114",
              fontWeight: 800,
              paddingLeft: x(14),
              textAlign: "left",
            })}
          >
            Ver temas
          </button>

          <section
            aria-labelledby="affiliate-card-title"
            style={{
              position: "absolute",
              left: x(84),
              top: y(649),
              width: x(460),
              height: y(246),
              zIndex: 2,
              boxSizing: "border-box",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 39%",
              gap: fs(18),
              overflow: "hidden",
              padding: fs(20),
              border: "1px solid rgba(35, 31, 45, 0.09)",
              borderRadius: fs(24),
              background: "linear-gradient(145deg, #FFFFFF 0%, #FDFCFF 55%, #F7F4FF 100%)",
              boxShadow: "0 12px 28px rgba(31, 24, 48, 0.055), inset 0 1px 0 rgba(255,255,255,0.92)",
            }}
          >
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span
                aria-hidden="true"
                style={{
                  width: fs(43),
                  height: fs(43),
                  flex: "0 0 auto",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: fs(13),
                  color: "#FFFFFF",
                  background: "linear-gradient(145deg, #6D5AEF 0%, #4736C7 100%)",
                  boxShadow: "0 8px 18px rgba(79, 61, 201, 0.24), inset 0 1px 0 rgba(255,255,255,0.28)",
                }}
              >
                <BadgePercent size={fs(22)} strokeWidth={1.9} />
              </span>

              <h3
                id="affiliate-card-title"
                style={{
                  margin: `${fs(17)} 0 0`,
                  color: "#111114",
                  fontSize: fs(20.5),
                  fontWeight: 820,
                  lineHeight: 1.12,
                  letterSpacing: "-0.03em",
                }}
              >
                Programa de afiliados
              </h3>
              <p
                style={{
                  margin: `${fs(9)} 0 0`,
                  maxWidth: fs(230),
                  color: "rgba(17,17,20,0.62)",
                  fontSize: fs(12.7),
                  fontWeight: 500,
                  lineHeight: 1.42,
                }}
              >
                Indique a Velo e ganhe 30% na primeira venda de cada novo cliente.
              </p>

              <button
                type="button"
                onClick={go("/dashboard/comissoes")}
                className="group transition-[transform,background-color,border-color] duration-200 ease-out hover:-translate-y-px hover:border-[#C9C9C5] hover:bg-[#F7F7F5] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2"
                style={{
                  width: fs(177),
                  height: fs(40),
                  marginTop: "auto",
                  flex: "0 0 auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `0 ${fs(13)} 0 ${fs(15)}`,
                  border: "1px solid #DDDDD9",
                  borderRadius: fs(11),
                  background: "rgba(255,255,255,0.96)",
                  color: "#171719",
                  cursor: "pointer",
                  fontSize: fs(12.3),
                  fontWeight: 780,
                  letterSpacing: "-0.015em",
                  boxShadow: "0 2px 5px rgba(17,17,20,0.035)",
                }}
              >
                <span>Quero ser afiliado</span>
                <ArrowRight size={fs(17)} strokeWidth={2.1} aria-hidden="true" />
              </button>
            </div>

            <div
              style={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                padding: `${fs(17)} ${fs(15)}`,
                border: "1px solid rgba(91, 71, 205, 0.11)",
                borderRadius: fs(18),
                background: "linear-gradient(155deg, rgba(239,235,255,0.92) 0%, rgba(250,249,255,0.96) 100%)",
              }}
            >
              <span style={{ color: "#4B3AC1", fontSize: fs(10), fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Primeira venda
              </span>
              <div style={{ marginTop: fs(5), display: "flex", alignItems: "baseline", gap: fs(4) }}>
                <strong style={{ color: "#17131F", fontSize: fs(32), fontWeight: 850, lineHeight: 1, letterSpacing: "-0.055em" }}>30%</strong>
                <span style={{ color: "rgba(23,19,31,0.5)", fontSize: fs(9.8), fontWeight: 650 }}>de comissão</span>
              </div>
              <div style={{ height: 1, margin: `${fs(14)} 0 ${fs(12)}`, background: "rgba(75,58,193,0.12)" }} />
              {["Por novo cliente", "Ganhos acompanhados"].map((benefit) => (
                <span
                  key={benefit}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: fs(7),
                    marginBottom: fs(10),
                    color: "rgba(23,19,31,0.72)",
                    fontSize: fs(10.4),
                    fontWeight: 670,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: fs(17),
                      height: fs(17),
                      flex: "0 0 auto",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: "50%",
                      background: "rgba(91,71,205,0.11)",
                      color: "#5B47CD",
                    }}
                  >
                    <Check size={fs(10.5)} strokeWidth={2.5} />
                  </span>
                  {benefit}
                </span>
              ))}
            </div>
          </section>

          <section
            aria-labelledby="ai-page-card-title"
            style={{
              position: "absolute",
              left: x(560),
              top: y(649),
              width: x(432),
              height: y(246),
              zIndex: 2,
              boxSizing: "border-box",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 42%",
              gap: fs(16),
              overflow: "hidden",
              padding: fs(20),
              border: "1px solid rgba(23, 60, 45, 0.09)",
              borderRadius: fs(24),
              background: "linear-gradient(145deg, #FFFFFF 0%, #FBFEFC 58%, #F0FAF4 100%)",
              boxShadow: "0 12px 28px rgba(20, 55, 41, 0.05), inset 0 1px 0 rgba(255,255,255,0.92)",
            }}
          >
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span
                aria-hidden="true"
                style={{
                  width: fs(43),
                  height: fs(43),
                  display: "grid",
                  placeItems: "center",
                  borderRadius: fs(13),
                  color: "#116149",
                  background: "linear-gradient(145deg, #E4F8ED 0%, #D5F2E2 100%)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.8)",
                }}
              >
                <LayoutTemplate size={fs(21)} strokeWidth={1.85} />
              </span>
              <h3
                id="ai-page-card-title"
                style={{
                  margin: `${fs(17)} 0 0`,
                  color: "#101613",
                  fontSize: fs(19.2),
                  fontWeight: 820,
                  lineHeight: 1.12,
                  letterSpacing: "-0.03em",
                }}
              >
                Página de vendas com IA
              </h3>
              <p style={{ margin: `${fs(9)} 0 0`, maxWidth: fs(205), color: "rgba(16,22,19,0.62)", fontSize: fs(12.2), fontWeight: 500, lineHeight: 1.4 }}>
                Crie uma página profissional para apresentar e vender seu produto.
              </p>
              <button
                type="button"
                onClick={go("/dashboard/paginas-com-ia/criar")}
                className="group transition-[transform,background-color,border-color] duration-200 ease-out hover:-translate-y-px hover:border-[#C9C9C5] hover:bg-[#F7F7F5] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2"
                style={{
                  width: fs(143),
                  height: fs(40),
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: `0 ${fs(13)} 0 ${fs(15)}`,
                  border: "1px solid #DDDDD9",
                  borderRadius: fs(11),
                  background: "rgba(255,255,255,0.96)",
                  color: "#171719",
                  cursor: "pointer",
                  fontSize: fs(12.3),
                  fontWeight: 780,
                  boxShadow: "0 2px 5px rgba(17,17,20,0.035)",
                }}
              >
                <span>Criar página</span>
                <ArrowRight size={fs(17)} strokeWidth={2.1} aria-hidden="true" />
              </button>
            </div>
            <div
              aria-hidden="true"
              style={{
                minWidth: 0,
                alignSelf: "center",
                padding: fs(13),
                border: "1px solid rgba(27, 119, 85, 0.11)",
                borderRadius: fs(17),
                background: "rgba(255,255,255,0.86)",
                boxShadow: "0 12px 24px rgba(20, 72, 51, 0.08)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: fs(8) }}>
                <span style={{ display: "flex", alignItems: "center", gap: fs(6), color: "#143B2E", fontSize: fs(9.7), fontWeight: 800 }}>
                  <Sparkles size={fs(12)} /> Velo IA
                </span>
                <span style={{ width: fs(7), height: fs(7), borderRadius: "50%", background: "#2CC68B", boxShadow: "0 0 0 3px rgba(44,198,139,0.12)" }} />
              </div>
              <div style={{ height: fs(7), marginTop: fs(15), borderRadius: 999, background: "#DDE7E1" }} />
              <div style={{ width: "72%", height: fs(7), marginTop: fs(7), borderRadius: 999, background: "#EDF2EF" }} />
              <div style={{ marginTop: fs(17), display: "flex", alignItems: "center", gap: fs(6), color: "#166747", fontSize: fs(9.7), fontWeight: 780 }}>
                <span style={{ display: "grid", placeItems: "center", width: fs(17), height: fs(17), borderRadius: "50%", background: "#DCF7E9" }}>
                  <Check size={fs(10)} strokeWidth={2.5} />
                </span>
                Pronta para publicar
              </div>
            </div>
          </section>

          <section
            aria-labelledby="ml-card-title"
            style={{
              position: "absolute",
              left: x(1008),
              top: y(649),
              width: x(448),
              height: y(246),
              zIndex: 2,
              boxSizing: "border-box",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 39%",
              gap: fs(16),
              overflow: "hidden",
              padding: fs(20),
              border: "1px solid rgba(44, 43, 29, 0.09)",
              borderRadius: fs(24),
              background: "linear-gradient(145deg, #FFFFFF 0%, #FFFEFA 58%, #FFFBE3 100%)",
              boxShadow: "0 12px 28px rgba(62, 54, 15, 0.05), inset 0 1px 0 rgba(255,255,255,0.92)",
            }}
          >
            <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
              <span
                aria-hidden="true"
                style={{
                  width: fs(43),
                  height: fs(43),
                  display: "grid",
                  placeItems: "center",
                  borderRadius: fs(13),
                  background: "transparent",
                }}
              >
                <img src={mercadoLivreLogo.url} alt="" style={{ width: fs(43), height: fs(35), objectFit: "contain" }} />
              </span>
              <h3
                id="ml-card-title"
                style={{
                  margin: `${fs(17)} 0 0`,
                  color: "#17170F",
                  fontSize: fs(19.4),
                  fontWeight: 820,
                  lineHeight: 1.12,
                  letterSpacing: "-0.03em",
                }}
              >
                Venda no Mercado Livre
              </h3>
              <p style={{ margin: `${fs(9)} 0 0`, maxWidth: fs(220), color: "rgba(23,23,15,0.62)", fontSize: fs(12.2), fontWeight: 500, lineHeight: 1.4 }}>
                Conecte sua conta, publique anúncios e acompanhe os pedidos.
              </p>
              <button
                type="button"
                // /dashboard/integracoes é a tela de lojas Shopify; a conta do
                // Mercado Livre se gerencia na aba Integrações das configurações.
                onClick={onboardingStatus?.mlConnected ? go("/dashboard/configuracoes?tab=Integrações") : conectarMercadoLivre}
                disabled={conectandoMl}
                className="group transition-[transform,background-color,border-color] duration-200 ease-out hover:-translate-y-px hover:border-[#C9C9C5] hover:bg-[#F7F7F5] active:translate-y-0 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2"
                style={{
                  minWidth: fs(145),
                  height: fs(40),
                  marginTop: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: fs(10),
                  padding: `0 ${fs(13)} 0 ${fs(15)}`,
                  border: "1px solid #DDDDD9",
                  borderRadius: fs(11),
                  background: "rgba(255,255,255,0.96)",
                  color: "#171719",
                  cursor: "pointer",
                  fontSize: fs(11.9),
                  fontWeight: 800,
                  boxShadow: "0 2px 5px rgba(17,17,20,0.035)",
                }}
              >
                <span>{conectandoMl ? "Conectando…" : onboardingStatus?.mlConnected ? "Gerenciar conta" : "Conectar conta"}</span>
                <ArrowRight size={fs(17)} strokeWidth={2.1} aria-hidden="true" />
              </button>
            </div>
            <div
              style={{
                minWidth: 0,
                alignSelf: "center",
                padding: fs(14),
                border: "1px solid rgba(107, 97, 20, 0.11)",
                borderRadius: fs(17),
                background: "rgba(255,255,255,0.88)",
                boxShadow: "0 12px 24px rgba(77, 68, 13, 0.07)",
              }}
            >
              <span style={{ color: "rgba(23,23,15,0.5)", fontSize: fs(9.4), fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Integração
              </span>
              <div style={{ marginTop: fs(7), display: "flex", alignItems: "center", gap: fs(7) }}>
                <span aria-hidden="true" style={{ width: fs(9), height: fs(9), borderRadius: "50%", background: onboardingStatus?.mlConnected ? "#20B875" : "#C9C6B2", boxShadow: onboardingStatus?.mlConnected ? "0 0 0 3px rgba(32,184,117,0.12)" : "none" }} />
                <strong style={{ color: "#232316", fontSize: fs(11), fontWeight: 800 }}>
                  {onboardingStatus?.mlConnected ? "Conta conectada" : "Pronta para conectar"}
                </strong>
              </div>
              <div style={{ height: 1, margin: `${fs(13)} 0 ${fs(11)}`, background: "rgba(94,85,21,0.11)" }} />
              {["Publicação simplificada", "Pedidos sincronizados"].map((benefit) => (
                <span key={benefit} style={{ display: "flex", alignItems: "center", gap: fs(6), marginBottom: fs(9), color: "rgba(35,35,22,0.68)", fontSize: fs(9.3), fontWeight: 680, whiteSpace: "nowrap" }}>
                  <Check size={fs(11)} strokeWidth={2.3} color="#8B7F00" />
                  {benefit}
                </span>
              ))}
            </div>
          </section>

          <div
            style={{
              position: "absolute",
              left: x(80),
              top: y(920),
              width: x(1376),
              height: y(72),
              border: "1px solid rgba(17,17,17,0.08)",
              borderRadius: fs(18),
              background: "rgba(255,255,255,0.98)",
              boxShadow: "0 10px 30px rgba(26,26,26,0.045)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: fs(24),
              boxSizing: "border-box",
              padding: `0 ${fs(22)} 0 ${fs(26)}`,
              overflow: "hidden",
            }}
          >
            <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: fs(15), flex: "1 1 auto" }}>
              <span
                aria-hidden="true"
                style={{
                  width: fs(35),
                  height: fs(35),
                  flex: "0 0 auto",
                  borderRadius: fs(11),
                  background: "#F4F1FF",
                  color: "#351078",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <svg viewBox="0 0 24 24" style={{ width: fs(20), height: fs(20) }}>
                  <path d="m12 3 1.2 4.1L17 9l-3.8 1.9L12 15l-1.2-4.1L7 9l3.8-1.9L12 3Zm6.2 10.2.7 2.3 2.1 1-.1.1-2 1-.7 2.2-.7-2.2-2.1-1 2.1-1 .7-2.4Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
              </span>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, color: "#101114", fontSize: fs(15.5), fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
                  Próximo passo
                </h3>
                <p style={{ margin: `${fs(5)} 0 0`, maxWidth: x(760), color: "rgba(0,0,0,0.56)", fontSize: fs(12.2), fontWeight: 500, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {nextStepCopy}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: fs(15), flex: "0 0 auto" }}>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={conectandoMl}
                className="transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-px hover:bg-[#F7F7F5] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/35"
                style={{
                  width: fs(164),
                  height: fs(42),
                  border: "1px solid rgba(17,17,17,0.1)",
                  borderRadius: fs(12),
                  background: "#FFFFFF",
                  boxShadow: "0 4px 12px rgba(17,17,17,0.05)",
                  color: "#101114",
                  cursor: conectandoMl ? "wait" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `0 ${fs(14)}`,
                  fontSize: fs(12.5),
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
              >
                {conectandoMl ? "Abrindo…" : nextStepLabel}
              </button>

              <div
                aria-label={onboardingProgress === null ? "Progresso indisponível" : `${onboardingProgress}% concluído`}
                style={{
                  width: fs(48),
                  height: fs(48),
                  borderRadius: "50%",
                  padding: fs(3),
                  boxSizing: "border-box",
                  background: onboardingProgress === null
                    ? "#ECECE8"
                    : `conic-gradient(#351078 ${onboardingProgress}%, #ECECE8 0)`,
                }}
              >
                <span
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    background: "#FFFFFF",
                    color: "rgba(0,0,0,0.58)",
                    display: "grid",
                    placeItems: "center",
                    fontSize: fs(11.5),
                    fontWeight: 800,
                  }}
                >
                  {onboardingProgress === null ? "—" : `${onboardingProgress}%`}
                </span>
              </div>
            </div>
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
                    top: y(341 + HERO_OFFSET),
                    bottom: 0,
                    background: "#F5F4F1",
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
                    top: y(328 + HERO_OFFSET),
                    width: x(900),
                    x: "-50%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "stretch",
                    paddingLeft: fs(10),
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
                        height: y(60),
                        border: 0,
                        borderRadius: fs(12),
                        background: hoveredSuggestion === suggestion ? "#ECECEB" : "transparent",
                        color: hoveredSuggestion === suggestion ? "#343434" : "rgba(0,0,0,0.57)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: fs(18),
                        padding: `0 ${fs(10)}`,
                        fontSize: fs(18),
                        fontWeight: 500,
                        lineHeight: 1,
                        textAlign: "left",
                        transition: "background-color 180ms ease, color 180ms ease, transform 180ms ease",
                      }}
                      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        style={{
                          width: fs(25),
                          height: fs(25),
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

          {[
            { top: CONTENT_SLICE_TOP + CONTENT_OFFSET, height: 350, delay: INTRO.bandDelays[0] },
            { top: 750, height: 270, delay: INTRO.bandDelays[1] },
            { top: 1020, height: 104, delay: INTRO.bandDelays[2] },
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
                background: "#F5F4F1",
                pointerEvents: "none",
              }}
            />
          ))}
        </div>
      </div>
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
