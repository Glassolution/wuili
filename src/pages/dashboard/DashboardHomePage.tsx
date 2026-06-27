import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import SuggestedProducts from "@/components/dashboard/SuggestedProducts";

// ─── Atlas Avatar ─────────────────────────────────────────────────────────────
const AtlasAvatar = ({ size = 28 }: { size?: number }) => (
  <div
    style={{ width: size, height: size }}
    className="shrink-0 rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-indigo-500 grid place-items-center text-white text-[12px] font-bold shadow-sm"
  >
    A
  </div>
);

// ─── Fade-up variant (reutilizado em cada elemento) ───────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1], delay },
  }),
};

// ─── Page ─────────────────────────────────────────────────────────────────────
const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [inputText, setInputText] = useState("");
  const [creating, setCreating] = useState(false);

  const startAtlasThread = async (firstMessage?: string) => {
    if (!user?.id) {
      veloToast.error("Faça login para conversar com o Atlas");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("atlas_threads" as never)
        .insert({ user_id: user.id, title: firstMessage?.slice(0, 50) || "Nova conversa" })
        .select("id")
        .single();
      if (error || !data) throw error || new Error("erro");
      const id = (data as { id: string }).id;
      const qs = firstMessage ? `?first=${encodeURIComponent(firstMessage)}` : "";
      navigate(`/dashboard/atlas/${id}${qs}`);
    } catch {
      veloToast.error("Não foi possível abrir a conversa com o Atlas");
    } finally {
      setCreating(false);
    }
  };

  const handleSearchSubmit = (text: string) => {
    const t = text.trim();
    if (!t) return;
    setInputText("");
    startAtlasThread(t);
  };

  return (
    <main
      className="min-h-full w-full text-[#111111] pb-16"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      {/* ── Header bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-4 mb-10">
        <div
          onClick={() => navigate("/dashboard/planos")}
          className="flex items-center gap-3 rounded-full bg-[#111111] py-2 pl-[14px] pr-4 text-white cursor-pointer select-none text-[12.5px]"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-medium text-neutral-100">Aproveite 3 meses por R$ 1/mês</span>
          <span className="h-3.5 w-px bg-white/20 mx-1" />
          <span className="font-semibold">Selecionar um plano</span>
        </div>
        <div className="text-[12.5px] text-neutral-500 hidden sm:block">
          Dúvidas?{" "}
          <span className="text-neutral-900 font-semibold">contato@velo.com.br</span>
        </div>
      </header>

      {/* ── Welcome + Search ───────────────────────────────────────────── */}
      <section className="flex flex-col items-center text-center mb-10">

        {/* 1 — Linha 1: "Boas-vindas ao Velo!" — peso leve, cinza médio (delay 0ms) */}
        <motion.p
          className="text-[22px] sm:text-[26px] font-medium tracking-tight leading-tight"
          style={{ color: "#616161" }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          Boas-vindas ao{" "}
          <span
            style={{
              fontFamily: '"Playfair Display", Georgia, serif',
              fontStyle: "italic",
              fontWeight: 400,
            }}
          >
            Velo
          </span>
          !
        </motion.p>

        {/* 2 — Linha 2: "Por onde quer começar?" — bold, preto (delay 100ms) */}
        <motion.h1
          className="text-[28px] sm:text-[34px] font-bold tracking-tight text-neutral-900 leading-tight"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.1}
        >
          Por onde quer começar?
        </motion.h1>

        {/* 3 — Campo de busca / Atlas (delay 200ms) */}
        <motion.form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearchSubmit(inputText);
          }}
          className="mt-6 w-full max-w-[680px] flex items-center gap-2 bg-white border border-neutral-200 rounded-full pl-4 pr-2 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)] focus-within:border-neutral-400 transition-colors"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.2}
        >
          <AtlasAvatar size={24} />
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte ao Atlas… ou pesquise um produto"
            className="flex-1 bg-transparent outline-none text-[13.5px] text-neutral-800 placeholder:text-neutral-400 px-1.5"
            disabled={creating}
          />
          <button
            type="button"
            onClick={() => startAtlasThread()}
            className="h-8 w-8 rounded-full border border-neutral-200 text-neutral-500 grid place-items-center hover:bg-neutral-50 transition-colors"
            aria-label="Nova conversa com o Atlas"
            title="Nova conversa"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="submit"
            disabled={!inputText.trim() || creating}
            className="h-8 w-8 rounded-full bg-neutral-900 text-white grid place-items-center disabled:opacity-40 hover:bg-neutral-800 transition-colors"
            aria-label="Enviar mensagem ao Atlas"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </motion.form>
      </section>

      {/* ── Produtos sugeridos — delay começa em 300ms ──────────────────── */}
      {/* initialDelay=0.3 → pills em 300ms, cards a partir de 400ms       */}
      <SuggestedProducts initialDelay={0.3} />
    </main>
  );
};

export default DashboardHomePage;
