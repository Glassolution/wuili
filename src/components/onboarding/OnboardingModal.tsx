import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CircleDashed,
  Cpu,
  ExternalLink,
  HeartPulse,
  Home,
  LayoutGrid,
  MoreHorizontal,
  Shirt,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ENTRADA_POS_ONBOARDING } from "@/lib/dashboardIntro";
import { useIsMobile } from "@/hooks/use-mobile";
import { trackSignup } from "@/lib/signupFunnel";

/*
  Onboarding curto da Velo (3 perguntas).

  Antes eram 7 perguntas antes de ver qualquer produto. Ficaram só as que mudam
  a experiência agora:
    1. nome    — como a pessoa quer ser chamada (saudação no painel)
    2. mercadoLivre — única resposta que muda o caminho seguinte
    3. nicho   — opcional, personaliza o catálogo

  As outras perguntas do quiz antigo (perfil, produtos, dificuldade,
  metodoAtual) não sumiram do produto: passaram para um convite discreto no
  painel, depois da primeira publicação (src/components/dashboard/PerfilPerguntaCard.tsx).
  "Como conheceu a Velo" saiu de vez — a origem real já é capturada no cadastro.

  Os `id`/`value` são lidos por src/lib/perfilDoQuiz.ts: mude só textos e ícones
  sem revisar lá.
*/

type Option = {
  value: string;
  label: string;
  description?: string;
  icon: LucideIcon;
};

type ChoiceQuestion = {
  kind: "choice";
  id: string;
  label: string;
  subtitle: string;
  optional?: boolean;
  options: Option[];
};

type TextQuestion = {
  kind: "text";
  id: string;
  label: string;
  subtitle: string;
  placeholder: string;
};

type Question = ChoiceQuestion | TextQuestion;

const QUESTIONS: Question[] = [
  {
    kind: "text",
    id: "nome",
    label: "Como podemos te chamar?",
    subtitle: "Só o primeiro nome, para a Velo falar com você.",
    placeholder: "Seu primeiro nome",
  },
  {
    kind: "choice",
    id: "mercadoLivre",
    label: "Você já vende no Mercado Livre?",
    subtitle: "Isso muda o caminho que vamos te mostrar.",
    options: [
      { value: "sim", label: "Sim, já tenho conta", description: "Mesmo que ainda não tenha vendido", icon: BadgeCheck },
      { value: "nao", label: "Ainda não tenho", description: "Tudo bem, te mostro como criar", icon: CircleDashed },
    ],
  },
  {
    kind: "choice",
    id: "nicho",
    label: "O que você gostaria de vender?",
    subtitle: "Para separar produtos com a sua cara. Dá para mudar depois.",
    optional: true,
    options: [
      { value: "beleza", label: "Beleza e cuidados", icon: Sparkles },
      { value: "moda", label: "Moda e acessórios", icon: Shirt },
      { value: "tech", label: "Eletrônicos", icon: Cpu },
      { value: "casa", label: "Casa e cozinha", icon: Home },
      { value: "saude", label: "Saúde e fitness", icon: HeartPulse },
      { value: "geral", label: "Quero ver de tudo", icon: LayoutGrid },
      { value: "outro", label: "Outra coisa", icon: MoreHorizontal },
    ],
  },
];

type Answers = Record<string, string>;

// Controle de exibição do onboarding — flag próprio, independente do estado de
// loja/perfil no Supabase. Puramente frontend (localStorage), keyed por usuário.
const onboardingDoneKey = (userId: string) => `velo-onboarding-done:${userId}`;

// Evento disparado no momento em que o usuário conclui o onboarding. Serve para
// que outras telas (ex.: o tutorial em vídeo do dashboard) só reajam DEPOIS que
// o cadastro terminou, em vez de abrir por cima do modal de onboarding.
export const ONBOARDING_COMPLETED_EVENT = "velo-onboarding-completed";

export const hasSeenOnboarding = (userId: string): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(onboardingDoneKey(userId)) === "1";
};

export const markOnboardingSeen = (userId: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(onboardingDoneKey(userId), "1");
  window.dispatchEvent(new CustomEvent(ONBOARDING_COMPLETED_EVENT, { detail: { userId } }));
};

