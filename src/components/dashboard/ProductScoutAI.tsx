import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AtlasResults = {
  ids: string[];
  label: string;
  source: "preference" | "ai" | "fallback";
};

type ProductScoutAIProps = {
  onResults: (results: AtlasResults) => void;
};

const ALLOWED_SOURCES = ["b2drop", "c7drop"];
const RESULT_LIMIT = 24;

const scoutPreferences = [
  { id: "viral", label: "Produto para viralizar" },
  { id: "margin", label: "Maior margem" },
  { id: "stock", label: "Estoque alto" },
  { id: "entry", label: "Preço baixo" },
] as const;

type PreferenceId = (typeof scoutPreferences)[number]["id"];

const SaturnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="4.8" stroke="currentColor" strokeWidth="2" />
    <path
      d="M3.2 15.2c2.5 1.8 7.5 2 12.1.5 4.6-1.5 7.2-4.1 6.5-5.9-.4-1.2-2-1.8-4.1-1.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M20.8 8.8c-2.5-1.8-7.5-2-12.1-.5-4.6 1.5-7.2 4.1-6.5 5.9.4 1.2 2 1.8 4.1 1.8"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      opacity="0.78"
    />
  </svg>
);

const VeloOrb = ({ active = false }: { active?: boolean }) => (
  <span className="relative grid h-11 w-11 shrink-0 place-items-center">
    <motion.span
      className="absolute h-10 w-10 rounded-full bg-emerald-400/40 blur-md"
      animate={active ? { opacity: [0.35, 0.9, 0.35], scale: [0.9, 1.12, 0.9] } : { opacity: 0.7, scale: 1 }}
      transition={{ duration: 1.55, repeat: active ? Infinity : 0, ease: "easeInOut" }}
    />
    <motion.span
      className="relative h-8 w-8 rounded-full bg-[radial-gradient(circle_at_32%_24%,#eaffde_0%,#7cff74_30%,#04c83b_58%,#01831f_100%)] shadow-[inset_-5px_-7px_12px_rgba(0,0,0,0.24),inset_4px_4px_10px_rgba(255,255,255,0.48),0_0_18px_rgba(27,255,86,0.34)]"
      animate={active ? { rotate: [0, 8, -6, 0], scale: [1, 1.04, 1] } : { rotate: 0, scale: 1 }}
      transition={{ duration: 1.9, repeat: active ? Infinity : 0, ease: "easeInOut" }}
    />
  </span>
);

