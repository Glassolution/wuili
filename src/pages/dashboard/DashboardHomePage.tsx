import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp, BarChart3, BookOpen, Lightbulb, PackagePlus, ShoppingBag, Sparkles, Store, WandSparkles } from "lucide-react";
import AquasIcon from "@/components/dashboard/AquasIcon";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";

type QuickStartCard = {
  title: string;
  description: string;
  Icon: React.ElementType;
  onClick: () => void;
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
  "inset 0 1px 0 rgba(255,255,255,0.9), 0 1px 2px rgba(17,24,39,0.028), 0 14px 34px rgba(17,24,39,0.052), 0 30px 68px rgba(30,58,138,0.038)";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

const getFirstName = (name?: string | null, email?: string | null) => {
  const raw = (name || email?.split("@")[0] || "Velo").trim();
  return raw.split(/[\s._-]+/).filter(Boolean)[0] || "Velo";
};

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
    title: "Como usar o Aquas para encontrar produtos vencedores",
    to: "/docs",
    Icon: WandSparkles,
    gradient: "linear-gradient(135deg, #E0E7FF 0%, #FFFFFF 55%, #FCE7F3 100%)",
  },
];

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { nome } = useProfile();
  const [chatPrompt, setChatPrompt] = useState("");

  const firstName = useMemo(() => getFirstName(nome, user?.email), [nome, user?.email]);
  const greeting = useMemo(() => getGreeting(), []);

  const openAquas = (prompt?: string) => {
    const cleanPrompt = prompt?.trim();
    const qs = cleanPrompt ? `?first=${encodeURIComponent(cleanPrompt)}` : "";
    navigate(`/dashboard/atlas${qs}`);
  };

  const quickStartCards: QuickStartCard[] = [
    {
      title: "Importar produtos",
      description: "Escolha itens do fornecedor C7Drop.",
      Icon: PackagePlus,
      onClick: () => navigate("/dashboard/catalogo"),
    },
    {
      title: "Gerenciar Mercado Livre",
      description: "Acompanhe integrações e publicações.",
      Icon: ShoppingBag,
      onClick: () => navigate("/dashboard/produtos-ml"),
    },
    {
      title: "Ver análise de vendas",
      description: "Indicadores de margem e performance.",
      Icon: BarChart3,
      onClick: () => navigate("/dashboard/catalogo?tab=metricas"),
    },
    {
      title: "Perguntar ao Aquas",
      description: "O que devo importar hoje?",
      Icon: Lightbulb,
      onClick: () => openAquas("O que devo importar hoje?"),
    },
  ];

  return (
    <main
      className="relative min-h-full w-full overflow-visible bg-[#F7F8FA] pb-24 text-[#111111]"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 14%, rgba(255,255,255,0.92) 0%, rgba(219,234,254,0.36) 28%, rgba(255,255,255,0) 58%), radial-gradient(circle at 88% 84%, rgba(255,237,213,0.65) 0%, rgba(255,255,255,0) 34%)",
        }}
        aria-hidden="true"
      />

      <section className="relative z-10 mx-auto flex w-full max-w-[820px] flex-col px-4 pt-[8vh] sm:px-6 lg:pt-[11vh]">
        <motion.div
          className="flex justify-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <button
            type="button"
            onClick={() => navigate("/checkout")}
            className="inline-flex h-8 items-center gap-2 rounded-full border border-white/70 bg-white/76 px-3 text-[12px] font-semibold text-[#6B7280] shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_10px_22px_rgba(17,24,39,0.06)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:text-[#1E3A8A]"
          >
            Plano Velo
            <span className="text-[#B45309]">Upgrade</span>
          </button>
        </motion.div>

        <motion.header
          className="mt-12 text-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.08}
        >
          <h1 className="text-[42px] font-medium leading-[0.98] tracking-[-0.06em] text-neutral-950 sm:text-[62px]">
            {greeting}, {firstName}
          </h1>
        </motion.header>

        <motion.form
          onSubmit={(event) => {
            event.preventDefault();
            openAquas(chatPrompt || "Como posso vender mais hoje?");
          }}
          className="mt-10 overflow-hidden rounded-[26px] bg-white/75 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(17,24,39,0.03),0_20px_50px_rgba(17,24,39,0.09)] backdrop-blur-2xl"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.16}
        >
          <div className="flex min-h-[96px] items-start px-2 pt-2">
            <textarea
              value={chatPrompt}
              onChange={(event) => setChatPrompt(event.target.value)}
              rows={2}
              placeholder="Pergunte ao Aquas... Como posso te ajudar hoje?"
              className="min-h-[62px] flex-1 resize-none bg-transparent pt-1 text-[15px] font-medium leading-6 text-neutral-800 outline-none placeholder:text-[#9CA3AF]"
            />
          </div>
          <div className="mt-1 flex items-center justify-between px-2 pb-1">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#6B7280]">
              <AquasIcon size={22} inverted />
              <span>Aquas</span>
              <span className="font-medium text-[#9CA3AF]">seu agente de vendas</span>
            </div>
            <button
              type="submit"
              className="grid h-10 w-10 place-items-center rounded-full bg-[#111111] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_22px_rgba(17,24,39,0.18)] transition-all hover:-translate-y-0.5 hover:bg-[#1E3A8A] active:translate-y-0"
              aria-label="Enviar pergunta ao Aquas"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </motion.form>

        <motion.section
          className="mt-7"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.24}
        >
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-[#9CA3AF]">Ações rápidas</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickStartCards.map((card, index) => {
              const Icon = card.Icon;
              return (
                <motion.button
                  key={card.title}
                  type="button"
                  onClick={card.onClick}
                  className="group flex min-h-[92px] items-center gap-4 rounded-[22px] bg-white/72 p-4 text-left backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:bg-white"
                  style={{ boxShadow: cardShadow }}
                  variants={fadeUp}
                  initial="hidden"
                  animate="visible"
                  custom={0.3 + index * 0.05}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center self-center rounded-2xl bg-[#F8FAFC] text-[#1E3A8A] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_18px_rgba(17,24,39,0.05)]">
                    <Icon className="h-5 w-5" strokeWidth={1.85} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold leading-tight text-neutral-950">{card.title}</span>
                    <span className="mt-1 block truncate text-[12.5px] font-medium text-[#8A94A6]">{card.description}</span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        <motion.section
          className="pt-12"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.52}
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
                  custom={0.58 + index * 0.06}
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
