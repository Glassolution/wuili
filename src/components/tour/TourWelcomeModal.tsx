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

// Badge circular do ícone: leve destaque de fundo, borda sutil e um brilho
// interno para dar volume — tudo em tons de branco/cinza (sem cor).
const iconBadgeStyle: CSSProperties = {
  background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 100%)",
  border: "1px solid rgba(255,255,255,0.12)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 8px 24px rgba(0,0,0,0.45)",
};

// Glow discreto atrás do badge — radial monocromático (cinza/branco), sem
// gradiente colorido, apenas para separar o ícone do fundo escuro do card.
const iconGlowStyle: CSSProperties = {
  background:
    "radial-gradient(circle, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 40%, rgba(255,255,255,0) 70%)",
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
            className="relative w-full max-w-[420px] rounded-[16px] px-8 pb-7 pt-11 text-center"
          >
            {/* Fechar (X) — canto superior direito. */}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Fechar"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-[8px] text-[#6B6B6B] transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={18} strokeWidth={1.5} />
            </button>

            {/* Ícone central dentro de badge circular com glow monocromático. */}
            <div className="relative mx-auto grid h-16 w-16 place-items-center">
              <span
                aria-hidden
                className="pointer-events-none absolute -inset-4 rounded-full blur-[6px]"
                style={iconGlowStyle}
              />
              <span
                className="relative grid h-16 w-16 place-items-center rounded-full text-white"
                style={iconBadgeStyle}
              >
                <Sparkles size={26} strokeWidth={1.5} />
              </span>
            </div>

            <h2 className="mt-5 text-[20px] font-semibold tracking-[-0.01em] text-white">
              {firstName ? `Bem-vindo, ${firstName}!` : "Bem-vindo à Velo!"}
            </h2>
            <p className="mx-auto mt-2.5 max-w-[320px] text-[13.5px] leading-[20px] text-[#8A8A8A]">
              Quer um tour rápido pela plataforma? Vamos mostrar o que cada área faz e como
              usar — leva menos de um minuto.
            </p>

            <div className="mt-8 flex items-center justify-between gap-3">
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
                <ArrowRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
