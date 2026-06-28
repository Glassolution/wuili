import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  Circle,
  PackagePlus,
  ShoppingBag,
  Sparkles,
  Store,
  WandSparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

type ProgressData = {
  hasMercadoLivre: boolean;
  hasPublication: boolean;
};

type ActionCard = {
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
  Icon: React.ElementType;
  accent: string;
  surface: string;
};

type LearnCard = {
  title: string;
  to: string;
  Icon: React.ElementType;
  gradient: string;
};

const fadeUp = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1], delay },
  }),
};

const cardShadow =
  "inset 0 1px 0 rgba(255,255,255,0.86), 0 1px 2px rgba(17,24,39,0.035), 0 14px 36px rgba(17,24,39,0.075), 0 34px 76px rgba(30,58,138,0.055)";

const actionCards: ActionCard[] = [
  {
    title: "Importe produtos para o seu catálogo",
    description: "Escolha itens do fornecedor C7Drop e monte uma vitrine pronta para publicar.",
    buttonLabel: "Importar produtos",
    to: "/dashboard/catalogo",
    Icon: PackagePlus,
    accent: "#2563EB",
    surface: "linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 68%)",
  },
  {
    title: "Gerencie sua conta do Mercado Livre",
    description: "Acompanhe integrações, publicações e próximos ajustes dos seus anúncios.",
    buttonLabel: "Ver Mercado Livre",
    to: "/dashboard/produtos-ml",
    Icon: ShoppingBag,
    accent: "#F6B700",
    surface: "linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 68%)",
  },
  {
    title: "Acompanhe sua margem e vendas",
    description: "Veja os indicadores do catálogo para decidir o que importar, ajustar e escalar.",
    buttonLabel: "Ver análise",
    to: "/dashboard/catalogo?tab=metricas",
    Icon: BarChart3,
    accent: "#16A34A",
    surface: "linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 68%)",
  },
];

const learnCards: LearnCard[] = [
  {
    title: "Como precificar seus produtos para maximizar margem",
    to: "/docs",
    Icon: BarChart3,
    gradient: "linear-gradient(135deg, #DBEAFE 0%, #FFFFFF 54%, #D1FAE5 100%)",
  },
  {
    title: "Estratégias para reduzir falhas de publicação no Mercado Livre",
    to: "/docs",
    Icon: Store,
    gradient: "linear-gradient(135deg, #FEF3C7 0%, #FFFFFF 55%, #DBEAFE 100%)",
  },
  {
    title: "Como usar o Atlas para encontrar produtos vencedores",
    to: "/docs",
    Icon: WandSparkles,
    gradient: "linear-gradient(135deg, #E0E7FF 0%, #FFFFFF 55%, #FCE7F3 100%)",
  },
];

const ProgressRing = ({ value }: { value: number }) => {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative grid h-[132px] w-[132px] shrink-0 place-items-center rounded-full bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_42px_rgba(30,58,138,0.10)]">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 132 132" aria-hidden="true">
        <circle cx="66" cy="66" r={radius} stroke="#E5E7EB" strokeWidth="10" fill="none" />
        <circle
          cx="66"
          cy="66"
          r={radius}
          stroke="#2563EB"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="grid h-[82px] w-[82px] place-items-center rounded-full bg-[#F8FAFC] text-center shadow-[inset_0_1px_1px_rgba(17,24,39,0.05)]">
        <span className="text-[26px] font-bold tracking-[-0.04em] text-[#1E3A8A]">{value}%</span>
      </div>
    </div>
  );
};

const IllustrationBubble = ({
  Icon,
  accent,
  surface,
}: {
  Icon: React.ElementType;
  accent: string;
  surface: string;
}) => (
  <div
    className="relative grid h-[112px] w-[112px] shrink-0 place-items-center rounded-[32px] sm:h-[132px] sm:w-[132px]"
    style={{
      background: surface,
      border: "1px solid rgba(255,255,255,0.76)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.86), 0 18px 36px rgba(17,24,39,0.08)",
    }}
  >
    <div
      className="absolute bottom-4 h-5 w-16 rounded-full blur-md"
      style={{ background: `${accent}24` }}
      aria-hidden="true"
    />
    <Icon
      className="relative h-12 w-12 drop-shadow-[0_12px_16px_rgba(17,24,39,0.18)] sm:h-14 sm:w-14"
      color={accent}
      strokeWidth={1.75}
    />
  </div>
);

const PrimaryButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_22px_rgba(17,24,39,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#1E3A8A] active:translate-y-0"
  >
    {children}
    <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
  </button>
);

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: progressData } = useQuery({
    queryKey: ["dashboard-home-progress", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async (): Promise<ProgressData> => {
      const [integrationsResult, publicationsResult] = await Promise.all([
        supabase
          .from("user_integrations")
          .select("id, access_token, platform")
          .eq("user_id", user!.id)
          .eq("platform", "mercadolivre")
          .limit(1),
        supabase
          .from("user_publications")
          .select("id")
          .eq("user_id", user!.id)
          .limit(1),
      ]);

      if (integrationsResult.error) throw integrationsResult.error;
      if (publicationsResult.error) throw publicationsResult.error;

      return {
        hasMercadoLivre: Boolean(integrationsResult.data?.some((row) => row.access_token)),
        hasPublication: Boolean(publicationsResult.data?.length),
      };
    },
  });

  const onboarding = useMemo(() => {
    const hasMercadoLivre = progressData?.hasMercadoLivre ?? false;
    const hasPublication = progressData?.hasPublication ?? false;
    const completed = [hasMercadoLivre, hasPublication].filter(Boolean).length;

    return {
      percent: completed * 50,
      items: [
        {
          label: "Conectar Mercado Livre",
          complete: hasMercadoLivre,
          action: "Conectar conta",
          to: "/dashboard/produtos-ml",
        },
        {
          label: "Publicar 1º produto",
          complete: hasPublication,
          action: "Importar produto",
          to: "/dashboard/catalogo",
        },
      ],
    };
  }, [progressData]);

  const nextStep = onboarding.items.find((item) => !item.complete) ?? onboarding.items[0];
  const showProgress = Boolean(user?.id) && onboarding.percent < 100;

  return (
    <main
      className="relative min-h-full w-full overflow-visible bg-[#F7F8FA] pb-24 text-[#111111]"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[-180px] h-[380px] w-[760px] -translate-x-1/2 rounded-full blur-2xl"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.92) 0%, rgba(219,234,254,0.46) 42%, rgba(255,255,255,0) 72%)",
        }}
        aria-hidden="true"
      />

      <section className="relative z-10 mx-auto flex w-full max-w-[1120px] flex-col gap-5 px-1 pt-4 sm:px-2">
        <motion.header
          className="mb-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <div>
            <p className="text-[24px] font-medium leading-tight tracking-tight text-[#4B5563] sm:text-[28px]">
              Boas-vindas ao{" "}
              <span
                style={{
                  fontFamily: '"Playfair Display", Georgia, serif',
                  fontStyle: "italic",
                  fontWeight: 500,
                  fontSynthesis: "none",
                }}
              >
                Velo
              </span>
              !
            </p>
            <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.04em] text-neutral-950 sm:text-[36px]">
              Você está a poucos passos de vender mais.
            </h1>
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard/atlas")}
            className="inline-flex h-11 w-fit items-center justify-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 text-[13px] font-semibold text-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_12px_28px_rgba(17,24,39,0.08)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:text-[#1E3A8A]"
          >
            <Bot className="h-4 w-4" strokeWidth={1.9} />
            Abrir Atlas
          </button>
        </motion.header>

        {showProgress && (
          <motion.article
            className="grid gap-6 overflow-hidden rounded-[32px] border border-white/70 p-5 backdrop-blur-xl lg:grid-cols-[160px_minmax(0,1fr)_320px] lg:items-center lg:p-6"
            style={{ background: "rgba(255,255,255,0.86)", boxShadow: cardShadow }}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.08}
          >
            <div className="flex justify-center lg:justify-start">
              <ProgressRing value={onboarding.percent} />
            </div>

            <div className="min-w-0 text-center lg:text-left">
              <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-[#2563EB]">
                Primeiros passos
              </p>
              <h2 className="mt-2 text-[28px] font-bold leading-none tracking-[-0.045em] text-neutral-950 sm:text-[38px]">
                {onboarding.percent}% pronto
              </h2>
              <p className="mt-3 max-w-[460px] text-[14px] leading-6 text-[#6B7280] lg:max-w-[520px]">
                Complete a configuração inicial para publicar com menos atrito e acompanhar sua operação no Mercado Livre.
              </p>
              <div className="mt-5 flex justify-center lg:justify-start">
                <PrimaryButton onClick={() => navigate(nextStep.to)}>{nextStep.action}</PrimaryButton>
              </div>
            </div>

            <div className="rounded-[24px] border border-black/[0.05] bg-[#F8FAFC]/80 p-4">
              <div className="space-y-3">
                {onboarding.items.map((item) => {
                  const Icon = item.complete ? CheckCircle2 : Circle;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => navigate(item.to)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white"
                    >
                      <span
                        className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
                          item.complete ? "bg-[#DBEAFE] text-[#2563EB]" : "bg-white text-[#9CA3AF]"
                        }`}
                      >
                        <Icon className="h-5 w-5" strokeWidth={1.9} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-neutral-900">
                          {item.label}
                        </span>
                        <span className="block text-[12px] font-medium text-[#6B7280]">
                          {item.complete ? "Concluído" : "Pendente"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.article>
        )}

        <div className="flex flex-col gap-5">
          {actionCards.map((card, index) => (
            <motion.article
              key={card.title}
              className="flex flex-col gap-5 rounded-[32px] border border-white/70 p-5 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6"
              style={{ background: "rgba(255,255,255,0.86)", boxShadow: cardShadow }}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              custom={0.14 + index * 0.08}
            >
              <IllustrationBubble Icon={card.Icon} accent={card.accent} surface={card.surface} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-bold leading-tight tracking-[-0.035em] text-neutral-950 sm:text-[26px]">
                  {card.title}
                </h2>
                <p className="mt-2 max-w-[560px] text-[14px] leading-6 text-[#6B7280]">
                  {card.description}
                </p>
              </div>
              <div className="sm:ml-auto">
                <PrimaryButton onClick={() => navigate(card.to)}>{card.buttonLabel}</PrimaryButton>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.section
          className="pt-7"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.42}
        >
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-[#1E3A8A]" strokeWidth={1.9} />
            <h2 className="text-[22px] font-bold tracking-[-0.035em] text-neutral-950">Aprenda a vender mais</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {learnCards.map((card, index) => {
              const Icon = card.Icon;
              return (
                <motion.button
                  key={card.title}
                  type="button"
                  onClick={() => navigate(card.to)}
                  className="group overflow-hidden rounded-[28px] border border-white/70 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-1"
                  style={{ background: "rgba(255,255,255,0.86)", boxShadow: cardShadow }}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={0.48 + index * 0.06}
                >
                  <div
                    className="relative flex aspect-[1.65] items-center justify-center overflow-hidden"
                    style={{ background: card.gradient }}
                  >
                    <div className="absolute left-5 top-5 rounded-full bg-white/75 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-[#1E3A8A] shadow-sm">
                      Guia
                    </div>
                    <div className="grid h-20 w-20 place-items-center rounded-[26px] bg-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_34px_rgba(17,24,39,0.09)] transition-transform duration-300 group-hover:scale-105">
                      <Icon className="h-9 w-9 text-[#2563EB]" strokeWidth={1.8} />
                    </div>
                    <Sparkles className="absolute bottom-6 right-7 h-5 w-5 text-[#1E3A8A]/45" strokeWidth={1.7} />
                  </div>
                  <div className="p-5">
                    <h3 className="text-[15px] font-bold leading-snug tracking-[-0.02em] text-neutral-950">
                      {card.title}
                    </h3>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </motion.section>
      </section>
    </main>
  );
};

export default DashboardHomePage;
