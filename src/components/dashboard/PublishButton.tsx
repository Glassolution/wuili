import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";

type Props = {
  label: string;
  loading: boolean;
  /** Textos exibidos em sequência enquanto carrega (o último fica até terminar). */
  loadingLabels?: string[];
  onClick: () => void;
  disabled?: boolean;
};

const EASE = [0.22, 1, 0.36, 1] as const;
const PHASE_MS = 2200;

/**
 * Botão principal de publicação: troca o texto com transição suave, mostra um
 * spinner e um brilho percorrendo o botão enquanto o Mercado Livre responde,
 * para a pessoa nunca ficar olhando para um botão parado.
 */
export function PublishButton({ label, loading, loadingLabels = ["Publicando…"], onClick, disabled }: Props) {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const labelsKey = loadingLabels.join("|");

  useEffect(() => {
    setPhase(0);
    if (!loading || loadingLabels.length < 2) return;
    const id = window.setInterval(() => {
      setPhase((p) => Math.min(p + 1, loadingLabels.length - 1));
    }, PHASE_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, labelsKey]);

  const text = loading ? loadingLabels[Math.min(phase, loadingLabels.length - 1)] : label;
  const offset = reduceMotion ? 0 : 6;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      aria-live="polite"
      whileTap={reduceMotion || loading ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.15, ease: EASE }}
      className={`relative inline-flex h-11 min-w-[210px] items-center justify-center overflow-hidden rounded-full px-6 text-[13px] font-semibold text-white transition-[background-color,box-shadow] duration-300 ${
        loading
          ? "cursor-progress bg-[#1D4ED8] shadow-[0_6px_16px_rgba(37,99,235,0.18)]"
          : "bg-[#2563EB] shadow-[0_10px_24px_rgba(37,99,235,0.24)] hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-45"
      }`}
    >
      <AnimatePresence>
        {loading && !reduceMotion && (
          <motion.span
            key="sheen"
            aria-hidden
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            initial={{ x: "0%", opacity: 0 }}
            animate={{ x: "300%", opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              x: { duration: 1.6, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.2 },
              opacity: { duration: 0.2 },
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={text}
          className="relative flex items-center gap-2 whitespace-nowrap"
          initial={{ opacity: 0, y: offset }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -offset }}
          transition={{ duration: 0.2, ease: EASE }}
        >
          {loading && <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />}
          {text}
          {!loading && <ArrowRight size={13} />}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}

/** Ícone de sucesso: círculo entra com mola e o check é "desenhado". */
export function PublishSuccessMark({ color = "#2563EB" }: { color?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="relative mb-5 h-14 w-14">
      {!reduceMotion && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ background: color }}
          initial={{ scale: 1, opacity: 0.35 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.9, delay: 0.25, ease: EASE }}
        />
      )}
      <motion.div
        className="relative flex h-14 w-14 items-center justify-center rounded-full"
        style={{ background: color }}
        initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="white"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.4, delay: 0.18, ease: EASE }}
          />
        </svg>
      </motion.div>
    </div>
  );
}
