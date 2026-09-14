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
    title: "Você ganha 15% também",
    text: "Assim que o pagamento dele é confirmado, seus 15% ficam liberados e entram automaticamente na sua primeira assinatura.",
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
            aria-label="Como ganhar 15% de desconto"
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
                  15% de desconto para os dois
                </h2>
                <p className="mt-1 text-[13.5px] leading-[1.5] text-[#6B6B72]">
                  Indique a Velo para um amigo. Quando ele assinar, vocês dois ganham 15% de
                  desconto na primeira assinatura.
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
              O desconto vale na primeira assinatura de cada um e não acumula com cupom (vale o
              maior). Se você já tem um plano pago, o benefício não se aplica à sua conta.
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
