import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, MapPin } from "lucide-react";
import { infoFaltanteDoVendedor } from "@/lib/mlSellerBlocked";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Códigos crus devolvidos pela `ml-publish` (ex.: ["address_pending"]). */
  sellerCodes?: string[];
};

/*
  Modal exibido quando o Mercado Livre bloqueia a publicação por cadastro
  incompleto. Em vez do tutorial genérico, ele diz exatamente o que falta
  (endereço, telefone, identidade…) e guia o preenchimento passo a passo.
*/
const MlMissingInfoModal = ({ open, onClose, sellerCodes }: Props) => {
  const [visible, setVisible] = useState(false);
  const info = infoFaltanteDoVendedor(sellerCodes);

  useEffect(() => {
    setVisible(open);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return createPortal(
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 bg-[#0A0F1F]/45 backdrop-blur-[3px]"
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={info.titulo}
            initial={{ opacity: 0, y: 24, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.975 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[440px] overflow-hidden rounded-[22px] bg-white p-7 shadow-[0_40px_120px_-30px_rgba(8,20,60,0.55)] sm:p-8"
          >
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-black/[0.06] bg-white text-[#0A0A0A] shadow-[0_2px_10px_rgba(120,80,40,0.18)] transition-shadow hover:shadow-[0_4px_14px_rgba(120,80,40,0.28)]"
            >
              <X size={16} />
            </button>

            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FFF3E4]">
              <MapPin size={20} className="text-[#D97706]" />
            </span>

            <h2 className="mt-4 font-['Inter_Tight',_Inter,_sans-serif] text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#0A0A0A]">
              {info.titulo}
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-[1.6] text-[#5C5F66]">{info.explicacao}</p>

            <ol className="mt-5 space-y-2.5">
              {info.passos.map((passo, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#EFF4FF] text-[11px] font-bold text-[#2563EB]">
                    {i + 1}
                  </span>
                  <span className="text-[13px] leading-[1.55] text-[#3A3D44]">{passo}</span>
                </li>
              ))}
            </ol>

            <button
              onClick={() => window.open(info.url, "_blank", "noopener,noreferrer")}
              className="btn-primary btn-primary--md mt-6 w-full"
            >
              {info.botao}
              <ExternalLink size={14} />
            </button>
            <p className="mt-3 text-center text-[12px] leading-[1.5] text-[#8A8F98]">
              Depois de preencher lá, volte e toque em publicar de novo.
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default MlMissingInfoModal;
