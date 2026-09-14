import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  CircleDashed,
  Code2,
  Compass,
  Cpu,
  Facebook,
  FileX,
  HeartPulse,
  Home,
  Instagram,
  LayoutGrid,
  LayoutPanelTop,
  MoreHorizontal,
  Music2,
  Package,
  PanelsTopLeft,
  Rocket,
  ShieldCheck,
  Shirt,
  Sparkles,
  Store,
  Tag,
  Tags,
  Target,
  TrendingUp,
  Truck,
  Users,
  Wrench,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ENTRADA_POS_ONBOARDING } from "@/lib/dashboardIntro";
import { useIsMobile } from "@/hooks/use-mobile";

// Novo onboarding da Velo em modal de 3 etapas (substitui o antigo fluxo de
// cadastro). Puramente frontend: as respostas ficam em estado local e NÃO são
// persistidas no Supabase nesta etapa (a persistência é um próximo passo,
// responsabilidade da ferramenta de backend do projeto).

type Option = {
  value: string;
  label: string;
  /** Segunda linha do card: descrição leve/cinza que explica a opção. */
  description: string;
  icon: LucideIcon;
};

type Question = {
  id: string;
  label: string;
  optional?: boolean;
  options: Option[];
};

type StepConfig = {
  title: string;
  subtitle: string;
  questions: Question[];
};

