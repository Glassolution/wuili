import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronDown, PlayCircle, X } from "lucide-react";
import { useProfile } from "@/lib/profileContext";
import { formatarContagem, useFimDoTeste } from "@/lib/prazoDoTeste";
import { useUpgradeModal } from "@/components/PlansUpgradeModal";
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

// Início desktop com as medidas da referência (Base44), em px fixos.
const PAGE_BG = "#FFFFFF";

// Menu "Criar" da caixa do Atlas: só páginas que já existem.
const ACOES_CRIAR = [
  { id: "site", rotulo: "Site da loja", rota: "/dashboard/minha-loja" },
  { id: "produtos", rotulo: "Encontrar produtos", rota: "/dashboard/catalogo" },
  { id: "agentes", rotulo: "Agentes", rota: "/dashboard/projetos" },
] as const;

const HOME_CSS = `
.velo-home-btn { transition: background-color 150ms ease-out, border-color 150ms ease-out; }
.velo-home-btn:hover:not(:disabled) { background-color: #F4F4F5; }
.velo-home-menu-item { transition: background-color 120ms ease-out; }
.velo-home-menu-item:hover, .velo-home-menu-item:focus-visible { background-color: #F4F4F5; outline: none; }
.velo-home-enviar { transition: background-color 150ms ease-out, transform 150ms ease-out; }
.velo-home-enviar:hover:not(:disabled) { filter: brightness(0.95); }
.velo-home-enviar:active:not(:disabled) { transform: scale(0.95); }
.velo-home-fechar { transition: background-color 150ms ease-out; }
.velo-home-fechar:hover { background-color: #EDEDEF; }
.velo-home-aba { transition: color 150ms ease-out; }
.velo-home-oferta { transition: filter 150ms ease-out; }
.velo-home-oferta:hover { filter: brightness(0.95); }
.velo-home-oferta:focus-visible { outline: none; box-shadow: 0 0 0 2px #FBD3BC, 0 0 0 4px rgba(24,24,27,0.5) !important; }
.velo-home-aba:hover { color: #18181B; }
.velo-home-atlas .velo-home-atlas-conversas span.font-bold { font-weight: 500 !important; }
.velo-home-atlas button { box-shadow: none; }
.velo-home-atlas button:focus-visible, .velo-home-aba:focus-visible { outline: none; box-shadow: 0 0 0 2px #FFFFFF, 0 0 0 4px rgba(37,99,235,0.4); }
@media (prefers-reduced-motion: reduce) {
  .velo-home-btn, .velo-home-menu-item, .velo-home-enviar, .velo-home-fechar, .velo-home-aba { transition: none; }
}
`;

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
  const [menuCriarAberto, setMenuCriarAberto] = useState(false);
  // "Fechar" do card de próximo passo vale só para esta visita.
  const [proximoDispensado, setProximoDispensado] = useState(false);
  const menuCriarRef = useRef<HTMLDivElement>(null);
  const { nomeCurto } = useProfile();
  const primeiroNome = (() => {
    const primeiro = (nomeCurto ?? "").trim().split(" ")[0] ?? "";
    return /^usu[aá]rio$/i.test(primeiro) ? "" : primeiro;
  })();

  // Banner do topo: contagem real do período de teste (só para quem está em teste).
  const upgradeModal = useUpgradeModal();
  const fimDoTeste = useFimDoTeste();
  const [agora, setAgora] = useState(() => Date.now());
  const restanteDoTeste = fimDoTeste ? new Date(fimDoTeste).getTime() - agora : 0;
  const mostrarBannerTeste = restanteDoTeste > 0;
  useEffect(() => {
    if (!fimDoTeste) return;
    setAgora(Date.now());
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [fimDoTeste]);

  // Menu "Criar": fecha ao clicar fora ou com Escape.
  useEffect(() => {
    if (!menuCriarAberto) return;
    const aoClicarFora = (event: PointerEvent) => {
      if (event.target instanceof Node && menuCriarRef.current?.contains(event.target)) return;
      setMenuCriarAberto(false);
    };
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuCriarAberto(false);
    };
    window.addEventListener("pointerdown", aoClicarFora);
    window.addEventListener("keydown", aoTeclar);
    return () => {
      window.removeEventListener("pointerdown", aoClicarFora);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [menuCriarAberto]);

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
    ? Math.round(([onboardingStatus.mlConnected, onboardingStatus.hasPublication].filter(Boolean).length / 2) * 100)
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
      className="relative flex shrink-0 flex-col -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
      style={{ background: PAGE_BG, color: "#18181B" }}
    >
      <style>{HOME_CSS}</style>

      <motion.div {...revealProps(INTRO.promoDelay, -6)} className="absolute right-5 top-4 z-40">
        <Button
          type="button"
          variant="outline"
          onClick={() => setTutorialOpen(true)}
          aria-label="Ver tutorial de início"
          className="h-9 gap-2 rounded-[8px] border-[#E4E4E7] bg-white px-3 text-[13px] font-medium text-[#18181B] shadow-none hover:bg-[#F4F4F5]"
        >
          <PlayCircle aria-hidden="true" className="h-4 w-4" />
          Ver tutorial
        </Button>
      </motion.div>

      {/* Banner do topo (medidas da referência: 780 × 62, a 35px do topo), com o
          prazo real do teste. Não aparece para quem não está em teste. */}
      {mostrarBannerTeste && (
        <motion.div {...revealProps(INTRO.promoDelay, -8)} className="flex justify-center px-[150px] pt-[35px]">
          <div
            role="status"
            aria-label="Prazo do período de teste"
            className="flex h-[62px] w-full max-w-[780px] items-center justify-between gap-6 rounded-[6px] px-6"
            style={{ background: "#FBD3BC", color: "#18181B" }}
          >
            <div className="flex min-w-0 items-center gap-6">
              <span className="truncate text-[16px] font-semibold tracking-[-0.01em]">Seu período de teste termina em</span>
              <span className="shrink-0 text-[26px] font-bold tabular-nums tracking-[-0.02em]">
                {formatarContagem(restanteDoTeste)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => upgradeModal.open({ origin: "inicio-banner-teste" })}
              className="velo-home-oferta flex h-[30px] shrink-0 items-center gap-2 rounded-[6px] px-3 text-[14px] font-medium"
              style={{ background: "#F58142", color: "#18181B", boxShadow: "none" }}
            >
              Ver planos
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Medidas da referência: título de 48px, caixa de 720 × 128 a 58px dele e
          o card de próximo passo 40px abaixo. Bloco um pouco abaixo do centro. */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-12 pt-28">
        <motion.h1
          initial={playIntro ? { opacity: 0, y: introTitleOffset, scale: 0.985 } : false}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          // Transições por propriedade em vez de keyframes com `times`: o título
          // aparece parado, depois sobe.
          transition={playIntro
            ? {
                opacity: { duration: INTRO.titleFade, ease: "easeOut" },
                scale: { duration: INTRO.titleFade, ease: INTRO.travelEase },
                y: { delay: INTRO.titleTravelDelay, duration: INTRO.titleTravel, ease: INTRO.travelEase },
              }
            : { duration: 0 }}
          className="m-0 text-center"
          style={{ fontSize: 48, fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.035em", color: "#18181B" }}
        >
          <span className="block">
            {primeiroNome ? `Olá ${primeiroNome}` : "Olá"}
            <span style={{ color: "#2563EB" }}>.</span>
          </span>
          <span className="block">Por onde você quer começar?</span>
        </motion.h1>

        <div className="relative mt-[58px] w-full max-w-[720px]">
          {/* Caixa do Atlas: texto em cima; "+" e Atlas à esquerda; Conversas,
              Criar e enviar à direita. A lógica do chat não mudou. */}
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
            className="velo-home-atlas relative z-[32] flex flex-col justify-between"
            style={{
              height: 128,
              boxSizing: "border-box",
              padding: "20px 12px 12px 20px",
              borderRadius: 10,
              border: chatActive ? "1px solid #D4D4D8" : "1px solid #E4E4E7",
              background: "#FFFFFF",
              boxShadow: chatActive ? "0 1px 2px rgba(0,0,0,0.04), 0 6px 18px rgba(17,17,20,0.06)" : "0 1px 2px rgba(0,0,0,0.04)",
              cursor: "text",
              transition: "border-color 200ms ease, box-shadow 240ms ease",
            }}
          >
            <form onSubmit={handleChatSubmit} style={{ display: "block", minWidth: 0 }}>
              <span style={{ position: "relative", display: "flex", alignItems: "center", minWidth: 0, height: 22 }}>
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
                  className="velo-home-atlas-texto"
                  style={{
                    width: "100%",
                    minWidth: 0,
                    border: 0,
                    outline: 0,
                    padding: 0,
                    background: "transparent",
                    color: "#18181B",
                    caretColor: "#18181B",
                    fontSize: 15,
                    lineHeight: "22px",
                    position: "relative",
                    zIndex: 1,
                  }}
                />
              </span>
            </form>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  aria-label="Escolher produto"
                  title="Escolher produto"
                  className="velo-home-btn flex h-[30px] w-[30px] items-center justify-center rounded-[6px] border border-[#E4E4E7] bg-white text-[#3F3F46]"
                  onClick={() => navigate("/dashboard/catalogo")}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="block h-4 w-4">
                    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <span className="flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#E4E4E7] bg-white px-2 text-[14px] font-medium text-[#18181B]">
                  <span aria-hidden="true" className="inline-flex h-4 w-4 shrink-0">
                    <AssistantAvatar />
                  </span>
                  Atlas
                </span>
              </div>

              <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                {temHistorico && (
                  <div ref={historyMenuRef} className="velo-home-atlas-conversas">
                    <AtlasHistoryMenu
                      userId={user?.id}
                      activeThreadId={threadId}
                      onSelectThread={abrirConversa}
                      onThreadDeleted={aoApagarConversa}
                      triggerLabel="Conversas"
                      triggerStyle={{ height: 30, minHeight: 30, borderRadius: 6, color: "#3F3F46", fontSize: 14 }}
                    />
                  </div>
                )}

                {/* "Criar": atalhos para começar (as páginas que já existem). */}
                <div ref={menuCriarRef} className="relative">
                  <button
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={menuCriarAberto}
                    onClick={() => setMenuCriarAberto((aberto) => !aberto)}
                    className="velo-home-btn flex h-[30px] items-center gap-1.5 rounded-[6px] border border-[#E4E4E7] bg-white pl-2.5 pr-2 text-[14px] font-medium text-[#18181B]"
                  >
                    Criar
                    <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 text-[#52525B]" strokeWidth={2} />
                  </button>
                  <AnimatePresence>
                    {menuCriarAberto && (
                      <motion.div
                        role="menu"
                        initial={reduceMotion ? false : { opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }}
                        className="absolute right-0 top-[calc(100%+6px)] z-50 w-[220px] rounded-[10px] border border-[#E4E4E7] bg-white p-1"
                        style={{ boxShadow: "0 10px 30px rgba(17,17,20,0.10)" }}
                      >
                        {ACOES_CRIAR.map((acao) => (
                          <button
                            key={acao.id}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setMenuCriarAberto(false);
                              navigate(acao.rota);
                            }}
                            className="velo-home-menu-item flex h-9 w-full items-center rounded-[6px] px-2.5 text-left text-[14px] text-[#18181B]"
                          >
                            {acao.rotulo}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  aria-label="Enviar"
                  className="velo-home-enviar flex h-[30px] w-[30px] items-center justify-center rounded-[6px] text-white"
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
                    background: chatInput.trim() ? "#2563EB" : "#C9D7FA",
                    cursor: chatActive && !chatInput.trim() ? "default" : "pointer",
                  }}
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="block h-4 w-4">
                    <path d="M12 19V5M6.5 10.5 12 5l5.5 5.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Próximo passo (dados reais do Mercado Livre), no formato do card
              "Mostre o que você criou" da referência. Some quando o chat abre. */}
          {!proximoDispensado && (
            <motion.div {...revealProps(INTRO.bandDelays[0], 10)} className="mt-10">
            <div
              aria-hidden={chatActive}
              className="relative flex items-center gap-4 rounded-[10px] border border-[#EDEDEF] bg-[#FAFAFA] py-4 pl-4 pr-10"
              style={{
                opacity: chatActive ? 0 : 1,
                pointerEvents: chatActive ? "none" : "auto",
                transition: "opacity 260ms ease",
              }}
            >
              <div
                aria-label={onboardingProgress === null ? "Progresso indisponível" : `${onboardingProgress}% concluído`}
                className="flex h-[58px] w-[86px] shrink-0 items-center justify-center rounded-[6px] border border-[#EDEDEF] bg-white"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full p-[3px]"
                  style={{
                    background: onboardingProgress === null
                      ? "#ECECEE"
                      : `conic-gradient(#2563EB ${onboardingProgress}%, #ECECEE 0)`,
                  }}
                >
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-[10px] font-semibold text-[#3F3F46]">
                    {onboardingProgress === null ? "—" : `${onboardingProgress}%`}
                  </span>
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] font-semibold leading-5 text-[#18181B]">Próximo passo</p>
                <p className="m-0 text-[14px] leading-5 text-[#52525B]">{nextStepCopy}</p>
              </div>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={conectandoMl}
                className="velo-home-btn h-9 shrink-0 rounded-[6px] border border-[#D4D4D8] bg-white px-4 text-[14px] font-medium text-[#18181B]"
                style={{ cursor: conectandoMl ? "wait" : "pointer" }}
              >
                {conectandoMl ? "Abrindo…" : nextStepLabel}
              </button>
              <button
                type="button"
                aria-label="Fechar próximo passo"
                onClick={() => setProximoDispensado(true)}
                className="velo-home-fechar absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-[6px] text-[#52525B]"
              >
                <X aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
            </div>
            </motion.div>
          )}

          <AnimatePresence>
            {chatActive && (
              <motion.div
                ref={suggestionListRef}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ delay: reduceMotion ? 0 : 0.12, duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="absolute left-0 right-0 top-[140px] z-[33] flex flex-col"
                style={{ background: PAGE_BG }}
              >
                {CHAT_SUGGESTIONS.map((suggestion, index) => (
                  <motion.button
                    key={suggestion}
                    type="button"
                    initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ delay: reduceMotion ? 0 : 0.18 + index * 0.06, duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => void enviarParaAtlas(suggestion)}
                    onMouseEnter={() => setHoveredSuggestion(suggestion)}
                    onMouseLeave={() => setHoveredSuggestion(null)}
                    onFocus={() => setHoveredSuggestion(suggestion)}
                    onBlur={() => setHoveredSuggestion(null)}
                    className="flex h-11 items-center gap-3 rounded-[8px] px-3 text-left text-[15px] focus-visible:outline-none"
                    style={{
                      background: hoveredSuggestion === suggestion ? "#F4F4F5" : "transparent",
                      color: hoveredSuggestion === suggestion ? "#18181B" : "#71717A",
                      transition: "background-color 160ms ease, color 160ms ease",
                    }}
                    whileTap={reduceMotion ? undefined : { scale: 0.995 }}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" style={{ opacity: hoveredSuggestion === suggestion ? 0.9 : 0.55 }}>
                      <path d="M4 12h14M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{suggestion}</span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Barra de baixo, como "Aplicativos recentes / Modelos / Explorar tudo" da referência. */}
      <motion.nav
        {...revealProps(INTRO.bandDelays[1], 8)}
        aria-label="Projetos e modelos"
        data-dashboard-tour="home-primeiros-passos"
        // pr maior: o balão de suporte (fixo no canto) não cobre o "Explorar tudo".
        className="flex h-[66px] shrink-0 items-stretch justify-between border-t border-[#EDEDEF] pl-7 pr-[92px]"
        style={{ background: PAGE_BG }}
      >
        <div className="flex items-stretch gap-1">
          <button
            type="button"
            onClick={go("/dashboard/minha-loja")}
            className="velo-home-aba relative px-2.5 text-[14px] font-semibold text-[#18181B]"
          >
            Projetos recentes
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#2563EB]" />
          </button>
          <button
            type="button"
            onClick={go("/dashboard/modelos")}
            className="velo-home-aba px-2.5 text-[14px] font-medium text-[#3F3F46]"
          >
            Modelos da Velo
          </button>
        </div>
        <button
          type="button"
          onClick={go("/dashboard/projetos")}
          className="velo-home-aba flex items-center gap-1.5 px-2.5 text-[14px] font-medium text-[#18181B]"
        >
          Explorar tudo
          <ArrowUpRight aria-hidden="true" className="h-4 w-4" strokeWidth={2} />
        </button>
      </motion.nav>

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