async function runPreferenceQuery(pref: PreferenceId): Promise<string[]> {
  let q = supabase
    .from("catalog_products")
    .select("id")
    .in("source", ALLOWED_SOURCES)
    .eq("is_blocked", false)
    .gt("stock_quantity", 0);

  switch (pref) {
    case "margin":
      q = q.order("margin_percent", { ascending: false, nullsFirst: false });
      break;
    case "stock":
      q = q.order("stock_quantity", { ascending: false, nullsFirst: false });
      break;
    case "entry":
      q = q
        .gt("cost_price", 0)
        .order("cost_price", { ascending: true, nullsFirst: false });
      break;
    case "viral":
    default:
      q = q
        .order("orders_count", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
  }

  const { data, error } = await q.limit(RESULT_LIMIT);
  if (error) throw error;
  return (data ?? []).map((r) => r.id as string);
}

async function runFreeTextSearch(text: string): Promise<{ ids: string[]; source: "ai" | "fallback" }> {
  try {
    const { data, error } = await supabase.functions.invoke("atlas-search", {
      body: { query: text },
    });
    if (error) throw error;
    const ids = Array.isArray(data?.ids) ? (data.ids as string[]) : [];
    if (ids.length > 0) {
      return { ids, source: data?.used_fallback ? "fallback" : "ai" };
    }
  } catch (err) {
    console.error("atlas-search invoke failed", err);
  }

  // Fallback frontend: ILIKE simples em title/category
  const safe = text.replace(/[%,]/g, " ").trim();
  const { data } = await supabase
    .from("catalog_products")
    .select("id")
    .in("source", ALLOWED_SOURCES)
    .eq("is_blocked", false)
    .gt("stock_quantity", 0)
    .or(`title.ilike.%${safe}%,category.ilike.%${safe}%`)
    .order("orders_count", { ascending: false, nullsFirst: false })
    .limit(RESULT_LIMIT);

  return { ids: (data ?? []).map((r) => r.id as string), source: "fallback" };
}

const ProductScoutAI = ({ onResults }: ProductScoutAIProps) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const runRef = useRef(0);

  const openPanel = () => {
    setOpen(true);
    setError(null);
  };

  const close = () => {
    runRef.current += 1;
    setOpen(false);
    setBusy(false);
  };

  const handlePreference = async (pref: PreferenceId, label: string) => {
    const runId = ++runRef.current;
    setBusy(true);
    setError(null);
    try {
      const ids = await runPreferenceQuery(pref);
      if (runId !== runRef.current) return;
      onResults({ ids, label, source: "preference" });
      setOpen(false);
    } catch (err) {
      console.error("Preference query failed", err);
      if (runId !== runRef.current) return;
      setError("Não consegui buscar agora. Tente novamente.");
    } finally {
      if (runId === runRef.current) setBusy(false);
    }
  };

  const handleSubmitText = async () => {
    const clean = customPrompt.trim();
    if (!clean) return;
    const runId = ++runRef.current;
    setBusy(true);
    setError(null);
    try {
      const { ids, source } = await runFreeTextSearch(clean);
      if (runId !== runRef.current) return;
      onResults({ ids, label: clean, source });
      setOpen(false);
      setCustomPrompt("");
    } catch (err) {
      console.error("Free text search failed", err);
      if (runId !== runRef.current) return;
      setError("Não consegui buscar agora. Tente novamente.");
    } finally {
      if (runId === runRef.current) setBusy(false);
    }
  };

  // Auto-close em ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy]);

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        disabled={busy}
        className="group inline-flex h-12 items-center gap-3 rounded-full border border-white/10 bg-[#050505] px-6 text-[14px] font-semibold tracking-[-0.01em] text-white shadow-[0_14px_30px_rgba(0,0,0,0.20),inset_0_1px_0_rgba(255,255,255,0.09)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-black disabled:cursor-wait disabled:opacity-70"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full text-white transition-transform duration-300 group-hover:-rotate-12">
          <SaturnIcon />
        </span>
        Atlas
      </button>

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="atlas-shell"
                className="fixed inset-x-0 top-5 z-[120] pointer-events-none px-4 text-white"
                initial={{ opacity: 0, y: -18, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] as const }}
              >
                <div className="mx-auto w-[min(100%,680px)] space-y-3">
                  <form
                    aria-label="Atlas — busca no catálogo"
                    className="pointer-events-auto flex h-[74px] items-center gap-3 rounded-full border border-white/10 bg-[#242424] px-3 shadow-[0_18px_48px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(255,255,255,0.08)]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleSubmitText();
                    }}
                  >
                    <VeloOrb active={busy} />
                    <input
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      disabled={busy}
                      placeholder="Digite o produto, nicho ou estilo que você quer vender..."
                      className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium text-white outline-none placeholder:text-white/38 disabled:cursor-wait"
                    />
                    <button
                      type="submit"
                      disabled={!customPrompt.trim() || busy}
                      className="hidden h-10 rounded-full bg-white px-4 text-[12px] font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-35 sm:inline-flex sm:items-center"
                    >
                      Buscar
                    </button>
                  </form>

                  <div className="pointer-events-auto rounded-[22px] border border-white/10 bg-[#242424] px-3 py-3 shadow-[0_22px_60px_rgba(0,0,0,0.26),inset_0_1px_0_rgba(255,255,255,0.08)]">
                    <div className="flex items-center gap-3">
                      <VeloOrb active={busy} />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-[14px] font-medium tracking-[-0.01em] text-white">
                          {busy
                            ? "Atlas pensando..."
                            : error
                              ? error
                              : "Que tipo de produto você quer encontrar hoje?"}
                        </h2>
                      </div>
                      {!busy && (
                        <button
                          type="button"
                          onClick={close}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/32 transition-colors hover:bg-white/10 hover:text-white"
                          aria-label="Fechar Atlas"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>

                    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {scoutPreferences.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void handlePreference(p.id, p.label)}
                          className="shrink-0 rounded-full bg-white/[0.075] px-3.5 py-2 text-[12px] font-medium text-white/84 transition-colors hover:bg-white/[0.13] hover:text-white disabled:cursor-wait disabled:opacity-50"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
};

export default ProductScoutAI;
