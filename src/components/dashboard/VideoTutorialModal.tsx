import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** URL do player (ex.: https://player.vimeo.com/video/<id>?...) */
  src: string;
  /**
   * Proporção do vídeo como padding-top em porcentagem (altura / largura).
   * O embed do Vimeo entrega esse número junto com o código.
   */
  aspectPadding?: string;
};

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/*
  Modal de vídeo: abre por cima de outro modal (z acima do de verificação do ML).
  O iframe só é montado enquanto está aberto — assim o player para de tocar
  ao fechar, sem precisar falar com a API do Vimeo.
*/
const VideoTutorialModal = ({
  open,
  onClose,
  title,
  description,
  src,
  aspectPadding = "56.25%",
}: Props) => {
  // Trava a rolagem do fundo enquanto o vídeo está aberto.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-0 bg-[#0A0F1F]/70 backdrop-blur-[3px]"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 18, scale: 0.975 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.34, ease: EASE_OUT }}
            className="relative w-full max-w-[880px] max-h-[92vh] overflow-y-auto rounded-[18px] bg-white p-5 shadow-[0_40px_120px_-30px_rgba(8,20,60,0.6)] sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="font-['Inter_Tight',_Inter,_sans-serif] text-[18px] font-semibold tracking-[-0.02em] text-[#0A0A0A]">
                  {title}
                </h3>
                {description && (
                  <p className="mt-1 text-[13.5px] leading-[1.5] text-[#5C5F66]">{description}</p>
                )}
              </div>

              <button
                onClick={onClose}
                aria-label="Fechar vídeo"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[#6B6B6B] transition-colors duration-150 hover:bg-black/[0.05] hover:text-[#0A0A0A]"
              >
                <X size={18} />
              </button>
            </div>

            <div
              className="relative mt-4 overflow-hidden rounded-[12px] bg-black"
              style={{ paddingTop: aspectPadding }}
            >
              <iframe
                src={src}
                title={title}
                frameBorder="0"
                allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute left-0 top-0 h-full w-full"
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default VideoTutorialModal;
