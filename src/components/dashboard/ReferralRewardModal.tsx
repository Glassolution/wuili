import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Mail, CreditCard, Gift } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Abre o modal de convite (opcional). */
  onInvite?: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    icon: Mail,
    title: "Convide um amigo",
    text: "Envie o convite pelo botão “Convidar amigo” aqui do painel, usando o email dele.",
  },
  {
    icon: CreditCard,
    title: "Ele assina a Velo",
    text: "Seu amigo ganha 15% de desconto na primeira assinatura e conclui o pagamento.",
  },
  {
    icon: Gift,
    title: "Você ganha 3 meses grátis",
    text: "Assim que o pagamento é confirmado, sua renovação é adiada em 3 meses, sem cobrança nesse período.",
  },
];

const ReferralRewardModal = ({ open, onClose, onInvite }: Props) => {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 px-4 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Como ganhar 3 meses grátis"
            className="w-full max-w-[480px] rounded-[22px] bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
            initial={{ opacity: 0, y: reduceMotion ? 0 : 14, scale: reduceMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduceMotion ? 0 : 10, scale: reduceMotion ? 1 : 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.22, ease: EASE }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-[19px] font-bold tracking-[-0.01em] text-[#0F1117]">
                  Ganhe 3 meses grátis
                </h2>
                <p className="mt-1 text-[13.5px] leading-[1.5] text-[#6B6B72]">
                  Indique a Velo para um amigo. Quando ele pagar a assinatura, você ganha 3 meses
                  grátis na sua.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="rounded-full p-1.5 text-[#8A8A93] transition hover:bg-black/[0.05] hover:text-[#0F1117]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {STEPS.map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-3 rounded-[14px] border border-black/[0.07] p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#EEF2FF] text-[#2563EB]">
                    <Icon size={17} />
                  </span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#0F1117]">{title}</p>
                    <p className="mt-0.5 text-[13px] leading-[1.5] text-[#6B6B72]">{text}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4 text-[12.5px] leading-[1.55] text-[#8A8A93]">
              A recompensa é cumulativa: cada amigo que assinar soma mais 3 meses, sem limite. O
              benefício é permanente — não tem prazo para acabar. Cada convite gera a recompensa uma
              única vez.
            </p>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              {onInvite ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onInvite();
                  }}
                  className="inline-flex h-[44px] flex-1 items-center justify-center rounded-[12px] bg-[#0F1117] text-[14px] font-semibold text-white transition hover:bg-[#22242c]"
                >
                  Convidar um amigo
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-[44px] items-center justify-center rounded-[12px] px-4 text-[14px] font-medium text-[#6B6B72] transition hover:bg-black/[0.04] hover:text-[#0F1117]"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default ReferralRewardModal;
