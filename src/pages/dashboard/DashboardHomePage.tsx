import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp, ArrowUpRight, Plus, Search } from "lucide-react";
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
      className="relative -m-5 min-h-[calc(100%+40px)] overflow-visible bg-[#F7F8FA] px-5 pb-24 pt-5 text-[#111111] sm:-m-6 sm:min-h-[calc(100%+48px)] sm:px-6 sm:pt-6 lg:-m-7 lg:min-h-[calc(100%+56px)] lg:px-7 lg:pt-7"
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

      <section className="relative z-10 mx-auto flex min-h-[calc(100vh-24px)] w-full max-w-[820px] flex-col px-4 pb-5 pt-[7vh] sm:px-6 lg:pt-[9vh]">
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
          className="mx-auto mt-[clamp(58px,10vh,112px)] w-full max-w-[462px] rounded-[15px] border border-white/80 bg-white/86 px-[13px] py-[9px] shadow-[0_1px_1px_rgba(17,24,39,0.025),0_16px_42px_rgba(17,24,39,0.085)] backdrop-blur-2xl"
          style={{ fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.16}
        >
          <div className="flex h-[17px] items-center gap-2">
            <Search className="h-[14px] w-[14px] shrink-0 text-[#6F7680]" strokeWidth={1.5} />
            <input
              value={chatPrompt}
              onChange={(event) => setChatPrompt(event.target.value)}
              placeholder="Pergunte ao Aquas..."
              aria-label="Pergunte ao Aquas"
              className="h-[17px] min-w-0 flex-1 bg-transparent text-[13.5px] font-medium leading-[17px] text-[#111111] outline-none placeholder:text-[#2D333B]"
            />
          </div>
          <div className="mt-[9px] flex h-[28px] items-center justify-between gap-3">
            <button
              type="button"
              className="inline-flex min-w-0 items-center gap-[7px] text-[12.5px] font-normal text-[#C4C8CE] transition-colors hover:text-[#8D939B]"
              aria-label="Adicionar contexto"
            >
              <Plus className="h-[13px] w-[13px] shrink-0" strokeWidth={1.45} />
              <span className="truncate">Adicionar contexto</span>
            </button>
            <button
              type="submit"
              className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full bg-[#050505] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_18px_rgba(17,24,39,0.16)] transition-transform hover:-translate-y-px active:translate-y-0"
              aria-label="Enviar pergunta ao Aquas"
            >
              <ArrowUp className="h-3 w-3" strokeWidth={2.1} />
            </button>
          </div>
        </motion.form>

        <motion.div
          className="mt-auto flex justify-center pt-12"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.24}
        >
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex h-[48px] items-center gap-[11px] rounded-[16px] bg-white/72 px-5 text-[16.5px] font-semibold tracking-[-0.02em] text-[#050505] shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_14px_34px_rgba(17,24,39,0.08)] backdrop-blur-2xl transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <ArrowUpRight className="h-[18px] w-[18px]" strokeWidth={1.9} />
            Acessar o site
          </button>
        </motion.div>
      </section>
    </main>
  );
};

export default DashboardHomePage;
