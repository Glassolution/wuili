import { type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles, X } from "lucide-react";

type TourWelcomeModalProps = {
  open: boolean;
  /** Primeiro nome do usuário, usado na saudação. */
  firstName?: string;
  /** Usuário aceitou fazer o tour. */
  onStart: () => void;
  /** Usuário dispensou (fechar ou "Agora não") — não reaparece. */
  onDismiss: () => void;
};

const cardStyle: CSSProperties = {
  background: "#1E1E1E",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
};

const primaryButtonStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0) 15%), #2A2A2A",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.10)",
  textShadow: "0 1px 2px rgba(0,0,0,0.40)",
};

export default function TourWelcomeModal({
  open,
  firstName,
  onStart,
  onDismiss,
}: TourWelcomeModalProps) {
  const reduce = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="tour-welcome-backdrop"
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[190] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[3px]"
          onClick={onDismiss}
          role="dialog"
          aria-modal="true"
          aria-label="Convite para o tour guiado"
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 32, mass: 0.9 }}
            onClick={(e) => e.stopPropagation()}
            style={cardStyle}
            className="w-full max-w-[440px] rounded-[16px] p-6"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] border border-white/[0.08] bg-white/[0.07] text-white">
                <Sparkles size={20} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-white">
                  {firstName ? `Bem-vindo, ${firstName}!` : "Bem-vindo à Velo!"}
                </h2>
                <p className="mt-1.5 text-[13.5px] leading-[20px] text-[#8A8A8A]">
                  Quer um tour rápido pela plataforma? Vamos mostrar o que cada área faz e como
                  usar — leva menos de um minuto.
                </p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Fechar"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={18} strokeWidth={1.9} />
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onDismiss}
                className="text-[13.5px] font-medium text-white/60 transition-colors hover:text-white"
              >
                Agora não
              </button>
              <button
                type="button"
                onClick={onStart}
                style={primaryButtonStyle}
                className="inline-flex h-11 items-center gap-2 rounded-[10px] px-5 text-[14.5px] font-medium text-white"
              >
                Fazer o tour
                <ArrowRight size={16} strokeWidth={2} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
