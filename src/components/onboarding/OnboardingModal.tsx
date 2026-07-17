import { useMemo, useState } from "react";
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

type OnboardingModalProps = {
  /** Chamado quando o usuário conclui a última etapa. */
  onComplete: (answers: Answers) => void;
};

const OnboardingModal = ({ onComplete }: OnboardingModalProps) => {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});

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
    setStep((value) => value + 1);
  };

  const handleBack = () => setStep((value) => Math.max(0, value - 1));

  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col items-center overflow-y-auto bg-[#F4F4F5] px-4 py-10 sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding da Velo"
    >
      {/* Cabeçalho da página: marca + título + subtítulo, centralizados. */}
      <div className="flex flex-col items-center text-center">
        <VeloLogo size="md" variant="dark" />
        <h1 className="mt-7 text-[28px] font-bold tracking-[-0.02em] text-[#0A0A0A] sm:text-[30px]">
          {current.title}
        </h1>
        <p className="mt-2 max-w-[520px] text-[14px] text-[#6B7280] sm:text-[15px]">{current.subtitle}</p>
      </div>

      {/* Card central com as perguntas da etapa. */}
      <div className="mt-6 w-full max-w-[880px] rounded-[24px] bg-white p-6 shadow-[0_24px_60px_rgba(10,10,10,0.10)] sm:p-10">
        {/* Passo + barra de progresso segmentada em 3 partes. */}
        <p className="text-[13px] font-medium text-[#6B7280]">Etapa {step + 1} de {STEPS.length}</p>
        <div className="mt-2 flex gap-2" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          {STEPS.map((_, index) => (
            <span
              key={index}
              className={`h-[6px] flex-1 rounded-full transition-colors ${index <= step ? "bg-[#0A0A0A]" : "bg-[#E5E7EB]"}`}
            />
          ))}
        </div>

        {/* Perguntas. */}
        <div className="mt-8 space-y-8">
          {current.questions.map((question) => (
            <fieldset key={question.id}>
              <legend className="mb-3 text-[15px] font-semibold text-[#111827] sm:text-[16px]">
                {question.label}
                {question.optional ? <span className="ml-2 text-[13px] font-normal text-[#9CA3AF]">(opcional)</span> : null}
              </legend>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.value;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => select(question.id, option.value)}
                      aria-pressed={selected}
                      className={`flex min-h-[64px] items-center gap-3 rounded-[12px] p-3.5 text-left transition-colors ${
                        selected
                          ? "border-[1.5px] border-[#0A0A0A] bg-[#FAFAFA]"
                          : "border border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                      }`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-[#F3F4F6] text-[#111827]">
                        <Icon size={18} strokeWidth={1.5} />
                      </span>
                      <span className="flex-1 text-[14px] font-medium leading-tight text-[#111827] sm:text-[15px]">
                        {option.label}
                      </span>
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                          selected ? "border-[#0A0A0A]" : "border-[#D1D5DB]"
                        }`}
                      >
                        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-[#0A0A0A]" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {/* Rodapé de navegação. */}
        <div className="mt-9 flex items-center justify-between">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-[14px] font-medium text-[#6B7280] transition-colors hover:text-[#111827]"
            >
              <ArrowLeft size={16} strokeWidth={1.8} />
              Voltar
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={handleNext}
            disabled={!canContinue}
            className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[#0A0A0A] px-5 text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLastStep ? "Concluir" : "Avançar"}
            {isLastStep ? <Check size={16} strokeWidth={2} /> : <ArrowRight size={16} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingModal;
