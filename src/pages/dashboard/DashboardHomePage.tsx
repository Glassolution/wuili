import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp, ArrowUpRight, Play, Plus, Search } from "lucide-react";
import { VeloLogo } from "@/components/VeloLogo";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/lib/profileContext";

const fadeUp = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1], delay },
  }),
};

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

  return (
    <main
      className="relative -m-5 min-h-[calc(100%+40px)] overflow-visible bg-[#FAF0F8] px-5 pb-24 pt-5 text-[#111111] sm:-m-6 sm:min-h-[calc(100%+48px)] sm:px-6 sm:pt-6 lg:-m-7 lg:min-h-[calc(100%+56px)] lg:px-7 lg:pt-7"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "linear-gradient(180deg, #FCE7F3 0%, #F5E8FF 38%, #FFF4E8 100%)",
            "radial-gradient(ellipse 130% 90% at 50% -8%, rgba(236,72,153,0.28) 0%, rgba(192,132,252,0.22) 28%, rgba(255,255,255,0) 62%)",
            "radial-gradient(ellipse 80% 60% at 12% 18%, rgba(251,191,219,0.38) 0%, rgba(255,255,255,0) 52%)",
            "radial-gradient(ellipse 100% 75% at 88% 92%, rgba(253,186,116,0.55) 0%, rgba(255,218,185,0.42) 32%, rgba(255,255,255,0) 58%)",
          ].join(", "),
        }}
        aria-hidden="true"
      />

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-24px)] w-full flex-col items-center px-4 pb-5 pt-[8vh] sm:px-6 lg:pt-[10vh]">
        {/* Logo Velo — topo, acima do badge (referência Dia) */}
        <motion.div
          className="flex w-full justify-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <VeloLogo size="sm" variant="dark" />
        </motion.div>

        {/* Badge centralizado */}
        <motion.div
          className="mt-6 flex w-full justify-center sm:mt-7"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.04}
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

        {/* 2. Headline — respiro generoso abaixo do badge (referência Dia) */}
        <motion.header
          className="mt-[52px] w-full text-center sm:mt-[68px]"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.08}
        >
          <h1 className="text-[42px] font-medium leading-[0.98] tracking-[-0.06em] text-neutral-950 sm:text-[62px]">
            {greeting}, {firstName}
          </h1>
        </motion.header>

        {/* 3. Card do input + esboços de janela decorativos */}
        <div className="relative mt-[clamp(112px,18vh,200px)] w-[40vw] min-w-[min(100%,400px)] max-w-[640px] overflow-visible py-6">
          <div
            className="pointer-events-none absolute -inset-x-[18%] -top-[8%] bottom-[-28%] z-0 overflow-visible"
            aria-hidden="true"
          >
            <div
              className="absolute left-[2%] top-[18%] h-[156px] w-[260px] rounded-[16px] border border-[#64748B]/35 bg-white/[0.02] opacity-[0.14]"
              style={{ transform: "rotate(-5deg)" }}
            >
              <div className="flex items-center gap-1.5 px-3 pt-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]/35" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]/35" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]/35" />
              </div>
            </div>
            <div
              className="absolute right-[0%] top-[34%] h-[142px] w-[228px] rounded-[14px] border border-[#64748B]/32 bg-white/[0.02] opacity-[0.12]"
              style={{ transform: "rotate(4deg)" }}
            >
              <div className="flex items-center gap-1.5 px-3 pt-2.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]/32" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]/32" />
                <span className="h-1.5 w-1.5 rounded-full bg-[#64748B]/32" />
              </div>
            </div>
            <div
              className="absolute left-[18%] top-[52%] h-[128px] w-[210px] rounded-[12px] border border-[#64748B]/28 bg-transparent opacity-[0.11]"
              style={{ transform: "rotate(-2deg)" }}
            />
          </div>

          <motion.form
            onSubmit={(event) => {
              event.preventDefault();
              openAquas(chatPrompt || "Como posso vender mais hoje?");
            }}
            className="relative z-10 w-full rounded-[28px] border border-black/[0.05] bg-white px-6 py-5 shadow-[0_2px_6px_rgba(17,24,39,0.04),0_28px_72px_rgba(17,24,39,0.09)] sm:px-7 sm:py-[22px]"
            style={{ fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={0.16}
          >
          {/* Linha 1: lupa + placeholder */}
          <div className="flex items-center gap-3">
            <Search
              className="h-[16px] w-[16px] shrink-0 text-[#6F7680]"
              strokeWidth={1.55}
              aria-hidden="true"
            />
            <input
              value={chatPrompt}
              onChange={(event) => setChatPrompt(event.target.value)}
              placeholder="Pergunte ao Aquas..."
              aria-label="Pergunte ao Aquas"
              className="min-w-0 flex-1 bg-transparent text-[15px] font-medium leading-[22px] text-[#111111] outline-none placeholder:text-[#2D333B]"
            />
          </div>

          {/* Linha 2: contexto à esquerda, enviar à direita */}
          <div className="mt-5 flex items-center justify-between gap-4">
            <button
              type="button"
              className="inline-flex min-w-0 items-center gap-2 text-[13px] font-normal text-[#C4C8CE] transition-colors hover:text-[#8D939B]"
              aria-label="Adicionar contexto"
            >
              <Plus className="h-[14px] w-[14px] shrink-0" strokeWidth={1.5} />
              <span className="truncate">Adicionar contexto</span>
            </button>
            <button
              type="submit"
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#050505] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_22px_rgba(17,24,39,0.18)] transition-transform hover:-translate-y-px active:translate-y-0"
              aria-label="Enviar pergunta ao Aquas"
            >
              <ArrowUp className="h-[14px] w-[14px]" strokeWidth={2.2} />
            </button>
          </div>
          </motion.form>
        </div>

        {/* Card "Acessar o site" — estilo trailer (referência Dia) */}
        <motion.div
          className="mt-10 flex justify-center sm:mt-12"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.24}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-3 rounded-[14px] border border-white/75 bg-white/78 p-2 pr-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.86),0_14px_34px_rgba(17,24,39,0.08)] backdrop-blur-2xl transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] bg-[linear-gradient(135deg,#1F2937_0%,#0A0A0A_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Play className="h-3.5 w-3.5 fill-white text-white" strokeWidth={0} />
            </span>
            <span className="inline-flex items-center gap-2 text-[15px] font-semibold tracking-[-0.02em] text-[#050505]">
              Acessar o site
              <ArrowUpRight className="h-[16px] w-[16px]" strokeWidth={1.9} />
            </span>
          </button>
        </motion.div>
      </section>
    </main>
  );
};

export default DashboardHomePage;
