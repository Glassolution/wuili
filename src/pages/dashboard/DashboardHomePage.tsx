import { useEffect, useLayoutEffect, useRef, useState, type ElementType, type FormEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Archive, ArrowRight, ArrowUp, BadgePercent, Check, FileText, Info, LayoutTemplate, Link2, MoreHorizontal, Plus, Search, Settings2, ShoppingBag, Sparkles, UserRound, Wand2 } from "lucide-react";
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
  const [menuMaisAberto, setMenuMaisAberto] = useState(false);
  const [aba, setAba] = useState<"visao-geral" | "primeiros-passos" | "ferramentas" | "atividade">("visao-geral");
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
    if (!menuMaisAberto) return;
    const fecharComEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuMaisAberto(false);
    };
    window.addEventListener("keydown", fecharComEsc);
    return () => window.removeEventListener("keydown", fecharComEsc);
  }, [menuMaisAberto]);

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
        className="shrink-0 bg-white -m-5 min-h-[calc(100%+2.5rem)] sm:-m-6 sm:min-h-[calc(100%+3rem)] lg:-m-7 lg:min-h-[calc(100%+3.5rem)]"
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
  const listas: { titulo: string; linhas: Linha[] }[] =
    aba === "visao-geral"
      ? [
          { titulo: "Atividade recente", linhas: [linhaProximoPasso, linhaMercadoLivre, linhaPublicacao] },
          { titulo: "Ferramentas", linhas: [linhaTemas, linhaPaginaIa, linhaAfiliados] },
        ]
      : aba === "primeiros-passos"
        ? [{ titulo: "Primeiros passos", linhas: [linhaTemas, linhaMercadoLivre, linhaPublicacao] }]
        : aba === "ferramentas"
          ? [{ titulo: "Ferramentas", linhas: [linhaTemas, linhaPaginaIa, linhaAfiliados] }]
          : [{ titulo: "Atividade recente", linhas: [linhaProximoPasso, linhaMercadoLivre, linhaPublicacao] }];

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
          {/* Histórico das conversas: só com o chat aberto e com conversa anterior. */}
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
                  triggerStyle={{ height: 36, borderRadius: 999, border: "1px solid #ECEEF2", background: "#FFFFFF", boxShadow: "none", color: "#0B0D12", fontSize: 13 }}
                />
              </motion.div>
            )}
          </AnimatePresence>
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
          <p className="m-0 text-[13px] text-[#8A93A3]">Início /</p>
          <div className="mt-3 flex items-center justify-between gap-6">
            <h1 className="m-0 min-w-0 truncate text-[32px] font-semibold leading-tight tracking-[-0.02em]">
              {primeiroNome ? `Bem-vindo, ${primeiroNome}` : "Bem-vindo à Velo"}
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
          <p className="m-0 mt-1.5 text-[15px] text-[#8A93A3]">Por onde você quer começar?</p>
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
                    layoutId="home-aba-ativa"
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-[#2F5BEA]"
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
                  />
                )}
              </button>
            );
          })}
        </motion.div>

        {/* Barra do Atlas (mesma lógica de antes) */}
        <motion.div
          {...revealProps(0.14, 10)}
          ref={welcomeChatRef}
          data-dashboard-tour="home-atlas-chat"
          role="search"
          aria-label="Assistente Atlas"
          aria-expanded={chatActive}
          onClick={() => setChatActive(true)}
          className="relative z-[32] mt-6 flex h-14 w-full items-center rounded-full border bg-white pl-3 pr-2.5"
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

        <div className="relative mt-6">
          <motion.div
            aria-hidden={chatActive}
            initial={false}
            animate={chatActive
              ? { opacity: 0, y: reduceMotion ? 0 : 16, filter: "blur(6px)" }
              : { opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: reduceMotion ? 0 : 0.36, ease: [0.22, 1, 0.36, 1] }}
            style={{ pointerEvents: chatActive ? "none" : "auto" }}
          >
            {/* Destaque: prévia grande, como o card do site na referência */}
            {mostrarDestaque && (
              <motion.section
                {...revealProps(0.3, 12)}
                data-dashboard-tour="home-primeiros-passos"
                aria-labelledby="home-destaque"
                className="mt-6 overflow-hidden rounded-[20px] bg-[#F5F6F8] p-2"
              >
                <div className="grid min-h-[300px] grid-cols-1 overflow-hidden rounded-[16px] bg-[#FAFAF9] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="flex min-w-0 flex-col p-7">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-semibold tracking-[0.24em] text-[#0B0D12]">VELO</span>
                      <nav aria-label="Atalhos" className="flex gap-4 text-[11px] text-[#4B5563]">
                        <button type="button" onClick={go("/dashboard/catalogo")} className="hover:text-[#0B0D12]">Catálogo</button>
                        <button type="button" onClick={go("/dashboard/modelos")} className="hover:text-[#0B0D12]">Templates</button>
                        <button type="button" onClick={go("/dashboard/publicacoes")} className="hover:text-[#0B0D12]">Publicações</button>
                      </nav>
                    </div>
                    <span className="mt-6 text-[12px] font-medium text-[#8A93A3]">01 · Primeiro passo</span>
                    <h2
                      id="home-destaque"
                      className="velo-home-serif m-0 mt-2 text-[46px] font-normal leading-[1.02] text-[#0B0D12]"
                    >
                      Adicione seu
                      <br />
                      primeiro produto
                    </h2>
                    <p className="m-0 mt-3 max-w-[280px] text-[13px] leading-relaxed text-[#4B5563]">
                      Comece com nome, preço e fotos. Você pode adicionar mais detalhes depois.
                    </p>
                    <button
                      type="button"
                      onClick={go("/dashboard/catalogo")}
                      className="velo-home-dark mt-6 flex h-10 w-fit items-center gap-2 rounded-full px-5 text-[14px] font-medium text-white"
                    >
                      Adicionar produto
                      <ArrowRight size={16} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="relative min-h-[240px]">
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
                </div>
              </motion.section>
            )}

            {/* Listas no estilo "Recent activity" */}
            {listas.map((lista, indiceLista) => (
              <motion.section
                key={`${aba}-${lista.titulo}`}
                {...revealProps(0.38 + indiceLista * 0.08, 12)}
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
          </motion.div>

          {/* Sugestões do Atlas: ocupam o lugar do conteúdo enquanto o chat está aberto. */}
          <AnimatePresence>
            {chatActive && (
              <motion.div
                ref={suggestionListRef}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ delay: reduceMotion ? 0 : 0.16, duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-x-0 top-0 z-[33] flex w-full flex-col"
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
                      background: hoveredSuggestion === suggestion ? "#F5F6F8" : "transparent",
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
