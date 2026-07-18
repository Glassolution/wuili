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
import { VeloLogo } from "@/components/VeloLogo";

// Novo onboarding da Velo em modal de 3 etapas (substitui o antigo fluxo de
// cadastro). Puramente frontend: as respostas ficam em estado local e NÃO são
// persistidas no Supabase nesta etapa (a persistência é um próximo passo,
// responsabilidade da ferramenta de backend do projeto).

type Option = {
  value: string;
  label: string;
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

export const hasSeenOnboarding = (userId: string): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(onboardingDoneKey(userId)) === "1";
};

export const markOnboardingSeen = (userId: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(onboardingDoneKey(userId), "1");
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

type OnboardingModalProps = {
  /** Chamado quando o usuário conclui a última etapa. */
  onComplete: (answers: Answers) => void;
};

// Easing "ease-out expo" — sensação suave/premium usada nas transições de etapa.
const EASE = [0.22, 1, 0.36, 1] as const;

// Estilo do botão primário "glossy" (token de design exato): fundo #1D1F23 com
// brilho branco sutil no topo, stroke branco só no topo, sombra dupla e
// text-shadow no rótulo.
const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 15%), #1D1F23",
  borderTop: "1.5px solid rgba(255,255,255,0.15)",
  boxShadow: "0px 4px 7px rgba(0,0,0,0.2), 0px 0px 0px 1.5px #000000",
  textShadow: "0px 4px 4px rgba(0,0,0,0.4)",
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
      className="fixed inset-0 z-[120] flex flex-col items-center overflow-y-auto bg-[#F4F4F5] px-4 py-8 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding da Velo"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0.001 : 0.2 }}
    >
      {/* Cabeçalho da página: marca + título + subtítulo, centralizados. */}
      <div className="flex flex-col items-center text-center">
        <VeloLogo size="md" variant="dark" />
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reduce ? 0.001 : 0.28, ease: EASE }}
          >
            <h1 className="mt-5 text-[22px] font-bold tracking-[-0.02em] text-[#0A0A0A] sm:text-[24px]">
              {current.title}
            </h1>
            <p className="mt-1.5 max-w-[460px] text-[13px] text-[#6B7280] sm:text-[14px]">{current.subtitle}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Card central com as perguntas da etapa. */}
      <motion.div
        className="mt-5 w-full max-w-[680px] rounded-[20px] bg-white p-5 shadow-[0_24px_60px_rgba(10,10,10,0.10)] sm:p-7"
        initial={reduce ? false : { opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: reduce ? 0.001 : 0.34, ease: EASE }}
      >
        {/* Passo + barra de progresso segmentada em 3 partes (fill animado). */}
        <p className="text-[13px] font-medium text-[#6B7280]">Etapa {step + 1} de {STEPS.length}</p>
        <div className="mt-2 flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          {STEPS.map((_, index) => (
            <span key={index} className="h-[6px] flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
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

        {/* Perguntas (slide/fade direcional por etapa). */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            className="mt-6 space-y-6"
            custom={direction}
            variants={contentVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            {current.questions.map((question) => (
              <motion.fieldset key={question.id} variants={groupVariants}>
                <legend className="mb-2.5 text-[14px] font-semibold text-[#111827] sm:text-[15px]">
                  {question.label}
                  {question.optional ? <span className="ml-2 text-[12px] font-normal text-[#9CA3AF]">(opcional)</span> : null}
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
                        whileTap={reduce ? undefined : { scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        className={`flex min-h-[52px] items-center gap-2.5 rounded-[10px] p-3 text-left transition-[color,background-color,border-color,box-shadow,transform] duration-200 ${
                          selected
                            ? "border-[1.5px] border-[#0A0A0A] bg-[#FAFAFA]"
                            : "border border-[#E5E7EB] bg-white hover:-translate-y-0.5 hover:border-[#D1D5DB] hover:shadow-[0_6px_16px_-6px_rgba(10,10,10,0.12)]"
                        }`}
                      >
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[7px] bg-[#F3F4F6] text-[#111827]">
                          <Icon size={16} strokeWidth={1.5} />
                        </span>
                        <span className="flex-1 text-[13px] font-medium leading-tight text-[#111827] sm:text-[14px]">
                          {option.label}
                        </span>
                        <span
                          className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition-colors duration-200 ${
                            selected ? "border-[#0A0A0A]" : "border-[#D1D5DB]"
                          }`}
                        >
                          {selected ? (
                            <motion.span
                              className="h-2 w-2 rounded-full bg-[#0A0A0A]"
                              initial={reduce ? false : { scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 520, damping: 26 }}
                            />
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
        <div className="mt-7 flex items-center justify-between">
          {step > 0 ? (
            <motion.button
              type="button"
              onClick={handleBack}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className="inline-flex items-center gap-2 text-[14px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              Voltar
            </motion.button>
          ) : (
            <span />
          )}

          <motion.button
            type="button"
            onClick={handleNext}
            disabled={!canContinue}
            style={primaryButtonStyle}
            whileTap={reduce || !canContinue ? undefined : { scale: 0.97 }}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[14px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLastStep ? "Concluir" : "Avançar"}
            {isLastStep ? <Check size={16} strokeWidth={2} /> : <ArrowRight size={16} strokeWidth={2} />}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default OnboardingModal;