// Sinal explícito de "acabou de se cadastrar", gravado no signup para garantir
// que o modal apareça no primeiro acesso independentemente do metadata do Auth.
const onboardingPendingKey = (userId: string) => `velo-onboarding-pending:${userId}`;

export const markOnboardingPending = (userId: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(onboardingPendingKey(userId), "1");
};

export const hasPendingOnboarding = (userId: string): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(onboardingPendingKey(userId)) === "1";
};

// Considera "cadastro recente" quando o metadata de onboarding pendente está
// marcado (definido no signup) ou quando criação e último login ocorreram na
// mesma janela de ~10 min. Não depende do perfil salvo no banco.
export const isFreshSignup = (user: {
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: { velo_onboarding_pending?: boolean } | null;
} | null): boolean => {
  if (!user) return false;
  if (user.user_metadata?.velo_onboarding_pending === true) return true;
  const createdAt = new Date(user.created_at ?? "").getTime();
  const lastSignInAt = new Date(user.last_sign_in_at ?? "").getTime();
  return (
    Number.isFinite(createdAt) &&
    Number.isFinite(lastSignInAt) &&
    Math.abs(lastSignInAt - createdAt) <= 10 * 60 * 1000
  );
};

type OnboardingUser = {
  id?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: { velo_onboarding_pending?: boolean } | null;
} | null;

// Verdadeiro quando o usuário é um cadastro recente que ainda NÃO concluiu o
// onboarding — ou seja, quando o modal de onboarding está (ou deveria estar) na
// tela. Fonte única de verdade usada pelo layout e pelo tutorial em vídeo.
export const shouldShowOnboarding = (user: OnboardingUser): boolean => {
  if (!user?.id) return false;
  const wants = hasPendingOnboarding(user.id) || isFreshSignup(user);
  return wants && !hasSeenOnboarding(user.id);
};

type OnboardingModalProps = {
  /** Chamado quando o usuário conclui a última etapa. */
  onComplete: (answers: Answers) => void;
};

// Easing "ease-out expo" — sensação suave/premium usada nas transições de etapa.
const EASE = [0.22, 1, 0.36, 1] as const;

// ── Paleta do onboarding — ISOLADA a esta tela ───────────────────────────────
const ELECTRIC_BLUE = "#0B5FFF";
const INK = "#111111";
const MUTED = "#5A5A63";
const SERIF = '"Instrument Serif", "Iowan Old Style", "Times New Roman", serif';
const SANS = '"Inter", system-ui, -apple-system, sans-serif';

const BACKGROUND_SRC = "/assets/onboarding-fundo.jpg";
const VELO_LOGO_SRC = "/logo.png";

/*
  PARA REVISÃO (Felipe): passos genéricos de criação de conta no Mercado Livre.
  De propósito NÃO afirmam exigências específicas (documento, CNPJ, prazo de
  liberação, idade mínima), porque isso muda com o tempo e não foi confirmado
  numa fonte oficial. Se quiser detalhar, edite só os textos abaixo.
*/
const PASSOS_MERCADO_LIVRE = [
  "Abra o Mercado Livre e crie sua conta com o seu e-mail.",
  "Dentro da conta, escolha a opção de começar a vender.",
  "Preencha os dados que o Mercado Livre pedir para vendedores.",
  "Volte aqui na Velo e conecte a sua conta para publicar.",
];

const useBackgroundImage = (src: string) => {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const img = new Image();
    img.onload = () => setLoaded(true);
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src]);
  return loaded;
};

// Céu azul profundo com nuvens difusas — fallback enquanto não há ilustração.
const SkyBackdrop = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
    <div
      className="absolute inset-0"
      style={{
        background:
          "linear-gradient(180deg, #0E2A8A 0%, #1E4FC4 34%, #4F82E3 58%, #A9C3F0 78%, #E9E3D6 100%)",
      }}
    />
    {[
      { left: "-6%", top: "30%", w: 520, h: 260, o: 0.9 },
      { left: "58%", top: "8%", w: 460, h: 340, o: 0.85 },
      { left: "72%", top: "44%", w: 560, h: 260, o: 0.75 },
      { left: "18%", top: "62%", w: 700, h: 280, o: 0.7 },
      { left: "-10%", top: "78%", w: 620, h: 260, o: 0.8 },
    ].map((c, i) => (
      <div
        key={i}
        className="absolute rounded-full"
        style={{
          left: c.left,
          top: c.top,
          width: c.w,
          height: c.h,
          opacity: c.o,
          background:
            "radial-gradient(closest-side, #FFF6E6 0%, rgba(255,246,230,0.62) 40%, rgba(255,246,230,0.22) 72%, rgba(255,246,230,0) 100%)",
        }}
      />
    ))}
  </div>
);

