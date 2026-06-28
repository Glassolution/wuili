import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUp, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";
import SuggestedProducts from "@/components/dashboard/SuggestedProducts";

// ─── Fade-up variant (reutilizado em cada elemento) ───────────────────────────
const atlasActions = [
  "Analisar minhas vendas da semana",
  "Sugerir produtos para importar hoje",
  "Verificar publicações com erro no ML",
  "Comparar minha margem por categoria",
];

const fadeUp = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1], delay },
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
      className="relative min-h-full w-full overflow-hidden pb-16 text-[#111111]"
      style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}
    >
      {/* ── Welcome + Search ───────────────────────────────────────────── */}
      <div className="pointer-events-none absolute left-1/2 top-[-140px] h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.86)_0%,rgba(255,255,255,0.34)_38%,rgba(255,255,255,0)_72%)] blur-2xl" />
      <section className="relative z-10 mb-4 flex flex-col items-center pt-[24vh] text-center">

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
          className="mt-6 flex w-full max-w-[720px] items-center rounded-full py-2 pl-6 pr-2 transition-all duration-300 focus-within:scale-[1.006]"
          style={{
            background: "rgba(255,255,255,0.58)",
            border: "1px solid rgba(255,255,255,0.62)",
            backdropFilter: "blur(22px) saturate(145%)",
            WebkitBackdropFilter: "blur(22px) saturate(145%)",
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.78), 0 1px 2px rgba(0,0,0,0.035), 0 12px 34px rgba(17,24,39,0.075), 0 34px 70px rgba(17,24,39,0.045)",
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
          <Sparkles className="mr-1.5 h-4 w-4 shrink-0 text-[#8F7AA8]" strokeWidth={1.8} aria-hidden="true" />

          <button
            type="submit"
            disabled={creating}
            onClick={() => !inputText.trim() && startAtlasThread()}
            style={{
              transition: "opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.22s ease",
              opacity: inputText.trim() ? 1 : 0.45,
              background: "linear-gradient(180deg, #2A2A2A 0%, #1A1A1A 100%)",
              boxShadow: inputText.trim()
                ? "inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 4px rgba(0,0,0,0.2), 0 8px 16px rgba(0,0,0,0.15)"
                : "none",
            }}
            className="ml-2 grid h-9 w-9 shrink-0 place-items-center rounded-full text-white hover:scale-105 active:scale-95"
            aria-label="Enviar mensagem ao Atlas"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </motion.form>

        <motion.div
          className="mt-4 flex w-full max-w-[720px] flex-wrap justify-center gap-2"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.28}
        >
          {atlasActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => startAtlasThread(action)}
              disabled={creating}
              className="rounded-full px-3.5 py-2 text-[11.5px] font-medium tracking-[-0.01em] text-neutral-600 transition-all duration-300 hover:-translate-y-0.5 hover:text-neutral-950 disabled:cursor-wait disabled:opacity-50"
              style={{
                background: "rgba(255,255,255,0.46)",
                border: "1px solid rgba(255,255,255,0.58)",
                backdropFilter: "blur(18px) saturate(140%)",
                WebkitBackdropFilter: "blur(18px) saturate(140%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.65), 0 8px 22px rgba(17,24,39,0.045)",
              }}
            >
              {action}
            </button>
          ))}
        </motion.div>
      </section>

      {/* ── Produtos sugeridos — delay começa em 300ms ──────────────────── */}
      {/* initialDelay=0.3 → pills em 300ms, cards a partir de 400ms       */}
      <div className="relative z-10">
        <SuggestedProducts initialDelay={0.34} />
      </div>
    </main>
  );
};

export default DashboardHomePage;