// Os `id` e `value` abaixo são lidos por src/lib/perfilDoQuiz.ts para montar a
// vitrine de produtos recomendados — mude só textos e ícones sem revisar lá.
const STEPS: StepConfig[] = [
  {
    title: "Sobre você",
    subtitle: "Queremos entender de onde você está partindo",
    questions: [
      {
        id: "mercadoLivre",
        label: "Você já tem conta de vendedor no Mercado Livre?",
        options: [
          { value: "sim", label: "Sim, já tenho", description: "Mesmo que ainda não tenha vendido", icon: BadgeCheck },
          { value: "nao", label: "Ainda não", description: "Sem problema, te ajudamos a criar", icon: CircleDashed },
        ],
      },
      {
        id: "perfil",
        label: "Qual frase descreve melhor o seu momento?",
        options: [
          { value: "dropshipper", label: "Vendo sem estoque", description: "O fornecedor envia direto ao cliente", icon: Truck },
          { value: "marca", label: "Tenho marca ou loja", description: "Vendo produtos meus ou que eu compro", icon: Store },
          { value: "agencia", label: "Cuido de lojas de clientes", description: "Sou agência ou freelancer", icon: Users },
          { value: "explorando", label: "Estou conhecendo", description: "Quero entender antes de começar", icon: Compass },
        ],
      },
      {
        id: "produtos",
        label: "Quantos produtos você tem à venda hoje?",
        options: [
          { value: "nenhum", label: "Nenhum ainda", description: "O primeiro vai ser com a Velo", icon: Rocket },
          { value: "1-10", label: "De 1 a 10", description: "Estou dando os primeiros passos", icon: Tag },
          { value: "10-50", label: "De 11 a 50", description: "Minha operação está crescendo", icon: Tags },
          { value: "50+", label: "Mais de 50", description: "Já tenho uma operação consolidada", icon: Package },
        ],
      },
    ],
  },
  {
    title: "Seu desafio",
    subtitle: "Não existe resposta certa — conte o que mais pesa hoje",
    questions: [
      {
        id: "dificuldade",
        label: "O que mais te impede de vender mais hoje?",
        options: [
          { value: "anuncios", label: "Anúncios que convencem", description: "Título, fotos e descrição", icon: LayoutPanelTop },
          { value: "testar", label: "Achar o produto certo", description: "Demoro a saber o que vende", icon: Target },
          { value: "trafego", label: "Ser encontrado", description: "Meus anúncios têm poucas visitas", icon: TrendingUp },
          { value: "profissional", label: "Passar confiança", description: "Quero parecer mais profissional", icon: ShieldCheck },
        ],
      },
      {
        id: "metodoAtual",
        label: "Como você cria seus anúncios hoje?",
        options: [
          { value: "manual", label: "Faço tudo à mão", description: "Um por um, no Mercado Livre", icon: Wrench },
          { value: "outra-ferramenta", label: "Uso outra ferramenta", description: "Um app ou plataforma me ajuda", icon: PanelsTopLeft },
          { value: "sem-anuncios", label: "Ainda não criei", description: "O primeiro vai ser com a Velo", icon: FileX },
          { value: "desenvolvedor", label: "Alguém faz por mim", description: "Um desenvolvedor ou minha equipe", icon: Code2 },
        ],
      },
    ],
  },
  {
    title: "Sua loja",
    subtitle: "Com isso, a Velo já separa produtos com a sua cara",
    questions: [
      {
        id: "nicho",
        label: "Que tipo de produto você quer vender?",
        optional: true,
        options: [
          { value: "beleza", label: "Beleza e skincare", description: "", icon: Sparkles },
          { value: "moda", label: "Moda e acessórios", description: "", icon: Shirt },
          { value: "tech", label: "Tech e gadgets", description: "", icon: Cpu },
          { value: "casa", label: "Casa e cozinha", description: "", icon: Home },
          { value: "saude", label: "Saúde e fitness", description: "", icon: HeartPulse },
          { value: "geral", label: "Um pouco de tudo", description: "", icon: LayoutGrid },
          { value: "outro", label: "Outro nicho", description: "", icon: MoreHorizontal },
        ],
      },
      {
        id: "origem",
        label: "Como você conheceu a Velo?",
        optional: true,
        options: [
          { value: "instagram", label: "Instagram", description: "", icon: Instagram },
          { value: "tiktok", label: "TikTok", description: "", icon: Music2 },
          { value: "youtube", label: "YouTube", description: "", icon: Youtube },
          { value: "facebook", label: "Facebook", description: "", icon: Facebook },
          { value: "indicacao", label: "Indicação", description: "", icon: Users },
          { value: "outro", label: "Outro lugar", description: "", icon: MoreHorizontal },
        ],
      },
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
const MUTED = "#6B6B6B";
const SERIF = '"Instrument Serif", "Iowan Old Style", "Times New Roman", serif';
const SANS = '"Inter", system-ui, -apple-system, sans-serif';

/*
  Ilustração de fundo em tela cheia (paisagem, como na referência). Basta
  colocar a arte neste caminho em public/. Enquanto o arquivo não existir, a
  tela usa o céu azul desenhado em CSS abaixo — a imagem só é aplicada depois
  de carregar, então nunca aparece quebrada.
*/
const BACKGROUND_SRC = "/assets/onboarding-fundo.jpg";

// Logo oficial da Velo (a mesma da sidebar): cesta azul com o "C". Aparece no
// cabeçalho e, maior, como ilustração do card de boas-vindas.
const VELO_LOGO_SRC = "/logo.png";

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
          // Só gradiente, sem `filter: blur`: o degradê já nasce macio, e o blur
          // obrigava a GPU a redesenhar nuvens enormes a cada quadro (em tela
          // retina a animação caía para poucos quadros por segundo).
          background:
            "radial-gradient(closest-side, #FFF6E6 0%, rgba(255,246,230,0.62) 40%, rgba(255,246,230,0.22) 72%, rgba(255,246,230,0) 100%)",
        }}
      />
    ))}
  </div>
);

// ── Fluxo linear: uma pergunta por tela ──────────────────────────────────────
// As 3 macro-etapas continuam sendo o agrupamento visual/lógico, mas a navegação
// interna é por pergunta individual. Cada pergunta guarda o índice da etapa.
type FlatQuestion = Question & { stepIndex: number };
const FLAT_QUESTIONS: FlatQuestion[] = STEPS.flatMap((s, stepIndex) =>
  s.questions.map((q) => ({ ...q, stepIndex })),
);

