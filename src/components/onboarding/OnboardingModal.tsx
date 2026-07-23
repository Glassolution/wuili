import { useMemo, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Cpu,
  Eye,
  Facebook,
  FileX,
  HelpCircle,
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
import { VeloLogo, VeloMark } from "@/components/VeloLogo";

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

// ── Paleta do quiz (split-screen) — ISOLADA a esta tela ──────────────────────
// A referência é um layout claro com painel de marca sólido à esquerda. Usamos
// o azul de marca da Velo (CLAUDE.md §10) só aqui; o resto do app segue
// monocromático. Nada disto vaza para o design system global.
const BRAND_BLUE = "#2563EB"; // azul elétrico
const BRAND_BLUE_DARK = "#1E3A8A"; // azul escuro

// Painel esquerdo: gradiente diagonal do azul elétrico ao azul escuro, dando
// volume sem virar um chapado.
const brandPanelStyle: CSSProperties = {
  background: `linear-gradient(160deg, ${BRAND_BLUE} 0%, ${BRAND_BLUE_DARK} 100%)`,
};

// Botão primário: azul de marca sólido com brilho sutil no topo.
const primaryButtonStyle: CSSProperties = {
  background: `linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 16%), ${BRAND_BLUE}`,
  boxShadow: "0 6px 16px rgba(37,99,235,0.30), inset 0 1px 0 rgba(255,255,255,0.18)",
};

// Cards de opção (painel direito, fundo claro). Seleção = destaque de borda +
// fundo azul claro, SEM checkmark/radio.
const optionCardStyle = (selected: boolean): CSSProperties =>
  selected
    ? {
        background: "#EFF4FF",
        border: `1.5px solid ${BRAND_BLUE}`,
        boxShadow: "0 4px 14px rgba(37,99,235,0.14)",
      }
    : {
        background: "#FFFFFF",
        border: "1.5px solid #E5E7EB",
      };

// Container quadrado do ícone à esquerda do card.
const iconChipStyle = (selected: boolean): CSSProperties =>
  selected
    ? { background: BRAND_BLUE, color: "#FFFFFF" }
    : { background: "#EEF2FF", color: BRAND_BLUE };

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
      className="fixed inset-0 z-[120] flex overflow-hidden bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding da Velo"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduce ? 0.001 : 0.2 }}
    >
      {/* ── Painel esquerdo (marca) ──────────────────────────────────────────
          ~35% da largura no desktop; no mobile vira uma faixa compacta no topo
          (logo + headline reduzida), sem o rodapé decorativo. */}
      <aside
        className="relative hidden shrink-0 flex-col overflow-hidden p-8 text-white lg:flex lg:w-[35%] lg:max-w-[480px] lg:p-12"
        style={brandPanelStyle}
      >
        {/* Textura sutil de fundo para o azul não ficar chapado. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.18]"
          style={{
            background:
              "radial-gradient(120% 80% at 15% 0%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 55%)",
          }}
        />

        <div className="relative z-10">
          <VeloLogo size="md" variant="dark" />
        </div>

        <div className="relative z-10 mt-14 flex-1">
          <h1 className="text-[34px] font-bold leading-[1.1] tracking-[-0.02em] xl:text-[40px]">
            Vamos montar sua
            <br />
            operação de vendas.
          </h1>
          <p className="mt-4 max-w-[320px] text-[15px] leading-relaxed text-white/70">
            Algumas perguntas rápidas para a Velo se ajustar ao seu negócio — do
            catálogo aos anúncios.
          </p>

          {/* Stepper vertical reaproveitando os títulos das etapas. */}
          <ol className="mt-10 space-y-4">
            {STEPS.map((s, index) => {
              const active = index === step;
              const done = index < step;
              return (
                <li key={s.title} className="flex items-center gap-3">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px] font-semibold transition-colors duration-300 ${
                      active
                        ? "border-white bg-white text-[#1E3A8A]"
                        : done
                        ? "border-white/70 bg-white/20 text-white"
                        : "border-white/30 text-white/50"
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={2.4} /> : index + 1}
                  </span>
                  <span
                    className={`text-[14px] transition-colors duration-300 ${
                      active ? "font-semibold text-white" : "text-white/55"
                    }`}
                  >
                    {s.title}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Rodapé decorativo (área reservada para ilustração/gráfico). */}
        <div className="relative z-10 mt-8 flex items-end justify-start">
          <VeloMark size={112} tone="soft" className="opacity-90" />
        </div>
      </aside>

      {/* ── Painel direito (perguntas) ───────────────────────────────────────
          Fundo claro, ocupa o restante da largura. Rola verticalmente quando as
          opções passam da altura da tela. */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-white">
        {/* Cabeçalho do painel: logo (só no mobile, já que o painel de marca
            está oculto) + link de ajuda no canto superior direito. */}
        <div className="flex items-center justify-between px-6 pt-6 sm:px-10 lg:px-14">
          <div className="lg:hidden">
            <VeloLogo size="sm" variant="light" />
          </div>
          <span className="hidden lg:block" />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#64748B] transition-colors hover:text-[#2563EB] sm:text-[14px]"
          >
            <HelpCircle size={15} strokeWidth={1.8} />
            Precisando de ajuda?
          </button>
        </div>

        <div className="mx-auto w-full max-w-[560px] flex-1 px-6 py-8 sm:px-10 lg:px-4 lg:py-12">
          {/* Título + subtítulo da etapa. */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0.001 : 0.28, ease: EASE }}
            >
              <p className="text-[13px] font-medium text-[#2563EB]">
                Etapa {step + 1} de {STEPS.length}
              </p>
              <h2 className="mt-2 text-[26px] font-bold tracking-[-0.02em] text-[#0F172A] sm:text-[28px]">
                {current.title}
              </h2>
              <p className="mt-1.5 text-[14px] text-[#64748B] sm:text-[15px]">
                {current.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Perguntas (slide/fade direcional por etapa). */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              className="mt-8 space-y-8"
              custom={direction}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {current.questions.map((question) => (
                <motion.fieldset key={question.id} variants={groupVariants}>
                  <legend className="mb-3 text-[14px] font-semibold text-[#0F172A] sm:text-[15px]">
                    {question.label}
                    {question.optional ? (
                      <span className="ml-2 text-[13px] font-normal text-[#94A3B8]">(opcional)</span>
                    ) : null}
                  </legend>
                  {/* Cards horizontais empilhados: ícone quadrado à esquerda,
                      label, chevron à direita. */}
                  <div className="flex flex-col gap-2.5">
                    {question.options.map((option) => {
                      const selected = answers[question.id] === option.value;
                      const Icon = option.icon;
                      return (
                        <motion.button
                          key={option.value}
                          type="button"
                          onClick={() => select(question.id, option.value)}
                          aria-pressed={selected}
                          whileTap={reduce ? undefined : { scale: 0.99 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          style={optionCardStyle(selected)}
                          className={`group flex min-h-[60px] items-center gap-3.5 rounded-[12px] px-4 py-3 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 ${
                            selected ? "" : "hover:border-[#C7D2FE] hover:-translate-y-0.5"
                          }`}
                        >
                          <span
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-[9px] transition-colors duration-200"
                            style={iconChipStyle(selected)}
                          >
                            <Icon size={19} strokeWidth={1.6} />
                          </span>
                          <span className="flex-1 text-[14px] font-medium leading-tight text-[#0F172A] sm:text-[15px]">
                            {option.label}
                          </span>
                          <ChevronRight
                            size={18}
                            strokeWidth={2}
                            className={`shrink-0 transition-colors duration-200 ${
                              selected ? "text-[#2563EB]" : "text-[#CBD5E1] group-hover:text-[#94A3B8]"
                            }`}
                          />
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.fieldset>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Rodapé de navegação. */}
          <div className="mt-10 flex items-center justify-between">
            {step > 0 ? (
              <motion.button
                type="button"
                onClick={handleBack}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-[#64748B] transition-colors hover:text-[#0F172A]"
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
              className="inline-flex h-11 items-center gap-2 rounded-[10px] px-6 text-[15px] font-medium text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isLastStep ? "Concluir" : "Avançar"}
              {isLastStep ? <Check size={16} strokeWidth={2} /> : <ArrowRight size={16} strokeWidth={2} />}
            </motion.button>
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default OnboardingModal;
