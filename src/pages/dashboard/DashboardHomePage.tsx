import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import SuggestedProducts from "@/components/dashboard/SuggestedProducts";

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
              fontWeight: 500,
              fontSynthesis: "none",
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
          className="mt-6 w-full max-w-[680px] flex items-center bg-white rounded-full pl-6 pr-2 py-2 transition-shadow focus-within:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_6px_16px_rgba(0,0,0,0.08),0_20px_40px_rgba(0,0,0,0.05)]"
          style={{
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow:
              "0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06), 0 16px 32px rgba(0,0,0,0.04)",
          }}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.2}
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Pergunte ao Atlas… ou pesquise um produto"
            className="flex-1 bg-transparent outline-none text-[13.5px] text-neutral-800 placeholder:text-[#A3A3A3] placeholder:font-normal"
            disabled={creating}
          />
          <button
            type="submit"
            disabled={creating}
            onClick={() => !inputText.trim() && startAtlasThread()}
            style={{
              transition: "opacity 0.2s ease, box-shadow 0.2s ease",
              opacity: inputText.trim() ? 1 : 0.45,
              background: "linear-gradient(180deg, #2A2A2A 0%, #1A1A1A 100%)",
              boxShadow: inputText.trim()
                ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.15)"
                : "none",
            }}
            className="h-9 w-9 shrink-0 rounded-full text-white grid place-items-center ml-2"
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
