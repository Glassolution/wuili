import { useEffect, useRef, useState, type CSSProperties } from "react";
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

const STEPS: StepConfig[] = [
  {
    title: "Conte sobre você",
    subtitle: "Nos ajude a entender seu negócio para te atendermos melhor",
    questions: [
      {
        id: "mercadoLivre",
        label: "Você já tem uma conta ativa no Mercado Livre?",
        options: [
          { value: "sim", label: "Sim", description: "Já vendo ou já criei minha conta", icon: Check },
          { value: "nao", label: "Não", description: "Ainda não tenho conta no Mercado Livre", icon: X },
        ],
      },
      {
        id: "perfil",
        label: "O que melhor te descreve?",
        options: [
          { value: "dropshipper", label: "Sou dropshipper", description: "Vendo produtos sem estoque próprio", icon: ShoppingCart },
          { value: "marca", label: "Tenho uma marca / loja própria", description: "Vendo meus próprios produtos", icon: Store },
          { value: "agencia", label: "Sou agência / freelancer", description: "Gerencio lojas para outras pessoas", icon: Users },
          { value: "explorando", label: "Só estou explorando", description: "Quero conhecer a plataforma antes de decidir", icon: Eye },
        ],
      },
      {
        id: "produtos",
        label: "Quantos produtos você vende atualmente?",
        options: [
          { value: "nenhum", label: "Nenhum ainda, estou começando", description: "Vou publicar meus primeiros produtos", icon: Rocket },
          { value: "1-10", label: "1–10 produtos", description: "Operação pequena, começando a crescer", icon: Tag },
          { value: "10-50", label: "10–50 produtos", description: "Operação em expansão", icon: Tags },
          { value: "50+", label: "50+ produtos", description: "Operação consolidada, alto volume", icon: Package },
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
          { value: "anuncios", label: "Criar anúncios que convertem", description: "Escrever títulos e descrições que vendem", icon: LayoutPanelTop },
          { value: "testar", label: "Testar produtos rápido o suficiente", description: "Validar produtos com agilidade", icon: Target },
          { value: "trafego", label: "Conseguir tráfego que converte", description: "Atrair visitantes prontos para comprar", icon: MonitorSmartphone },
          { value: "profissional", label: "Deixar minha loja com cara profissional", description: "Passar credibilidade para o cliente", icon: Palette },
        ],
      },
      {
        id: "metodoAtual",
        label: "Como você cria seus anúncios hoje?",
        options: [
          { value: "manual", label: "Manualmente no Mercado Livre", description: "Crio tudo à mão, um por um", icon: Wrench },
          { value: "outra-ferramenta", label: "Usando outra ferramenta", description: "Já uso algum app ou plataforma", icon: PanelsTopLeft },
          { value: "sem-anuncios", label: "Ainda não tenho anúncios", description: "Estou começando do zero", icon: FileX },
          { value: "desenvolvedor", label: "Uso um desenvolvedor", description: "Alguém técnico cuida disso pra mim", icon: Code2 },
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
          { value: "geral", label: "Geral / multi-nicho", description: "Um pouco de cada categoria", icon: LayoutGrid },
          { value: "beleza", label: "Beleza & skincare", description: "Cosméticos, skincare e cuidados", icon: Sparkles },
          { value: "moda", label: "Moda & vestuário", description: "Roupas, calçados e acessórios", icon: Shirt },
          { value: "tech", label: "Tech & gadgets", description: "Eletrônicos e novidades", icon: Cpu },
          { value: "casa", label: "Casa & cozinha", description: "Utilidades e decoração", icon: Home },
          { value: "saude", label: "Saúde & fitness", description: "Suplementos e bem-estar", icon: HeartPulse },
          { value: "outro", label: "Outro", description: "Meu nicho não está na lista", icon: MoreHorizontal },
        ],
      },
      {
        id: "origem",
        label: "Onde você conheceu a Velo?",
        options: [
          { value: "facebook", label: "Facebook", description: "Anúncio ou página no Facebook", icon: Facebook },
          { value: "instagram", label: "Instagram", description: "Post, reels ou anúncio no Instagram", icon: Instagram },
          { value: "tiktok", label: "TikTok", description: "Vídeo ou anúncio no TikTok", icon: Music2 },
          { value: "youtube", label: "YouTube", description: "Vídeo ou anúncio no YouTube", icon: Youtube },
          { value: "indicacao", label: "Indicação de alguém", description: "Alguém me recomendou a Velo", icon: Users },
          { value: "outro", label: "Outro", description: "Cheguei por outro caminho", icon: MoreHorizontal },
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
const ELECTRIC_BLUE = "#005EFE";

// Painel esquerdo: cor sólida pedida para o onboarding.
const brandPanelStyle: CSSProperties = {
  background: ELECTRIC_BLUE,
};

/*
  Marca atual em versão branca com o "C" vazado — o painel do onboarding é azul sólido,
  e a logo padrão (bolha azul) sumiria nele. Gerada a partir de public/logo.png; para
  atualizar, basta regerar mantendo o vazado.
*/
const ONBOARDING_MARK_SRC = "/velo-mark-branco.png";

const OnboardingBrandLogo = ({ size = "md", variant = "light" }: { size?: "sm" | "md"; variant?: "light" | "dark" }) => {
  const isLight = variant === "light";
  const iconSize = size === "md" ? 42 : 30;
  const fontSize = size === "md" ? 22 : 16;
  const gap = size === "md" ? 10 : 8;

  return (
    <div style={{ display: "flex", alignItems: "center", gap }}>
      <img
        src={ONBOARDING_MARK_SRC}
        alt=""
        style={{
          width: iconSize,
          height: iconSize,
          display: "block",
          objectFit: "contain",
          filter: isLight ? "none" : "brightness(0)",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
          fontSize,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: isLight ? "#FFFFFF" : "#0A0A0A",
          lineHeight: 1,
        }}
      >
        Velo
      </span>
    </div>
  );
};

const OnboardingDecor = () => (
  <div className="pointer-events-none absolute bottom-10 left-12 right-12 z-0 hidden h-[210px] lg:block" aria-hidden="true">
    <div className="absolute bottom-0 left-[56%] h-[86px] w-[6px] rounded-full bg-white/35" />
    <div className="absolute bottom-[82px] left-[calc(56%-28px)] h-[48px] w-[62px] rounded-[12px] border border-white/35 bg-white/95 shadow-[18px_22px_34px_rgba(0,36,120,0.20)]" />
    <div className="absolute bottom-[132px] left-[18%] flex h-[58px] w-[160px] items-center gap-3 rounded-2xl border border-white/18 bg-white/12 px-4 backdrop-blur-sm">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#005EFE]">
        <Package size={18} strokeWidth={2} />
      </span>
      <span className="space-y-1">
        <span className="block h-2 w-16 rounded-full bg-white/80" />
        <span className="block h-2 w-24 rounded-full bg-white/35" />
      </span>
    </div>
    <div className="absolute bottom-[42px] left-[30%] flex h-[52px] w-[142px] items-center gap-3 rounded-2xl border border-white/16 bg-white/10 px-4 backdrop-blur-sm">
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-white/95 text-[#005EFE]">
        <Rocket size={16} strokeWidth={2} />
      </span>
      <span className="space-y-1">
        <span className="block h-2 w-20 rounded-full bg-white/72" />
        <span className="block h-2 w-14 rounded-full bg-white/30" />
      </span>
    </div>
    <div className="absolute bottom-[14px] left-[56%] h-[8px] w-[90px] -translate-x-1/2 rounded-full bg-[#003EA8]/30 blur-[2px]" />
  </div>
);

// Cards de opção (painel direito, fundo claro). Seleção = borda azul + leve
// tom de fundo azulado + seta à direita.
const optionCardStyle = (selected: boolean): CSSProperties =>
  selected
    ? {
        background: "#EEF5FF",
        border: `1.5px solid ${ELECTRIC_BLUE}`,
        boxShadow: "0 10px 28px rgba(0,94,254,0.13)",
      }
    : {
        background: "#FFFFFF",
        border: "1.5px solid #E5EAF2",
        boxShadow: "0 1px 2px rgba(15,23,42,0.03)",
      };

// Container quadrado do ícone à esquerda do card. Sem a antiga paleta rotativa
// (azul/verde/laranja/roxo): o ícone é preto sobre cinza neutro, e a cor fica
// reservada ao estado selecionado.
const ICON_CHIP_BG = "#F1F3F7";
const ICON_CHIP_FG = "#0A0A0A";

const iconChipStyle = (selected: boolean): CSSProperties =>
  selected
    ? { background: ELECTRIC_BLUE, border: `1.5px solid ${ELECTRIC_BLUE}`, color: "#FFFFFF" }
    : { background: ICON_CHIP_BG, border: `1.5px solid ${ICON_CHIP_BG}`, color: ICON_CHIP_FG };

// ── Fluxo linear: uma pergunta por tela ──────────────────────────────────────
// As 3 macro-etapas do stepper continuam sendo o agrupamento visual/lógico, mas
// a navegação interna passa a ser por pergunta individual. Cada pergunta guarda
// o índice da etapa a que pertence para destacar o stepper corretamente.
type FlatQuestion = Question & { stepIndex: number };
const FLAT_QUESTIONS: FlatQuestion[] = STEPS.flatMap((s, stepIndex) =>
  s.questions.map((q) => ({ ...q, stepIndex })),
);

// Tempo que o card selecionado fica visível (animação) antes do avanço
// automático para a próxima pergunta.
const ADVANCE_MS = 2500;

const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  // Navegação por PERGUNTA (não mais por etapa). `index` aponta para a pergunta
  // atual no fluxo linear; a macro-etapa é derivada dela.
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  // Nonce incrementado a cada clique: reinicia a barra de progresso mesmo quando
  // o usuário reclica a MESMA opção (o `selected` não muda, mas o timer sim).
  const [selectionNonce, setSelectionNonce] = useState(0);
  const reduce = useReducedMotion();

  const question = FLAT_QUESTIONS[index];
  const currentStepIndex = question.stepIndex;
  const currentStep = STEPS[currentStepIndex];

  // Refs para leitura estável dentro do timer de avanço (evita closures velhas).
  const indexRef = useRef(index);
  const answersRef = useRef(answers);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Timer do avanço automático.
  const advanceTimer = useRef<number | null>(null);
  const clearAdvance = () => {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  };
  // Garante que nenhum timer pendente sobreviva ao desmontar do modal.
  useEffect(() => clearAdvance, []);

  // Avança para a próxima pergunta — ou conclui o quiz na última.
  const advance = () => {
    clearAdvance();
    if (indexRef.current >= FLAT_QUESTIONS.length - 1) {
      onComplete(answersRef.current);
      return;
    }
    setDirection(1);
    setIndex((value) => value + 1);
  };

  // Clique numa opção: aplica a seleção e agenda o avanço automático após a
  // animação de ~2,5s. Reclicar (mesma ou outra opção) reinicia o timer.
  const select = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setSelectionNonce((n) => n + 1);
    clearAdvance();
    advanceTimer.current = window.setTimeout(advance, ADVANCE_MS);
  };

  // "Voltar" já existia no fluxo anterior — preservado, agora por pergunta.
  const handleBack = () => {
    clearAdvance();
    setDirection(-1);
    setIndex((value) => Math.max(0, value - 1));
  };

  // Slide + fade direcional do conteúdo (respeitando reduced-motion).
  const contentVariants: Variants = {
    initial: (dir: number) => ({ opacity: 0, x: reduce ? 0 : dir >= 0 ? 30 : -30 }),
    animate: {
      opacity: 1,
      x: 0,
      transition: {
        duration: reduce ? 0.001 : 0.32,
        ease: EASE,
        staggerChildren: reduce ? 0 : 0.05,
        delayChildren: reduce ? 0 : 0.03,
      },
    },
    exit: (dir: number) => ({
      opacity: 0,
      x: reduce ? 0 : dir >= 0 ? -30 : 30,
      transition: { duration: reduce ? 0.001 : 0.22, ease: EASE },
    }),
  };

  const optionVariants: Variants = {
    initial: { opacity: 0, y: reduce ? 0 : 10 },
    animate: { opacity: 1, y: 0, transition: { duration: reduce ? 0.001 : 0.26, ease: EASE } },
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
        <div className="relative z-10">
          <OnboardingBrandLogo size="md" variant="light" />
        </div>

        <div className="relative z-10 flex flex-1 flex-col justify-center pb-28 pt-10">
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
            {STEPS.map((s, stepIdx) => {
              const active = stepIdx === currentStepIndex;
              const done = stepIdx < currentStepIndex;
              return (
                <li key={s.title} className="flex items-center gap-3">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[13px] font-semibold transition-colors duration-300 ${
                      active
                        ? "border-white bg-white text-[#005EFE]"
                        : done
                        ? "border-white/70 bg-white/20 text-white"
                        : "border-white/30 text-white/50"
                    }`}
                  >
                    {done ? <Check size={14} strokeWidth={2.4} /> : stepIdx + 1}
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

        <OnboardingDecor />
      </aside>

      {/* ── Painel direito (perguntas) ───────────────────────────────────────
          Fundo claro, ocupa o restante da largura. Uma pergunta por tela: em
          alturas normais o conteúdo cabe sem scroll; overflow-y-auto é só uma
          rede de segurança para viewports muito baixas (nunca corta conteúdo). */}
      <section className="relative flex min-w-0 flex-1 flex-col overflow-y-auto bg-[#FBFCFF]">
        {/* Cabeçalho do painel: logo (só no mobile, já que o painel de marca
            está oculto) + link de ajuda no canto superior direito. */}
        <div className="z-20 flex shrink-0 items-center justify-between px-6 pt-6 sm:px-10 lg:absolute lg:left-0 lg:right-0 lg:top-0 lg:px-14">
          <div className="lg:hidden">
            <OnboardingBrandLogo size="sm" variant="dark" />
          </div>
          <span className="hidden lg:block" />
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#64748B] transition-colors hover:text-[#0A0A0A] sm:text-[14px]"
          >
            <HelpCircle size={15} strokeWidth={1.8} />
            Precisando de ajuda?
          </button>
        </div>

        <div className="mx-auto flex w-full max-w-[620px] flex-1 flex-col justify-center px-6 py-10 sm:px-10 lg:px-4 lg:py-20">
          {/* Título + subtítulo da MACRO-etapa (anima só quando a etapa muda). */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepIndex}
              className="shrink-0"
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0.001 : 0.28, ease: EASE }}
            >
              <p className="text-[13px] font-semibold text-[#0A0A0A]">
                Etapa {currentStepIndex + 1} de {STEPS.length}
              </p>
              <h2 className="mt-2 text-[26px] font-bold tracking-[-0.02em] text-[#0F172A] sm:text-[28px]">
                {currentStep.title}
              </h2>
              <p className="mt-1.5 text-[14px] text-[#64748B] sm:text-[15px]">
                {currentStep.subtitle}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* UMA pergunta por tela (slide/fade direcional). */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.fieldset
              key={index}
              className="mt-8 flex flex-col"
              custom={direction}
              variants={contentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <legend className="mb-3 text-[14px] font-semibold text-[#0F172A] sm:text-[15px]">
                {question.label}
                {question.optional ? (
                  <span className="ml-2 text-[13px] font-normal text-[#94A3B8]">(opcional)</span>
                ) : null}
              </legend>
              {/* Cards horizontais empilhados: ícone quadrado à esquerda
                  (outline/sólido conforme seleção), título + descrição em duas
                  linhas, seta à direita e barra de progresso do avanço, ambas
                  só no card selecionado. */}
              <div className={question.options.length > 4 ? "grid grid-cols-1 gap-3 xl:grid-cols-2" : "flex flex-col gap-3"}>
                {question.options.map((option, optionIndex) => {
                  const selected = answers[question.id] === option.value;
                  const Icon = option.icon;
                  return (
                    <motion.button
                      key={option.value}
                      type="button"
                      variants={optionVariants}
                      onClick={() => select(question.id, option.value)}
                      aria-pressed={selected}
                      whileTap={reduce ? undefined : { scale: 0.99 }}
                      style={optionCardStyle(selected)}
                      className={`group relative flex min-h-[72px] items-center gap-4 overflow-hidden rounded-[16px] px-5 py-3.5 text-left transition-[background-color,border-color,box-shadow,transform] duration-200 ${
                        selected ? "" : "hover:border-[#D4D4D8] hover:-translate-y-0.5"
                      }`}
                    >
                      <span
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] transition-colors duration-200"
                        style={iconChipStyle(selected)}
                      >
                        <Icon size={19} strokeWidth={selected ? 2 : 1.85} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[14px] font-semibold leading-tight text-[#0F172A] sm:text-[15px]">
                          {option.label}
                        </span>
                        <span className="mt-0.5 text-[12.5px] font-normal leading-snug text-[#71717A] sm:text-[13px]">
                          {option.description}
                        </span>
                      </span>
                      {/* Seta visível só no selecionado (referência). */}
                      <ArrowRight
                        size={18}
                        strokeWidth={2}
                        className={`shrink-0 text-[#005EFE] transition-opacity duration-200 ${
                          selected ? "opacity-100" : "opacity-0"
                        }`}
                      />
                      {/* Barra de progresso: preenche em ~2,5s e, ao completar,
                          o avanço automático dispara. `selectionNonce` na key faz
                          reiniciar mesmo ao reclicar a mesma opção. */}
                      {selected ? (
                        <motion.span
                          key={selectionNonce}
                          className="pointer-events-none absolute bottom-0 left-0 h-[3px] bg-[#005EFE]"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: reduce ? 0.001 : ADVANCE_MS / 1000, ease: "linear" }}
                        />
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
            </motion.fieldset>
          </AnimatePresence>

          {/* Rodapé: apenas "Voltar" (o botão "Avançar" foi removido — o avanço
              é automático após a seleção). */}
          <div className="mt-4 flex shrink-0 items-center">
            {index > 0 ? (
              <motion.button
                type="button"
                onClick={handleBack}
                whileTap={reduce ? undefined : { scale: 0.97 }}
                className="inline-flex items-center gap-2 text-[14px] font-medium text-[#64748B] transition-colors hover:text-[#0F172A]"
              >
                <ArrowLeft size={16} strokeWidth={1.8} />
                Voltar
              </motion.button>
            ) : null}
          </div>
        </div>
      </section>
    </motion.div>
  );
};

export default OnboardingModal;