/* ── Telas do fluxo ──────────────────────────────────────────────────────────
   welcome → nome → mercadoLivre → (guia do ML, só para quem respondeu "não")
   → nicho → fim. */
type Screen = { kind: "welcome" } | { kind: "question"; question: Question } | { kind: "ml-guide" };

const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [mostrandoGuiaML, setMostrandoGuiaML] = useState(false);
  const [direction, setDirection] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [nome, setNome] = useState("");
  const reduce = useReducedMotion();
  const isMobileHook = useIsMobile();
  const isMobile = isMobileHook || (typeof window !== "undefined" && window.innerWidth < 768);
  const backgroundLoaded = useBackgroundImage(BACKGROUND_SRC);
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const nomeInputRef = useRef<HTMLInputElement | null>(null);
  const concluido = useRef(false);

  const question = QUESTIONS[index];
  const screen: Screen = !started
    ? { kind: "welcome" }
    : mostrandoGuiaML
      ? { kind: "ml-guide" }
      : { kind: "question", question };

  /* ── Medição ──────────────────────────────────────────────────────────────
     Por pergunta: viu / respondeu / pulou / voltou / concluiu. O abandono é
     deduzido no painel (viu a pergunta e não tem "answer" nem "complete"). */
  useEffect(() => {
    trackSignup("onboarding_view");
    return () => {
      if (!concluido.current) trackSignup("onboarding_skip", "abandonou");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por montagem
  }, []);

  useEffect(() => {
    if (!started || mostrandoGuiaML) return;
    trackSignup("onboarding_question_view", question.id);
    if (question.kind === "text") {
      const timer = window.setTimeout(() => nomeInputRef.current?.focus(), 420);
      return () => window.clearTimeout(timer);
    }
  }, [started, mostrandoGuiaML, question.id, question.kind]);

  const finalizar = (respostas: Answers) => {
    concluido.current = true;
    trackSignup("onboarding_complete");
    onComplete(respostas);
  };

  const avancar = (respostas: Answers) => {
    setDirection(1);
    if (index >= QUESTIONS.length - 1) {
      finalizar(respostas);
      return;
    }
    setIndex((v) => v + 1);
  };

  // Escolha única avança sozinha: sem botão "Continuar".
  const escolher = (questionId: string, value: string) => {
    const respostas = { ...answers, [questionId]: value };
    setAnswers(respostas);
    trackSignup("onboarding_answer", `${questionId}:${value}`);
    if (questionId === "mercadoLivre" && value === "nao") {
      setDirection(1);
      setMostrandoGuiaML(true);
      trackSignup("onboarding_ml_guide");
      return;
    }
    // Pequeno atraso: a pessoa vê o card marcar antes da tela trocar.
    window.setTimeout(() => avancar(respostas), reduce ? 0 : 260);
  };

  const confirmarNome = () => {
    const limpo = nome.trim().split(/\s+/)[0]?.slice(0, 24) ?? "";
    const respostas = { ...answers, nome: limpo };
    setAnswers(respostas);
    trackSignup(limpo ? "onboarding_answer" : "onboarding_skip", "nome");
    avancar(respostas);
  };

  const pular = () => {
    trackSignup("onboarding_skip", question.id);
    avancar(answers);
  };

  const sairDoGuia = () => {
    setMostrandoGuiaML(false);
    setDirection(1);
    if (index >= QUESTIONS.length - 1) finalizar(answers);
    else setIndex((v) => v + 1);
  };

  const handleBack = () => {
    setDirection(-1);
    trackSignup("onboarding_back", question.id);
    if (mostrandoGuiaML) {
      setMostrandoGuiaML(false);
      return;
    }
    if (index === 0) {
      setStarted(false);
      return;
    }
    setIndex((v) => Math.max(0, v - 1));
  };

  const handleStart = () => {
    setDirection(1);
    setStarted(true);
    trackSignup("onboarding_start");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const isFirstEntrance = useRef(true);
  useEffect(() => {
    isFirstEntrance.current = false;
  }, []);

  const contentVariants: Variants = useMemo(
    () => ({
      initial: (dir: number) => ({ opacity: 0, x: reduce || isFirstEntrance.current ? 0 : dir >= 0 ? 24 : -24 }),
      animate: {
        opacity: 1,
        x: 0,
        transition: {
          duration: reduce ? 0.001 : 0.34,
          ease: EASE,
          staggerChildren: reduce ? 0 : isFirstEntrance.current ? 0.09 : 0.035,
          delayChildren: reduce ? 0 : isFirstEntrance.current ? 0.55 : 0.04,
        },
      },
      exit: (dir: number) => ({
        opacity: 0,
        x: reduce ? 0 : dir >= 0 ? -24 : 24,
        transition: { duration: reduce ? 0.001 : 0.2, ease: EASE },
      }),
    }),
    [reduce],
  );

  const itemVariants: Variants = {
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    animate: { opacity: 1, y: 0, transition: { duration: reduce ? 0.001 : 0.7, ease: EASE } },
  };

  const illustrationVariants: Variants = {
    initial: { opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.9 },
    animate: { opacity: 1, y: 0, scale: 1, transition: { duration: reduce ? 0.001 : 0.9, ease: EASE } },
  };

  const passoAtual = mostrandoGuiaML ? 1 : index;

  /* ── Blocos compartilhados ─────────────────────────────────────────────── */

  const cabecalhoPergunta = (claro: boolean) => (
    <motion.div variants={itemVariants} className="text-center">
      <h2
        className={`mx-auto max-w-[340px] font-semibold leading-[1.15] ${isMobile ? "text-[27px]" : "text-[26px]"}`}
        style={
          claro
            ? { color: "#FFFFFF", letterSpacing: "-0.03em", textShadow: "0 2px 16px rgba(8,22,70,0.22)" }
            : { fontFamily: SERIF, color: INK, fontWeight: 400 }
        }
      >
        {mostrandoGuiaML ? "Criar sua conta no Mercado Livre" : question.label}
      </h2>
      <p
        className={`mx-auto mt-2.5 max-w-[320px] leading-snug ${isMobile ? "text-[15px]" : "text-[13.5px]"}`}
        style={
          claro
            ? { color: "rgba(255,255,255,0.9)", textShadow: "0 1px 10px rgba(8,22,70,0.3)" }
            : { color: MUTED }
        }
      >
        {mostrandoGuiaML
          ? "Leva poucos minutos. Você pode olhar os produtos enquanto isso."
          : `${question.kind === "choice" && question.optional ? "Opcional · " : ""}${question.subtitle}`}
      </p>
    </motion.div>
  );

  const listaGuiaML = (claro: boolean) => (
    <div className="mt-7 flex flex-col gap-2.5">
      {PASSOS_MERCADO_LIVRE.map((passo, i) => (
        <motion.div
          key={passo}
          variants={itemVariants}
          className="flex items-start gap-3 rounded-[18px] px-4 py-3.5"
          style={{
            background: claro ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.72)",
            boxShadow: claro ? "0 6px 18px rgba(8,22,70,0.08)" : "inset 0 0 0 1.5px rgba(17,17,17,0.06)",
          }}
        >
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold"
            style={{ background: ELECTRIC_BLUE, color: "#FFFFFF" }}
          >
            {i + 1}
          </span>
          <span className="text-[15px] leading-snug" style={{ color: INK }}>
            {passo}
          </span>
        </motion.div>
      ))}
      <motion.a
        variants={itemVariants}
        href="https://www.mercadolivre.com.br/registration"
        target="_blank"
        rel="noreferrer noopener"
        className="mt-1 flex items-center justify-center gap-2 rounded-full px-4 py-3.5 text-[15px] font-medium"
        style={{ background: "rgba(255,255,255,0.9)", color: ELECTRIC_BLUE }}
      >
        Abrir o Mercado Livre
        <ExternalLink size={16} strokeWidth={2} />
      </motion.a>
    </div>
  );

  /* ── Celular ───────────────────────────────────────────────────────────── */
  if (isMobile) {
    const mobileButton = (label: string, onClick: () => void, enabled = true) => (
      <motion.button
        variants={itemVariants}
        type="button"
        onClick={onClick}
        disabled={!enabled}
        whileTap={reduce || !enabled ? undefined : { scale: 0.98 }}
        className={`h-[58px] w-full rounded-full text-[17px] font-semibold transition-colors duration-200 ${
          enabled ? "bg-[#0B5FFF] text-white active:bg-[#0A52DD]" : "bg-white/70 text-[#111111]/40"
        }`}
        style={enabled ? { boxShadow: "0 10px 24px rgba(11,95,255,0.22)" } : undefined}
      >
        {label}
      </motion.button>
    );

    return (
      <motion.div
        className="fixed inset-0 z-[120] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Boas-vindas da Velo"
        data-velo-flat-buttons=""
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: reduce ? 0.001 : ENTRADA_POS_ONBOARDING.modalExit, ease: "easeInOut" } }}
        transition={{ duration: reduce ? 0.001 : 0.5, ease: "easeOut" }}
        style={{ fontFamily: SANS, background: "#1E4FC4" }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <SkyBackdrop />
          <div
            className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
            style={{ backgroundImage: `url("${BACKGROUND_SRC}")`, opacity: backgroundLoaded ? 1 : 0 }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(14,42,138,0.52) 0%, rgba(20,60,170,0.42) 45%, rgba(30,79,196,0.16) 68%, rgba(30,79,196,0) 82%)",
            }}
          />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          {screen.kind === "welcome" ? (
            <motion.div
              key="welcome"
              custom={direction}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative z-10 flex min-h-0 flex-1 flex-col px-5"
              style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
            >
              <div className="flex h-14 shrink-0 items-center justify-end" style={{ marginTop: "env(safe-area-inset-top)" }}>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-1 py-2 text-[15px] font-medium text-white/90 transition-opacity active:opacity-60"
                  style={{ textShadow: "0 1px 2px rgba(0,0,0,0.12)" }}
                >
                  Sair
                </button>
              </div>

              <div className="flex flex-1 flex-col items-center justify-center">
                <motion.img
                  variants={illustrationVariants}
                  src={VELO_LOGO_SRC}
                  alt=""
                  style={{ filter: "drop-shadow(0 14px 18px rgba(11,95,255,0.22))" }}
                  className="block h-[92px] w-[92px] object-contain"
                />
                <motion.span
                  variants={itemVariants}
                  className="mt-3 text-[54px] font-extrabold leading-none text-white"
                  style={{ letterSpacing: "-0.05em", textShadow: "0 2px 18px rgba(8,22,70,0.25)" }}
                >
                  Velo
                </motion.span>
              </div>

              <motion.p
                variants={itemVariants}
                className="mx-auto mb-5 max-w-[320px] text-center text-[16px] leading-[1.5]"
                style={{ color: "#3F3F46" }}
              >
                São <span style={{ color: INK, fontWeight: 600 }}>3 perguntas</span> — menos de um minuto. Depois você já entra no
                catálogo de produtos.
              </motion.p>
              {mobileButton("Começar", handleStart)}
            </motion.div>
          ) : (
            <motion.div
              key={screen.kind === "ml-guide" ? "ml-guide" : `q-${index}`}
              custom={direction}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative z-10 flex min-h-0 flex-1 flex-col"
            >
              <div
                className="flex h-14 shrink-0 items-center justify-between px-3"
                style={{ marginTop: "env(safe-area-inset-top)" }}
              >
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Voltar"
                  className="grid h-11 w-11 place-items-center rounded-full text-white transition-colors active:bg-white/15"
                >
                  <ArrowLeft size={22} strokeWidth={2} />
                </button>
                <div className="flex items-center gap-1.5" aria-label={`Pergunta ${passoAtual + 1} de ${QUESTIONS.length}`}>
                  {QUESTIONS.map((q, i) => (
                    <span
                      key={q.id}
                      className="h-[5px] rounded-full transition-all duration-300"
                      style={{
                        width: i === passoAtual ? 24 : 8,
                        background: i <= passoAtual ? "#FFFFFF" : "rgba(255,255,255,0.35)",
                      }}
                    />
                  ))}
                </div>
                <span className="w-11" />
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="my-auto py-6">
                  {cabecalhoPergunta(true)}

                  {screen.kind === "ml-guide" ? (
                    listaGuiaML(true)
                  ) : screen.question.kind === "text" ? (
                    <motion.div variants={itemVariants} className="mt-8">
                      <input
                        ref={nomeInputRef}
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmarNome();
                        }}
                        placeholder={screen.question.placeholder}
                        autoComplete="given-name"
                        maxLength={24}
                        className="h-[62px] w-full rounded-[18px] border-0 bg-white px-5 text-[18px] outline-none"
                        style={{ color: INK, boxShadow: "0 8px 22px rgba(8,22,70,0.16)" }}
                      />
                    </motion.div>
                  ) : (
                    <div role="radiogroup" aria-label={screen.question.label} className="mt-8 flex flex-col gap-2.5">
                      {screen.question.options.map((option) => {
                        const selected = answers[screen.question.id] === option.value;
                        const Icon = option.icon;
                        return (
                          <motion.button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            variants={itemVariants}
                            onClick={() => escolher(screen.question.id, option.value)}
                            whileTap={reduce ? undefined : { scale: 0.985 }}
                            className="flex min-h-[68px] w-full items-center gap-3.5 rounded-[20px] px-4 py-3 text-left transition-[background-color,box-shadow] duration-200"
                            style={{
                              background: "#FFFFFF",
                              boxShadow: selected
                                ? `inset 0 0 0 3px ${ELECTRIC_BLUE}, 0 10px 26px rgba(8,22,70,0.18)`
                                : "0 6px 18px rgba(8,22,70,0.12)",
                            }}
                          >
                            <span
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors duration-200"
                              style={
                                selected
                                  ? { background: ELECTRIC_BLUE, color: "#FFFFFF" }
                                  : { background: "rgba(11,95,255,0.08)", color: ELECTRIC_BLUE }
                              }
                            >
                              <Icon size={20} strokeWidth={1.9} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-[17px] font-semibold leading-tight" style={{ color: INK }}>
                                {option.label}
                              </span>
                              {option.description ? (
                                <span className="mt-0.5 text-[14px] leading-snug" style={{ color: MUTED }}>
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full transition-all duration-200"
                              style={
                                selected
                                  ? { background: ELECTRIC_BLUE, color: "#FFFFFF" }
                                  : { boxShadow: "inset 0 0 0 2px rgba(17,17,17,0.18)", color: "transparent" }
                              }
                              aria-hidden="true"
                            >
                              <Check size={14} strokeWidth={3} />
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Rodapé: só aparece quando a tela precisa de uma ação. */}
              <div className="shrink-0 px-5 pt-3" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
                {screen.kind === "ml-guide" ? (
                  mobileButton("Ver o catálogo agora", sairDoGuia)
                ) : screen.question.kind === "text" ? (
                  mobileButton("Continuar", confirmarNome, nome.trim().length > 0)
                ) : screen.question.optional ? (
                  <motion.button
                    variants={itemVariants}
                    type="button"
                    onClick={pular}
                    className="h-[52px] w-full rounded-full text-[16px] font-medium text-white/95 transition-colors active:bg-white/15"
                    style={{ boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.55)" }}
                  >
                    Pular esta pergunta
                  </motion.button>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  /* ── Desktop ───────────────────────────────────────────────────────────── */
  return (
    <motion.div
      className="fixed inset-0 z-[120] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Boas-vindas da Velo"
      data-velo-flat-buttons=""
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0.001 : ENTRADA_POS_ONBOARDING.modalExit, ease: "easeInOut" } }}
      transition={{ duration: reduce ? 0.001 : 0.5, ease: "easeOut" }}
      style={{ fontFamily: SANS, background: "#1E4FC4" }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <SkyBackdrop />
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{ backgroundImage: `url("${BACKGROUND_SRC}")`, opacity: backgroundLoaded ? 1 : 0 }}
        />
      </div>

      <motion.header
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 pt-6 sm:px-14 sm:pt-8"
        initial={reduce ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.001 : 0.8, delay: reduce ? 0 : 0.3, ease: EASE }}
      >
        <div className="flex items-center gap-2.5">
          <img src={VELO_LOGO_SRC} alt="" className="block h-[34px] w-[34px] object-contain" />
          <span
            className="text-[20px] font-semibold leading-none text-white"
            style={{ letterSpacing: "-0.03em", textShadow: "0 1px 2px rgba(0,0,0,0.12)" }}
          >
            Velo
          </span>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-full px-2 py-1 text-[14px] font-medium text-white/95 transition-opacity hover:opacity-75"
          style={{ textShadow: "0 1px 2px rgba(0,0,0,0.12)" }}
        >
          Sair
        </button>
      </motion.header>

      <div className="relative z-10 flex h-full w-full items-center justify-center px-4 py-20">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -12, transition: { duration: 0.45, ease: EASE } }}
          transition={{ duration: reduce ? 0.001 : 0.9, delay: reduce ? 0 : 0.15, ease: EASE }}
          className="relative flex max-h-full w-full max-w-[468px] flex-col overflow-hidden rounded-[26px]"
          style={{
            minHeight: "min(632px, 100%)",
            background:
              "linear-gradient(180deg, rgba(236,240,250,0.62) 0%, rgba(246,245,242,0.84) 45%, rgba(241,243,248,0.92) 100%)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            border: "1px solid rgba(255,255,255,0.55)",
            boxShadow: "0 30px 80px rgba(8,22,70,0.22), inset 0 1px 0 rgba(255,255,255,0.7)",
          }}
        >
          <AnimatePresence mode="wait" custom={direction}>
            {screen.kind === "welcome" ? (
              <motion.div
                key="welcome"
                custom={direction}
                variants={contentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-1 flex-col items-center justify-center px-10 py-14 text-center"
              >
                <motion.img
                  variants={illustrationVariants}
                  src={VELO_LOGO_SRC}
                  alt=""
                  style={{ filter: "drop-shadow(0 14px 18px rgba(11,95,255,0.22))" }}
                  className="mb-5 block h-[112px] w-[112px] object-contain"
                />
                <motion.h1
                  variants={itemVariants}
                  className="max-w-[320px] text-[31px] leading-[1.12]"
                  style={{ fontFamily: SERIF, color: INK, letterSpacing: "-0.01em", fontWeight: 400 }}
                >
                  Boas-vindas! Vamos deixar a Velo do seu jeito
                </motion.h1>
                <motion.p
                  variants={itemVariants}
                  className="mt-3 max-w-[290px] text-[14px] leading-[1.5]"
                  style={{ color: MUTED }}
                >
                  São 3 perguntas — menos de um minuto. Depois você já entra no catálogo de produtos.
                </motion.p>
                <motion.button
                  variants={itemVariants}
                  type="button"
                  onClick={handleStart}
                  whileTap={reduce ? undefined : { scale: 0.97 }}
                  className="mt-9 h-[50px] w-[168px] rounded-full bg-[#0B5FFF] text-[14px] font-medium text-white transition-colors duration-200 hover:bg-[#0A52DD]"
                >
                  Começar
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key={screen.kind === "ml-guide" ? "ml-guide" : `q-${index}`}
                custom={direction}
                variants={contentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-6 sm:px-8 sm:pb-8"
              >
                <div className="flex shrink-0 items-center justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    aria-label="Voltar"
                    className="grid h-9 w-9 place-items-center rounded-full text-[#3F3F46] transition-colors hover:bg-black/[0.05]"
                  >
                    <ArrowLeft size={18} strokeWidth={1.9} />
                  </button>
                  <div className="flex items-center gap-1.5" aria-label={`Pergunta ${passoAtual + 1} de ${QUESTIONS.length}`}>
                    {QUESTIONS.map((q, i) => (
                      <span
                        key={q.id}
                        className="h-[4px] rounded-full transition-all duration-300"
                        style={{
                          width: i === passoAtual ? 22 : 8,
                          background: i <= passoAtual ? ELECTRIC_BLUE : "rgba(17,17,17,0.14)",
                        }}
                      />
                    ))}
                  </div>
                  <span className="w-9 text-right text-[12px] tabular-nums" style={{ color: MUTED }}>
                    {passoAtual + 1}/{QUESTIONS.length}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 flex-col justify-center py-6">
                  {cabecalhoPergunta(false)}

                  {screen.kind === "ml-guide" ? (
                    listaGuiaML(false)
                  ) : screen.question.kind === "text" ? (
                    <motion.div variants={itemVariants} className="mt-7">
                      <input
                        ref={nomeInputRef}
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmarNome();
                        }}
                        placeholder={screen.question.placeholder}
                        autoComplete="given-name"
                        maxLength={24}
                        className="h-[56px] w-full rounded-[16px] bg-white px-5 text-[16px] outline-none focus:ring-2 focus:ring-[#0B5FFF]/30"
                        style={{ color: INK, border: "1.5px solid rgba(17,17,17,0.08)" }}
                      />
                    </motion.div>
                  ) : (
                    <div
                      role="radiogroup"
                      aria-label={screen.question.label}
                      className="-mx-1 mt-7 flex min-h-0 flex-col gap-2.5 overflow-y-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                      {screen.question.options.map((option) => {
                        const selected = answers[screen.question.id] === option.value;
                        const Icon = option.icon;
                        return (
                          <motion.button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            variants={itemVariants}
                            onClick={() => escolher(screen.question.id, option.value)}
                            whileTap={reduce ? undefined : { scale: 0.98 }}
                            className="flex min-h-[62px] items-center gap-3.5 rounded-[18px] px-4 py-3 text-left outline-none transition-[background-color,border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5FFF]/40 hover:bg-white"
                            style={
                              selected
                                ? {
                                    background: "#FFFFFF",
                                    border: `2px solid ${ELECTRIC_BLUE}`,
                                    boxShadow: "0 0 0 4px rgba(11,95,255,0.10)",
                                  }
                                : { background: "rgba(255,255,255,0.75)", border: "2px solid rgba(17,17,17,0.06)" }
                            }
                          >
                            <span
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-colors duration-200"
                              style={
                                selected
                                  ? { background: ELECTRIC_BLUE, color: "#FFFFFF" }
                                  : { background: "rgba(11,95,255,0.08)", color: ELECTRIC_BLUE }
                              }
                            >
                              <Icon size={19} strokeWidth={1.8} />
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-[15.5px] font-medium leading-tight" style={{ color: INK }}>
                                {option.label}
                              </span>
                              {option.description ? (
                                <span className="mt-0.5 text-[13px] leading-snug" style={{ color: MUTED }}>
                                  {option.description}
                                </span>
                              ) : null}
                            </span>
                            <span
                              className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full transition-all duration-200"
                              style={
                                selected
                                  ? { background: ELECTRIC_BLUE, color: "#FFFFFF" }
                                  : { boxShadow: "inset 0 0 0 2px rgba(17,17,17,0.16)", color: "transparent" }
                              }
                              aria-hidden="true"
                            >
                              <Check size={12} strokeWidth={3} />
                            </span>
                          </motion.button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {screen.kind === "ml-guide" ? (
                  <motion.button
                    variants={itemVariants}
                    type="button"
                    onClick={sairDoGuia}
                    className="h-[50px] w-full shrink-0 rounded-full bg-[#0B5FFF] text-[14px] font-medium text-white transition-colors duration-200 hover:bg-[#0A52DD]"
                  >
                    Ver o catálogo agora
                  </motion.button>
                ) : screen.question.kind === "text" ? (
                  <motion.button
                    variants={itemVariants}
                    type="button"
                    onClick={confirmarNome}
                    disabled={nome.trim().length === 0}
                    className={`h-[50px] w-full shrink-0 rounded-full text-[14px] font-medium transition-colors duration-200 ${
                      nome.trim().length > 0
                        ? "bg-[#0B5FFF] text-white hover:bg-[#0A52DD]"
                        : "cursor-not-allowed bg-black/[0.07] text-black/35"
                    }`}
                  >
                    Continuar
                  </motion.button>
                ) : screen.question.optional ? (
                  <motion.button
                    variants={itemVariants}
                    type="button"
                    onClick={pular}
                    className="h-[50px] w-full shrink-0 rounded-full text-[14px] font-medium transition-colors duration-200 hover:bg-black/[0.04]"
                    style={{ color: MUTED, border: "1.5px solid rgba(17,17,17,0.12)" }}
                  >
                    Pular esta pergunta
                  </motion.button>
                ) : null}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default OnboardingModal;
