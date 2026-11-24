import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, PlayCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAtlasChat } from "@/contexts/AtlasChatContext";
import { useAuth } from "@/contexts/AuthContext";
import AtlasHistoryMenu from "@/components/dashboard/AtlasHistoryMenu";
import { getPremiumActionButtonStyle } from "@/components/PremiumActionButton";
import AtlasAvatarIcon from "@/components/dashboard/AtlasAvatarIcon";
import { ENTRADA_POS_ONBOARDING, hasPlayedDashboardIntro, markDashboardIntroAsPlayed } from "@/lib/dashboardIntro";
import { ONBOARDING_COMPLETED_EVENT, shouldShowOnboarding } from "@/components/onboarding/OnboardingModal";
import { veloToast } from "@/components/ui/velo-toast";
import { supabase } from "@/integrations/supabase/client";
import { startMercadoLivreOAuth } from "@/lib/mercadoLivreOAuth";
import dashboardHomeBase from "@/assets/dashboard-home-base.png";
import agenteLua from "@/assets/agentes/lua.png";
import agenteCubo from "@/assets/agentes/cubo.png";
import agenteFolha from "@/assets/agentes/folha.png";
import agenteEstrela from "@/assets/agentes/estrela.png";
import agenteConcha from "@/assets/agentes/concha.png";
import agenteSino from "@/assets/agentes/sino.png";
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
const CONTENT_SLICE_TOP = 300;
const CONTENT_OFFSET = 100;
const HERO_OFFSET = 17;
// Quanto os cards (e a faixa "Próximo passo") descem em relação ao desenho original.
const CARDS_SHIFT = 28;
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
// para de inflar e apenas ganha margem lateral (do mesmo #F5F4F1 do fundo).
// Abaixo desse valor o comportamento responsivo continua exatamente o mesmo.
// Este é o único número a mexer para calibrar a escala geral da página.
const MAX_CANVAS_WIDTH = 1280;

const x = (value: number) => `${(value / IMAGE_WIDTH) * 100}%`;
const y = (value: number) => `${(value / IMAGE_WIDTH) * 100}cqw`;
const fs = (value: number) => `${(value / IMAGE_WIDTH) * 100}cqw`;

// Os seis agentes do card "Coloque os agentes para trabalhar": fileira de trás
// menor, fileira da frente maior, cada um balançando num ritmo diferente.
const AGENTES_HOME = [
  { nome: "lua", src: agenteLua, x: 34, y: 34, tamanho: 96, balanco: 4, frente: false },
  { nome: "estrela", src: agenteEstrela, x: 150, y: 16, tamanho: 96, balanco: 5, frente: false },
  { nome: "sino", src: agenteSino, x: 268, y: 34, tamanho: 96, balanco: 4, frente: false },
  { nome: "cubo", src: agenteCubo, x: 22, y: 140, tamanho: 118, balanco: 3, frente: true },
  { nome: "concha", src: agenteConcha, x: 140, y: 128, tamanho: 118, balanco: 4, frente: true },
  { nome: "folha", src: agenteFolha, x: 258, y: 140, tamanho: 118, balanco: 3, frente: true },
];

const HOME_CARDS_CSS = `
.velo-home-area .velo-home-area-agente { transition: transform 280ms cubic-bezier(0.22, 1, 0.36, 1); }
.velo-home-area:hover .velo-home-area-agente { transform: translateY(-6px) rotate(-3deg); }
.velo-home-area .velo-home-area-botao { transition: transform 200ms ease-out, background-color 200ms ease-out, border-color 200ms ease-out; }
.velo-home-area .velo-home-area-botao:hover:not(:disabled) { transform: translateY(-1px); background-color: #F7F7F5; border-color: #C9C9C5; }
@media (prefers-reduced-motion: reduce) {
  .velo-home-area .velo-home-area-agente, .velo-home-area .velo-home-area-botao { transition: none; }
  .velo-home-area:hover .velo-home-area-agente { transform: none; }
}
`;

type CardAreaProps = {
  id: string;
  left: number;
  width: number;
  rotulo: string;
  /** Só no card do Mercado Livre: bolinha verde (conectado) ou cinza. */
  rotuloAtivo?: boolean;
  titulo: string;
  texto: string;
  acao: string;
  onClick: () => void;
  desabilitado?: boolean;
  agente: string;
  fundo: string;
};