const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  // Tela de boas-vindas antes da primeira pergunta.
  const [started, setStarted] = useState(false);
  // Navegação por PERGUNTA. `index` aponta para a pergunta atual no fluxo
  // linear; a macro-etapa é derivada dela.
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const reduce = useReducedMotion();
  // O hook só acorda depois do primeiro render; a leitura direta evita um
  // quadro do layout de desktop piscando no celular.
  const isMobileHook = useIsMobile();
  const isMobile = isMobileHook || (typeof window !== "undefined" && window.innerWidth < 768);
  const backgroundLoaded = useBackgroundImage(BACKGROUND_SRC);
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const question = FLAT_QUESTIONS[index];
  const currentStepIndex = question.stepIndex;
  const currentStep = STEPS[currentStepIndex];
  const isLastQuestion = index === FLAT_QUESTIONS.length - 1;
  const selectedValue = answers[question.id];
  const canContinue = Boolean(selectedValue) || Boolean(question.optional);
  const continueLabel = !selectedValue && question.optional ? "Pular" : isLastQuestion ? "Concluir" : "Continuar";
  // Perguntas com muitas opções usam cards compactos (só ícone + rótulo).
  const compact = question.options.length > 4;

  // Selecionar só marca a opção; quem avança é o botão "Continuar".
  const select = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleContinue = () => {
    if (!canContinue) return;
    if (isLastQuestion) {
      onComplete(answers);
      return;
    }
    setDirection(1);
    setIndex((value) => value + 1);
  };

  // Voltar por pergunta; na primeira, volta para as boas-vindas.
  const handleBack = () => {
    setDirection(-1);
    if (index === 0) {
      setStarted(false);
      return;
    }
    setIndex((value) => Math.max(0, value - 1));
  };

  const handleStart = () => {
    setDirection(1);
    setStarted(true);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  // Na primeira abertura o conteúdo do card espera o card assentar antes de
  // entrar; nas trocas de pergunta a sequência começa quase imediatamente.
  const isFirstEntrance = useRef(true);
  useEffect(() => {
    isFirstEntrance.current = false;
  }, []);

  // Slide + fade direcional do conteúdo (respeitando reduced-motion).
  const contentVariants: Variants = {
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
  };

  // Cada elemento sobe alguns pixels enquanto aparece. Só opacidade e
  // transform — propriedades que a GPU compõe sem redesenhar. O desfoque de
  // entrada (`filter: blur`) foi tirado: redesenhava cada texto e card a cada
  // quadro, por cima do vidro, e derrubava a fluidez.
  const itemVariants: Variants = {
    initial: { opacity: 0, y: reduce ? 0 : 14 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce ? 0.001 : 0.7, ease: EASE },
    },
  };

  // A ilustração ganha também um leve crescimento, para ser o primeiro foco.
  const illustrationVariants: Variants = {
    initial: { opacity: 0, y: reduce ? 0 : 16, scale: reduce ? 1 : 0.9 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: reduce ? 0.001 : 0.9, ease: EASE },
    },
  };

  // ── Celular: tela cheia e botão fixo embaixo ─────────────────────────────────
  // Sem o card de vidro: no celular a moldura ocupava espaço demais e espremia as
  // opções. O céu da Velo vira o fundo da tela inteira, o conteúdo fica
  // centralizado e a ação principal presa no rodapé, ao alcance do polegar.
  // O céu é azul da metade para cima e clareia embaixo: por isso título e marca
  // são brancos, o texto do rodapé é escuro e as opções são cards de vidro claro.
  if (isMobile) {
    const mobileButton = (label: string, onClick: () => void, enabled = true) => (
      <motion.button
        variants={itemVariants}
        type="button"
        onClick={onClick}
        disabled={!enabled}
        whileTap={reduce || !enabled ? undefined : { scale: 0.98 }}
        className={`h-[56px] w-full rounded-full text-[17px] font-medium transition-colors duration-200 ${
          enabled ? "bg-[#0B5FFF] text-white active:bg-[#0A52DD]" : "bg-white/60 text-[#111111]/35"
        }`}
        style={
          enabled
            ? { boxShadow: "0 10px 24px rgba(11,95,255,0.22)" }
            : undefined
        }
      >
        {label}
      </motion.button>
    );

    return (
      <motion.div
        className="fixed inset-0 z-[120] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label="Onboarding da Velo"
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
          {/* Véu azul na metade de cima: na tela estreita as nuvens caem atrás do
              título e do subtítulo brancos e roubavam o contraste. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(14,42,138,0.42) 0%, rgba(20,60,170,0.34) 45%, rgba(30,79,196,0.12) 68%, rgba(30,79,196,0) 80%)",
            }}
          />
        </div>

        <AnimatePresence mode="wait" custom={direction}>
          {!started ? (
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
                  className="px-1 py-2 text-[14px] font-medium text-white/90 transition-opacity active:opacity-60"
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
                className="mx-auto mb-5 max-w-[300px] text-center text-[15px] leading-[1.45]"
                style={{ color: "#52525B" }}
              >
                Responda <span style={{ color: INK, fontWeight: 500 }}>{FLAT_QUESTIONS.length} perguntas rápidas</span> para a Velo
                se ajustar ao seu negócio
              </motion.p>
              {mobileButton("Começar", handleStart)}
            </motion.div>
          ) : (
            <motion.div
              key={`q-${index}`}
              custom={direction}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="relative z-10 flex min-h-0 flex-1 flex-col"
            >
              {/* Topo: voltar + progresso. */}
              <div
                className="flex h-14 shrink-0 items-center justify-between px-3"
                style={{ marginTop: "env(safe-area-inset-top)" }}
              >
                <button
                  type="button"
                  onClick={handleBack}
                  aria-label="Voltar"
                  className="grid h-10 w-10 place-items-center rounded-full text-white transition-colors active:bg-white/15"
                >
                  <ArrowLeft size={20} strokeWidth={1.9} />
                </button>
                <div className="flex items-center gap-1.5" aria-label={`Pergunta ${index + 1} de ${FLAT_QUESTIONS.length}`}>
                  {FLAT_QUESTIONS.map((q, i) => (
                    <span
                      key={q.id}
                      className="h-[4px] rounded-full transition-all duration-300"
                      style={{
                        width: i === index ? 20 : 6,
                        background: i <= index ? "#FFFFFF" : "rgba(255,255,255,0.32)",
                      }}
                    />
                  ))}
                </div>
                <span className="w-10" />
              </div>

              {/* Conteúdo: centralizado quando cabe, rola sem barra quando não. */}
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <div className="my-auto py-6">
                  <motion.div variants={itemVariants} className="text-center">
                    <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-white/70">
                      {currentStep.title}
                    </p>
                    <h2
                      className="mx-auto mt-3 max-w-[320px] text-[27px] font-semibold leading-[1.15] text-white"
                      style={{ letterSpacing: "-0.03em", textShadow: "0 2px 16px rgba(8,22,70,0.22)" }}
                    >
                      {question.label}
                    </h2>
                    <p className="mx-auto mt-2.5 max-w-[300px] text-[15px] leading-snug text-white/85" style={{ textShadow: "0 1px 10px rgba(8,22,70,0.3)" }}>
                      {question.optional ? "Opcional · " : ""}
                      {currentStep.subtitle}
                    </p>
                  </motion.div>

                  <div role="radiogroup" aria-label={question.label} className={`mt-8 flex flex-col ${compact ? "gap-2" : "gap-2.5"}`}>
                    {question.options.map((option) => {
                      const selected = selectedValue === option.value;
                      const Icon = option.icon;
                      return (
                        <motion.button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          variants={itemVariants}
                          onClick={() => select(question.id, option.value)}
                          whileTap={reduce ? undefined : { scale: 0.985 }}
                          className={`flex w-full items-center gap-3.5 rounded-[20px] px-4 text-left transition-[background-color,box-shadow] duration-200 ${
                            compact ? "min-h-[54px] py-2" : "min-h-[72px] py-3"
                          }`}
                          style={{
                            // Branco quase opaco em vez de vidro: sete cards com
                            // backdrop-filter entrando em cascata pesavam no celular.
                            background: selected ? "#FFFFFF" : "rgba(255,255,255,0.82)",
                            boxShadow: selected
                              ? `inset 0 0 0 2px ${ELECTRIC_BLUE}, 0 10px 26px rgba(8,22,70,0.18)`
                              : "0 6px 18px rgba(8,22,70,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)",
                          }}
                        >
                          <span
                            className={`grid shrink-0 place-items-center rounded-full transition-colors duration-200 ${
                              compact ? "h-9 w-9" : "h-10 w-10"
                            }`}
                            style={
                              selected
                                ? { background: ELECTRIC_BLUE, color: "#FFFFFF" }
                                : { background: "rgba(17,17,17,0.05)", color: "#27272A" }
                            }
                          >
                            <Icon size={18} strokeWidth={1.8} />
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="text-[16px] font-medium leading-tight" style={{ color: INK }}>
                              {option.label}
                            </span>
                            {option.description && !compact ? (
                              <span className="mt-0.5 text-[13.5px] leading-snug" style={{ color: MUTED }}>
                                {option.description}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-all duration-200"
                            style={
                              selected
                                ? { background: ELECTRIC_BLUE, color: "#FFFFFF" }
                                : { boxShadow: "inset 0 0 0 1.5px rgba(17,17,17,0.18)", color: "transparent" }
                            }
                            aria-hidden="true"
                          >
                            <Check size={13} strokeWidth={3} />
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div
                className="shrink-0 px-5 pt-3"
                style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
              >
                {mobileButton(continueLabel, handleContinue, canContinue)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="fixed inset-0 z-[120] overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding da Velo"
      // Botões chapados: desliga o relevo global (brilho no topo + sombra) do index.css.
      data-velo-flat-buttons=""
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      // Saída: desbota revelando o dashboard, que começa a entrar por baixo.
      exit={{ opacity: 0, transition: { duration: reduce ? 0.001 : ENTRADA_POS_ONBOARDING.modalExit, ease: "easeInOut" } }}
      transition={{ duration: reduce ? 0.001 : 0.5, ease: "easeOut" }}
      style={{ fontFamily: SANS, background: "#1E4FC4" }}
    >
      {/* ── Fundo em tela cheia ───────────────────────────────────────────────
          Parado de propósito: o card de vidro desfoca o que está atrás dele, e
          um fundo em movimento obrigava esse desfoque a ser refeito a cada
          quadro — era o que travava a animação. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <SkyBackdrop />
        <div
          className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
          style={{
            backgroundImage: `url("${BACKGROUND_SRC}")`,
            opacity: backgroundLoaded ? 1 : 0,
          }}
        />
      </div>

      {/* ── Cabeçalho: marca à esquerda, "Sair" à direita ───────────────────── */}
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

      {/* ── Card de vidro centralizado ──────────────────────────────────────── */}
      <div className="relative z-10 flex h-full w-full items-center justify-center px-4 py-20">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -12, transition: { duration: 0.45, ease: EASE } }}
          transition={{ duration: reduce ? 0.001 : 0.9, delay: reduce ? 0 : 0.15, ease: EASE }}
          // Largura única nas boas-vindas e nas perguntas: animar a largura de
          // um card com vidro refazia o desfoque a cada quadro.
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
            {!started ? (
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
                  className="max-w-[300px] text-[31px] leading-[1.12]"
                  style={{ fontFamily: SERIF, color: INK, letterSpacing: "-0.01em", fontWeight: 400 }}
                >
                  Boas-vindas! Vamos começar configurando sua conta
                </motion.h1>
                <motion.p
                  variants={itemVariants}
                  className="mt-3 max-w-[272px] text-[13.5px] leading-[1.45]"
                  style={{ color: MUTED }}
                >
                  Responda algumas perguntas rápidas para a Velo se ajustar ao seu negócio e publicar seu primeiro anúncio
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
                key={`q-${index}`}
                custom={direction}
                variants={contentVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex min-h-0 flex-1 flex-col px-6 pb-6 pt-6 sm:px-8 sm:pb-8"
              >
                {/* Topo: voltar + progresso por macro-etapa. */}
                <div className="flex shrink-0 items-center justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    aria-label="Voltar"
                    className="grid h-8 w-8 place-items-center rounded-full text-[#3F3F46] transition-colors hover:bg-black/[0.05]"
                  >
                    <ArrowLeft size={17} strokeWidth={1.8} />
                  </button>
                  <div className="flex items-center gap-1.5" aria-label={`Etapa ${currentStepIndex + 1} de ${STEPS.length}`}>
                    {STEPS.map((s, stepIdx) => (
                      <span
                        key={s.title}
                        className="h-[4px] rounded-full transition-all duration-300"
                        style={{
                          width: stepIdx === currentStepIndex ? 22 : 8,
                          background: stepIdx <= currentStepIndex ? ELECTRIC_BLUE : "rgba(17,17,17,0.14)",
                        }}
                      />
                    ))}
                  </div>
                  <span className="w-8 text-right text-[12px] tabular-nums" style={{ color: MUTED }}>
                    {index + 1}/{FLAT_QUESTIONS.length}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 flex-col justify-center py-6">
                  <motion.div variants={itemVariants} className="shrink-0 text-center">
                    <p className="text-[12px] font-medium uppercase tracking-[0.08em]" style={{ color: MUTED }}>
                      {currentStep.title}
                    </p>
                    <h2
                      className="mx-auto mt-2 max-w-[360px] text-[26px] leading-[1.15]"
                      style={{ fontFamily: SERIF, color: INK, fontWeight: 400 }}
                    >
                      {question.label}
                    </h2>
                    <p className="mx-auto mt-2 max-w-[340px] text-[13px] leading-snug" style={{ color: MUTED }}>
                      {question.optional ? "Opcional · " : ""}
                      {currentStep.subtitle}
                    </p>
                  </motion.div>

                  {/* Opções em grade de 2 colunas, conteúdo centralizado. A
                      seleção só marca o card; o avanço é no "Continuar". */}
                  <div
                    role="radiogroup"
                    aria-label={question.label}
                    // Rolagem só como rede de segurança em telas muito baixas, sem
                    // barra visível: na entrada os cards nascem deslocados/desfocados
                    // e estouravam a área por um instante, piscando a barra.
                    className="-mx-1 mt-7 grid min-h-0 grid-cols-2 gap-2.5 overflow-y-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {question.options.map((option, optionIndex) => {
                      const selected = selectedValue === option.value;
                      const Icon = option.icon;
                      // Quantidade ímpar: o último card ocupa a linha inteira.
                      const spanFull = optionIndex === question.options.length - 1 && question.options.length % 2 === 1;
                      return (
                        <motion.button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          variants={itemVariants}
                          onClick={() => select(question.id, option.value)}
                          whileTap={reduce ? undefined : { scale: 0.98 }}
                          className={`relative flex flex-col items-center justify-center rounded-[18px] text-center outline-none transition-[background-color,border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-[#0B5FFF]/40 ${
                            compact ? "min-h-[88px] gap-2 px-3 py-3" : "min-h-[128px] gap-2.5 px-4 py-4"
                          } ${spanFull ? "col-span-2" : ""} ${selected ? "" : "hover:bg-white/90"}`}
                          style={
                            selected
                              ? {
                                  background: "#FFFFFF",
                                  border: `1.5px solid ${ELECTRIC_BLUE}`,
                                  boxShadow: "0 0 0 4px rgba(11,95,255,0.10)",
                                }
                              : {
                                  background: "rgba(255,255,255,0.6)",
                                  border: "1.5px solid rgba(17,17,17,0.06)",
                                }
                          }
                        >
                          {/* Marca de seleção no canto. */}
                          <span
                            className="absolute right-2.5 top-2.5 grid h-[18px] w-[18px] place-items-center rounded-full transition-all duration-200"
                            style={
                              selected
                                ? { background: ELECTRIC_BLUE, color: "#FFFFFF", transform: "scale(1)", opacity: 1 }
                                : { background: ELECTRIC_BLUE, color: "#FFFFFF", transform: "scale(0.6)", opacity: 0 }
                            }
                            aria-hidden="true"
                          >
                            <Check size={11} strokeWidth={3} />
                          </span>
                          <span
                            className={`grid shrink-0 place-items-center rounded-full transition-colors duration-200 ${
                              compact ? "h-9 w-9" : "h-11 w-11"
                            }`}
                            style={
                              selected
                                ? { background: ELECTRIC_BLUE, color: "#FFFFFF" }
                                : { background: "rgba(17,17,17,0.05)", color: "#27272A" }
                            }
                          >
                            <Icon size={compact ? 17 : 20} strokeWidth={1.8} />
                          </span>
                          <span className="flex flex-col items-center">
                            <span className="text-[13.5px] font-medium leading-tight" style={{ color: INK }}>
                              {option.label}
                            </span>
                            {option.description && !compact ? (
                              <span className="mt-1 text-[12px] leading-snug" style={{ color: MUTED }}>
                                {option.description}
                              </span>
                            ) : null}
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                <motion.button
                  variants={itemVariants}
                  type="button"
                  onClick={handleContinue}
                  disabled={!canContinue}
                  whileTap={reduce || !canContinue ? undefined : { scale: 0.98 }}
                  className={`h-[50px] w-full shrink-0 rounded-full text-[14px] font-medium transition-colors duration-200 ${
                    canContinue
                      ? "bg-[#0B5FFF] text-white hover:bg-[#0A52DD]"
                      : "cursor-not-allowed bg-black/[0.07] text-black/35"
                  }`}
                >
                  {continueLabel}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default OnboardingModal;
