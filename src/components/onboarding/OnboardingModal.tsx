import { useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Code2,
  Cpu,
  Eye,
  Facebook,
  FileX,
  Home,
  Instagram,
  LayoutGrid,
  LayoutPanelTop,
  HeartPulse,
  MonitorSmartphone,
  MoreHorizontal,
  Music2,
  Package,
  Palette,
  PanelsTopLeft,
  Rocket,
  ShoppingCart,
  Shirt,
  Sparkles,
  Store,
  Tag,
  Tags,
  Target,
  Users,
  Wrench,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { VeloMark } from "@/components/VeloLogo";
import { PRIMARY_BUTTON_STYLE } from "@/lib/buttonStyles";

// Novo onboarding da Velo em modal de 3 etapas (substitui o antigo fluxo de
// cadastro). Puramente frontend: as respostas ficam em estado local e NÃO são
// persistidas no Supabase nesta etapa (a persistência é um próximo passo,
// responsabilidade da ferramenta de backend do projeto).

type Option = {
  value: string;
  label: string;
  description?: string;
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

const STEPS: StepConfig[] = [
  {
    title: "Conte sobre você",
    subtitle: "Nos ajude a entender seu negócio para te atendermos melhor",
    questions: [
      {
        id: "mercadoLivre",
        label: "Você já tem uma conta ativa no Mercado Livre?",
        options: [
          { value: "sim", label: "Sim", icon: Check },
          { value: "nao", label: "Não", icon: X },
        ],
      },
      {
        id: "perfil",
        label: "O que melhor te descreve?",
        options: [
          { value: "dropshipper", label: "Sou dropshipper", icon: ShoppingCart },
          { value: "marca", label: "Tenho uma marca / loja própria", icon: Store },
          { value: "agencia", label: "Sou agência / freelancer", icon: Users },
          { value: "explorando", label: "Só estou explorando", icon: Eye },
        ],
      },
      {
        id: "produtos",
        label: "Quantos produtos você vende atualmente?",
        options: [
          { value: "nenhum", label: "Nenhum ainda, estou começando", icon: Rocket },
          { value: "1-10", label: "1–10 produtos", icon: Tag },
          { value: "10-50", label: "10–50 produtos", icon: Tags },
          { value: "50+", label: "50+ produtos", icon: Package },
        ],
      },
    ],
  },
  {
    title: "Qual seu maior desafio?",
    subtitle: "Vamos focar no que mais importa pra você",
    questions: [
      {
        id: "dificuldade",
        label: "Com o que você mais tem dificuldade?",
        options: [
          { value: "anuncios", label: "Criar anúncios que convertem", icon: LayoutPanelTop },
          { value: "testar", label: "Testar produtos rápido o suficiente", icon: Target },
          { value: "trafego", label: "Conseguir tráfego que converte", icon: MonitorSmartphone },
          { value: "profissional", label: "Deixar minha loja com cara profissional", icon: Palette },
        ],
      },
      {
        id: "metodoAtual",
        label: "Como você cria seus anúncios hoje?",
        options: [
          { value: "manual", label: "Manualmente no Mercado Livre", icon: Wrench },
          { value: "outra-ferramenta", label: "Usando outra ferramenta", icon: PanelsTopLeft },
          { value: "sem-anuncios", label: "Ainda não tenho anúncios", icon: FileX },
          { value: "desenvolvedor", label: "Uso um desenvolvedor", icon: Code2 },
        ],
      },
    ],
  },
  {
    title: "Vamos personalizar sua experiência",
    subtitle: "Quase lá — só mais algumas perguntas",
    questions: [
      {
        id: "nicho",
        label: "Qual o nicho da sua loja?",
        optional: true,
        options: [
          { value: "geral", label: "Geral / multi-nicho", icon: LayoutGrid },
          { value: "beleza", label: "Beleza & skincare", icon: Sparkles },
          { value: "moda", label: "Moda & vestuário", icon: Shirt },
          { value: "tech", label: "Tech & gadgets", icon: Cpu },
          { value: "casa", label: "Casa & cozinha", icon: Home },
          { value: "saude", label: "Saúde & fitness", icon: HeartPulse },
          { value: "outro", label: "Outro", icon: MoreHorizontal },
        ],
      },
      {
        id: "origem",
        label: "Onde você conheceu a Velo?",
        options: [
          { value: "facebook", label: "Facebook", icon: Facebook },
          { value: "instagram", label: "Instagram", icon: Instagram },
          { value: "tiktok", label: "TikTok", icon: Music2 },
          { value: "youtube", label: "YouTube", icon: Youtube },
          { value: "indicacao", label: "Indicação de alguém", icon: Users },
          { value: "outro", label: "Outro", icon: MoreHorizontal },
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

// ── Tema claro (modelo de referência): fundo cinza-claro, card branco central,
// cards de opção claros e o selecionado em preto sólido com texto branco. ──
const overlayStyle: CSSProperties = {
  background: "#F1F1F0",
};

const cardStyle: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow: "0 24px 70px rgba(0,0,0,0.12)",
};

// Cards de opção: claros com borda sutil; o selecionado vira preto sólido.
const optionCardStyle = (selected: boolean): CSSProperties =>
  selected
    ? {
        background: "#0A0A0A",
        border: "1px solid #0A0A0A",
      }
    : {
        background: "#FBFBFA",
        border: "1px solid #EAEAE8",
      };

const iconChipStyle = (selected: boolean): CSSProperties =>
  selected
    ? {
        background: "rgba(255,255,255,0.12)",
        border: "1px solid rgba(255,255,255,0.14)",
      }
    : {
        background: "#F3F3F1",
        border: "1px solid #EAEAE8",
      };

const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const reduce = useReducedMotion();

  const current = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  const select = (questionId: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }));

  // Só habilita avançar quando todas as perguntas obrigatórias da etapa atual
  // foram respondidas (perguntas marcadas como opcionais não bloqueiam).
  const canContinue = useMemo(
    () => current.questions.every((q) => q.optional || Boolean(answers[q.id])),
    [current, answers],
  );

  const handleNext = () => {
    if (!canContinue) return;
    if (isLastStep) {
      onComplete(answers);
      return;
    }
    setDirection(1);
    setStep((value) => value + 1);
  };

  const handleBack = () => {
    setDirection(-1);
    setStep((value) => Math.max(0, value - 1));
  };

  // Slide + fade direcional do conteúdo da etapa (respeitando reduced-motion),
  // com stagger dos grupos de pergunta ao entrar.
  const contentVariants: Variants = {
    initial: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir >= 0 ? 30 : -30 }),
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: reduce ? 0.001 : 0.32,
        ease: EASE,
        staggerChildren: reduce ? 0 : 0.055,
        delayChildren: reduce ? 0 : 0.04,
      },
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: reduce ? 0 : dir >= 0 ? -30 : 30,
      transition: { duration: reduce ? 0.001 : 0.22, ease: EASE },
    }),
  };

  const groupVariants: Variants = {
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: { opacity: 1, y: 0, transition: { duration: reduce ? 0.001 : 0.28, ease: EASE } },
  };

  return (
    <motion.div
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-6 font-['Inter',ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]"
      style={overlayStyle}
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding da Velo"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      // O fundo demora um pouco mais que o card pra sumir, então o card sobe e
      // desaparece "por cima" do overlay em vez dos dois piscarem juntos.
      exit={{ opacity: 0, transition: { duration: reduce ? 0.001 : 0.3, ease: EASE, delay: reduce ? 0 : 0.06 } }}
      transition={{ duration: reduce ? 0.001 : 0.2 }}
    >
      {/* Card central branco com todo o conteúdo (título, perguntas e rodapé). */}
      <motion.div
        className="my-auto w-full max-w-[520px] rounded-[20px] p-5 sm:p-6"
        style={cardStyle}
        initial={reduce ? false : { opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        // Sai subindo e encolhendo de leve — dá a sensação de "concluído" e
        // entrega a tela pro dashboard, em vez de sumir seco.
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.97, transition: { duration: 0.28, ease: EASE } }}
        transition={{ duration: reduce ? 0.001 : 0.32, ease: EASE }}
      >
        {/* Marca da Velo no topo do card, acima do progresso. */}
        <div className="mb-4 flex justify-center">
          <VeloMark size={32} tone="solid" />
        </div>

        {/* Barra de progresso segmentada (fina, clara). */}
        <div
          className="mb-5 flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step + 1}
        >
          {STEPS.map((_, index) => (
            <span key={index} className="h-[5px] flex-1 overflow-hidden rounded-full bg-[#EAEAE8]">
              <motion.span
                className="block h-full w-full rounded-full bg-[#0A0A0A]"
                style={{ originX: 0 }}
                initial={false}
                animate={{ scaleX: index <= step ? 1 : 0 }}
                transition={{ duration: reduce ? 0.001 : 0.4, ease: [0.16, 1, 0.3, 1] }}
              />
            </span>
          ))}
        </div>

        {/* Cabeçalho: título e subtítulo alinhados à esquerda. */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0.001 : 0.26, ease: EASE }}
          >
            <h1 className="text-[19px] font-bold tracking-[-0.02em] text-[#0A0A0A] sm:text-[20px]">
              {current.title}
            </h1>
            <p className="mt-1 text-[13px] leading-[18px] text-[#6B7280]">{current.subtitle}</p>
          </motion.div>
        </AnimatePresence>

        {/* Perguntas (slide/fade direcional por etapa). */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            className="mt-5 space-y-5"
            custom={direction}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {current.questions.map((question) => (
              <motion.fieldset key={question.id} variants={groupVariants}>
                <legend className="mb-2.5 text-[13px] font-semibold text-[#0A0A0A]">
                  {question.label}
                  {question.optional ? <span className="ml-2 text-[12.5px] font-normal text-[#9A9A96]">(opcional)</span> : null}
                </legend>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const selected = answers[question.id] === option.value;
                    const Icon = option.icon;
                    return (
                      <motion.button
                        key={option.value}
                        type="button"
                        onClick={() => select(question.id, option.value)}
                        aria-pressed={selected}
                        whileTap={reduce ? undefined : { scale: 0.985 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        style={optionCardStyle(selected)}
                        className={`flex min-h-[52px] items-center gap-2.5 rounded-[11px] p-2.5 text-left transition-[background-color,border-color,transform] duration-200 ${
                          selected ? "" : "hover:border-black/20"
                        }`}
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-[8px] ${selected ? "text-white" : "text-[#0A0A0A]"}`}
                          style={iconChipStyle(selected)}
                        >
                          <Icon size={16} strokeWidth={1.7} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-[13px] font-semibold leading-tight ${selected ? "text-white" : "text-[#0A0A0A]"}`}>
                            {option.label}
                          </span>
                          {option.description ? (
                            <span className={`mt-0.5 block text-[12.5px] leading-snug ${selected ? "text-white/60" : "text-[#8A8A86]"}`}>
                              {option.description}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[5px] border transition-colors duration-200 ${
                            selected ? "border-white bg-white" : "border-[#D0D0CE] bg-transparent"
                          }`}
                        >
                          {selected ? (
                            <motion.span
                              initial={reduce ? false : { scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 520, damping: 26 }}
                            >
                              <Check size={13} strokeWidth={3} className="text-[#0A0A0A]" />
                            </motion.span>
                          ) : null}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.fieldset>
            ))}
          </motion.div>
        </AnimatePresence>

        {/* Rodapé de navegação. */}
        <div className="mt-6 flex items-center justify-between">
          {step > 0 ? (
            <motion.button
              type="button"
              onClick={handleBack}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#6B7280] transition-colors hover:text-[#0A0A0A]"
            >
              <ArrowLeft size={16} strokeWidth={1.9} />
              Voltar
            </motion.button>
          ) : (
            <span />
          )}

          <motion.button
            type="button"
            onClick={handleNext}
            disabled={!canContinue}
            whileTap={reduce || !canContinue ? undefined : { scale: 0.97 }}
            style={PRIMARY_BUTTON_STYLE}
            className="inline-flex h-[42px] items-center gap-2 rounded-full px-5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLastStep ? "Concluir" : "Começar"}
            {isLastStep ? <Check size={16} strokeWidth={2.2} /> : <ArrowRight size={16} strokeWidth={2.2} />}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OnboardingModal;