// Card da segunda linha da Início: texto e botão à esquerda, um agente à direita.
const CardArea = ({ id, left, width, rotulo, rotuloAtivo, titulo, texto, acao, onClick, desabilitado, agente, fundo }: CardAreaProps) => (
  <section
    aria-labelledby={id}
    className="velo-home-area"
    style={{
      position: "absolute",
      left: x(left),
      top: y(649),
      width: x(width),
      height: y(246),
      zIndex: 2,
      boxSizing: "border-box",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) 40%",
      gap: fs(14),
      overflow: "hidden",
      padding: `${fs(14)} ${fs(14)} ${fs(14)} ${fs(22)}`,
      border: "1px solid rgba(17,17,20,0.08)",
      borderRadius: fs(24),
      background: "#FFFFFF",
      boxShadow: "0 12px 28px rgba(26,26,26,0.045)",
    }}
  >
    <div style={{ minWidth: 0, display: "flex", flexDirection: "column", alignItems: "flex-start", padding: `${fs(8)} 0` }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: fs(6), color: "rgba(17,17,20,0.5)", fontSize: fs(10.5), fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {rotuloAtivo !== undefined && (
          <span aria-hidden="true" style={{ width: fs(7), height: fs(7), borderRadius: "50%", background: rotuloAtivo ? "#20B875" : "#C9C6B2", boxShadow: rotuloAtivo ? "0 0 0 3px rgba(32,184,117,0.14)" : "none" }} />
        )}
        {rotulo}
      </span>
      <h3 id={id} style={{ margin: `${fs(12)} 0 0`, color: "#111114", fontSize: fs(19.5), fontWeight: 820, lineHeight: 1.12, letterSpacing: "-0.03em" }}>
        {titulo}
      </h3>
      <p style={{ margin: `${fs(9)} 0 0`, color: "rgba(17,17,20,0.62)", fontSize: fs(12.4), fontWeight: 500, lineHeight: 1.42 }}>
        {texto}
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={desabilitado}
        className="velo-home-area-botao focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2 disabled:opacity-70"
        style={{
          marginTop: "auto",
          height: fs(40),
          display: "flex",
          alignItems: "center",
          gap: fs(10),
          padding: `0 ${fs(13)} 0 ${fs(15)}`,
          border: "1px solid #DDDDD9",
          borderRadius: fs(11),
          background: "rgba(255,255,255,0.96)",
          color: "#171719",
          cursor: desabilitado ? "wait" : "pointer",
          fontSize: fs(12.3),
          fontWeight: 780,
          whiteSpace: "nowrap",
          boxShadow: "0 2px 5px rgba(17,17,20,0.035)",
        }}
      >
        <span>{acao}</span>
        <ArrowRight aria-hidden="true" style={{ width: fs(17), height: fs(17) }} strokeWidth={2.1} />
      </button>
    </div>
    <div aria-hidden="true" style={{ position: "relative", borderRadius: fs(18), background: fundo, overflow: "hidden", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <img
        src={agente}
        alt=""
        draggable={false}
        className="velo-home-area-agente"
        style={{ width: fs(132), height: fs(132), marginBottom: fs(6), objectFit: "contain", filter: "drop-shadow(0 10px 12px rgba(0,0,0,0.12))", userSelect: "none" }}
      />
    </div>
  </section>
);

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


  if (introState === "pending" || introState === "waiting") {
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
        <div aria-hidden="true" style={{ height: y(CONTENT_OFFSET + CARDS_SHIFT) }} />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: `${y(CONTENT_SLICE_TOP)} 0 0`,
            background: "#F5F4F1",
          }}
        />
        {/* A segunda cópia recortada da imagem base (com os cards desenhados) saiu:
            os cards agora são componentes. A primeira imagem só dá a altura do canvas. */}

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

          {/* Caixa do Atlas no formato do Shopify: texto em cima; avatar à esquerda e
              Conversas / + / enviar à direita, embaixo. A lógica do chat não mudou. */}
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
              top: y(226 + HERO_OFFSET),
              // Mesma proporção da caixa do Shopify (~6:1): mais alta, com respiro
              // entre o texto e a barra de baixo.
              width: x(860),
              height: y(144),
              x: "-50%",
              borderRadius: fs(20),
              border: chatActive ? "1px solid #CACACA" : "1px solid #E3E3E3",
              background: "#FFFFFF",
              boxShadow: chatActive
                ? "0 1px 0 rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.06)"
                : "0 1px 0 rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              padding: `${fs(20)} ${fs(14)} ${fs(16)} ${fs(18)}`,
              cursor: "text",
              transition: "border-color 200ms ease, box-shadow 240ms ease",
            }}
          >
            <style>{`
              .velo-home-atlas .velo-home-atlas-conversas span.font-bold { font-weight: 500 !important; }
              .velo-home-atlas .velo-home-atlas-btn { transition: background-color 150ms ease-out, color 150ms ease-out; }
              .velo-home-atlas .velo-home-atlas-btn:hover:not(:disabled) { background-color: rgba(0,0,0,0.05); }
              .velo-home-atlas .velo-home-atlas-enviar:hover:not(:disabled) { background-color: #2A2A2A; }
            `}</style>
            <form onSubmit={handleChatSubmit} style={{ display: "block", minWidth: 0 }}>
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  minWidth: 0,
                  height: fs(24),
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
                    color: "#303030",
                    caretColor: "#303030",
                    fontSize: fs(18),
                    fontWeight: 400,
                    lineHeight: 1,
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              </span>
            </form>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span
                aria-hidden="true"
                style={{ width: fs(26), height: fs(26), display: "inline-flex", flex: "0 0 auto" }}
              >
                <AssistantAvatar />
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: fs(6) }} onClick={(event) => event.stopPropagation()}>
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
                          height: fs(36),
                          minHeight: 30,
                          borderRadius: fs(10),
                          color: "#303030",
                          fontSize: fs(16),
                        }}
                      />
                    </div>
                    <span aria-hidden="true" style={{ width: 1, height: fs(18), background: "#E3E3E3", margin: `0 ${fs(6)}` }} />
                  </>
                )}
                <button
                  type="button"
                  aria-label="Escolher produto"
                  className="velo-home-atlas-btn"
                  onClick={() => navigate("/dashboard/catalogo")}
                  style={{
                    border: 0,
                    borderRadius: fs(10),
                    background: "transparent",
                    color: "#303030",
                    cursor: "pointer",
                    width: fs(36),
                    height: fs(36),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: fs(20), height: fs(20), display: "block" }}>
                    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-label="Enviar"
                  className={chatInput.trim() ? "velo-home-atlas-enviar" : "velo-home-atlas-btn"}
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
                    color: chatInput.trim() ? "#FFFFFF" : "#303030",
                    cursor: chatActive && !chatInput.trim() ? "default" : "pointer",
                    background: chatInput.trim() ? "#000000" : "transparent",
                    boxShadow: "none",
                    width: fs(36),
                    height: fs(36),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    transition: "color 160ms ease, background-color 160ms ease",
                  }}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" style={{ width: fs(20), height: fs(20), display: "block" }}>
                    <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
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
              top: y(CONTENT_OFFSET + CARDS_SHIFT),
              bottom: 0,
              pointerEvents: chatActive ? "none" : "auto",
            }}
          >
          <style>{HOME_CARDS_CSS}</style>
          {/* Linha 1 — os dois primeiros passos do novo caminho: criar o site e
              colocar os agentes para cuidar dele. */}
          <section
            aria-labelledby="home-card-site"
            className="velo-home-card"
            style={{
              position: "absolute",
              left: x(78),
              top: y(314),
              width: x(688),
              height: y(322),
              zIndex: 2,
              // Recorte do card da vitrine que já vinha desenhado na imagem base
              // (o mesmo da antiga "Escolha o visual da sua loja"), agora como 01.
              backgroundImage: `url(${dashboardHomeBase})`,
              backgroundRepeat: "no-repeat",
              backgroundSize: `${fs(1536)} auto`,
              backgroundPosition: `-${fs(772)} -${fs(314)}`,
            }}
          >
            <span style={{ position: "absolute", left: fs(35), top: fs(37), color: "rgba(0,0,0,0.45)", fontSize: fs(11), fontWeight: 800 }}>01</span>
            <h2 id="home-card-site" style={{ position: "absolute", left: fs(28), top: fs(70), width: fs(250), margin: 0, fontSize: fs(22), fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em" }}>
              Crie o site
              <br />
              da sua loja
            </h2>
            <p style={{ position: "absolute", left: fs(28), top: fs(146), width: fs(238), margin: 0, color: "rgba(0,0,0,0.62)", fontSize: fs(12.4), lineHeight: 1.42 }}>
              Escolha um modelo, coloque seus produtos e publique. Tudo dentro da Velo.
            </p>
            <button
              type="button"
              onClick={go("/dashboard/minha-loja")}
              className="group transition-[transform,filter,box-shadow] duration-200 ease-out hover:-translate-y-px hover:brightness-110 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/45 focus-visible:ring-offset-2"
              style={{
                ...buttonStyle(0, 0, 0, 47, 13.4),
                left: fs(28),
                top: fs(222),
                width: fs(170),
                height: fs(47),
                ...getPremiumActionButtonStyle(),
                borderRadius: fs(11),
                fontWeight: 800,
                justifyContent: "space-between",
                paddingLeft: fs(18),
                paddingRight: fs(16),
                textAlign: "left",
              }}
            >
              <span>Criar meu site</span>
              <ArrowRight aria-hidden="true" style={{ width: fs(20), height: fs(20), flex: "0 0 auto" }} strokeWidth={1.8} />
            </button>
            {/* A vitrine desenhada também leva para o editor do site. */}
            <button
              type="button"
              onClick={go("/dashboard/minha-loja")}
              aria-label="Abrir o editor do site"
              title="Abrir o editor do site"
              className="velo-home-vitrine rounded-[4%] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/60"
              style={{ ...buttonStyle(0, 0, 0, 0, 0), left: fs(258), top: fs(40), width: fs(410), height: fs(250), background: "transparent" }}
            />
          </section>

          <section
            aria-labelledby="home-card-agentes"
            className="velo-home-card"
            style={{
              position: "absolute",
              left: x(778),
              top: y(320),
              width: x(676),
              height: y(310),
              zIndex: 2,
              boxSizing: "border-box",
              padding: fs(10),
              border: "1px solid rgba(17,17,20,0.07)",
              borderRadius: fs(24),
              background: "#FFFFFF",
              boxShadow: "0 12px 28px rgba(26,26,26,0.045)",
            }}
          >
            <div
              style={{
                position: "relative",
                height: "100%",
                overflow: "hidden",
                borderRadius: fs(18),
                background: "linear-gradient(100deg, #FFFFFF 0%, #FBFAF8 42%, #F4F0EA 100%)",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: fs(15),
                  top: fs(8),
                  width: fs(40),
                  height: fs(40),
                  display: "grid",
                  placeItems: "center",
                  borderRadius: fs(10),
                  background: "#F3F2F0",
                  color: "rgba(0,0,0,0.45)",
                  fontSize: fs(11),
                  fontWeight: 800,
                }}
              >
                02
              </span>
              <h2 id="home-card-agentes" style={{ position: "absolute", left: fs(18), top: fs(60), width: fs(250), margin: 0, fontSize: fs(22), fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.02em" }}>
                Coloque os agentes
                <br />
                para trabalhar
              </h2>
              <p style={{ position: "absolute", left: fs(18), top: fs(136), width: fs(236), margin: 0, color: "rgba(0,0,0,0.62)", fontSize: fs(12.4), lineHeight: 1.42 }}>
                Você cria a loja, os agentes cuidam dela. No seu projeto você vê tudo o que mudou no site.
              </p>
              <button
                type="button"
                onClick={go("/dashboard/projetos")}
                className="transition-[transform,background-color,border-color] duration-200 ease-out hover:-translate-y-px hover:border-[#C9C9C5] hover:bg-[#F7F7F5] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/15 focus-visible:ring-offset-2"
                style={{
                  position: "absolute",
                  left: fs(18),
                  top: fs(212),
                  height: fs(46),
                  display: "flex",
                  alignItems: "center",
                  gap: fs(12),
                  padding: `0 ${fs(14)} 0 ${fs(16)}`,
                  border: "1px solid #DDDDD9",
                  borderRadius: fs(11),
                  background: "rgba(255,255,255,0.96)",
                  color: "#101114",
                  cursor: "pointer",
                  fontSize: fs(13.4),
                  fontWeight: 800,
                  boxShadow: "0 2px 5px rgba(17,17,20,0.035)",
                }}
              >
                <span>Ver meus projetos</span>
                <ArrowRight aria-hidden="true" style={{ width: fs(18), height: fs(18) }} strokeWidth={2} />
              </button>

              {/* Os agentes da Velo (as mesmas fotos da página de projetos). Só
                  decoração: balançam de leve e pulam quando o mouse passa. */}
              <div aria-hidden="true" style={{ position: "absolute", left: fs(268), top: 0, right: 0, bottom: 0 }}>
                {AGENTES_HOME.map((agente, index) => (
                  <motion.img
                    key={agente.nome}
                    src={agente.src}
                    alt=""
                    draggable={false}
                    className="velo-home-agente"
                    initial={false}
                    animate={reduceMotion ? undefined : { y: [0, -agente.balanco, 0] }}
                    whileHover={reduceMotion ? undefined : { scale: 1.08, rotate: -4 }}
                    transition={reduceMotion ? undefined : { duration: 3.2 + index * 0.35, delay: index * 0.4, repeat: Infinity, ease: "easeInOut" }}
                    style={{
                      position: "absolute",
                      left: fs(agente.x),
                      top: fs(agente.y),
                      width: fs(agente.tamanho),
                      height: fs(agente.tamanho),
                      zIndex: agente.frente ? 2 : 1,
                      filter: "drop-shadow(0 10px 12px rgba(60,40,20,0.13))",
                      userSelect: "none",
                    }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Alvo do tour do Atlas: moldura invisível sobre os dois primeiros passos. */}
          <div
            aria-hidden="true"
            data-dashboard-tour="home-primeiros-passos"
            style={{ position: "absolute", left: x(84), top: y(318), width: x(1372), height: y(312), pointerEvents: "none" }}
          />

          {/* Linha 2 — as áreas do negócio que o site movimenta. */}
          <CardArea
            id="home-card-produtos"
            left={84}
            width={460}
            rotulo="Produtos"
            titulo="Monte a sua vitrine"
            texto="Escolha no catálogo Velo os produtos que vão para o seu site."
            acao="Ver catálogo"
            onClick={go("/dashboard/catalogo")}
            agente={agenteCubo}
            fundo="linear-gradient(160deg, #FFF4EA 0%, #FFE4CC 100%)"
          />
          <CardArea
            id="home-card-pedidos"
            left={560}
            width={432}
            rotulo="Pedidos"
            titulo="Acompanhe as vendas"
            texto="Veja os pedidos da sua loja e o andamento de cada um."
            acao="Ver pedidos"
            onClick={go("/dashboard/pedidos")}
            agente={agenteFolha}
            fundo="linear-gradient(160deg, #F3FAE8 0%, #E2F2CB 100%)"
          />
          <CardArea
            id="home-card-mercado-livre"
            left={1008}
            width={448}
            rotulo={onboardingStatus?.mlConnected ? "Mercado Livre · conectado" : "Mercado Livre"}
            rotuloAtivo={Boolean(onboardingStatus?.mlConnected)}
            titulo="Venda também por lá"
            texto="Conecte sua conta e publique seus produtos no Mercado Livre."
            acao={conectandoMl ? "Conectando…" : onboardingStatus?.mlConnected ? "Gerenciar conta" : "Conectar conta"}
            // /dashboard/integracoes é a tela de lojas Shopify; a conta do
            // Mercado Livre se gerencia na aba Integrações das configurações.
            onClick={onboardingStatus?.mlConnected ? go("/dashboard/configuracoes?tab=Integrações") : () => void conectarMercadoLivre()}
            desabilitado={conectandoMl}
            agente={agenteConcha}
            fundo="linear-gradient(160deg, #F5F1FF 0%, #E7DEFD 100%)"
          />

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
                    top: y(382 + HERO_OFFSET),
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
                    top: y(392 + HERO_OFFSET),
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
            { top: CONTENT_SLICE_TOP + CONTENT_OFFSET + CARDS_SHIFT, height: 350, delay: INTRO.bandDelays[0] },
            { top: 750 + CARDS_SHIFT, height: 270, delay: INTRO.bandDelays[1] },
            { top: 1020 + CARDS_SHIFT, height: 104, delay: INTRO.bandDelays[2] },
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
