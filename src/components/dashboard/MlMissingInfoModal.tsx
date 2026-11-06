import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink, MapPin, RefreshCw } from "lucide-react";
import { infoFaltanteDoVendedor } from "@/lib/mlSellerBlocked";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";

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
  const [verificando, setVerificando] = useState(false);
  const info = infoFaltanteDoVendedor(sellerCodes);

  // "Já fiz, verificar de novo": pergunta de novo ao Mercado Livre se a conta
  // já está apta (e se o Mercado Envios já foi ativado). Liberou → fecha o
  // modal e a pessoa publica na hora; ainda não → aviso para tentar depois.
  const verificarDeNovo = async () => {
    if (verificando) return;
    setVerificando(true);
    try {
      const { data } = await supabase.functions.invoke("ml-seller-status");
      const liberado =
        data?.connected === true && data?.canList === true && data?.shippingBlocked !== true;
      if (liberado) {
        veloToast.success("Tudo certo! Sua conta já está liberada. Pode publicar.");
        onClose();
      } else if (data?.shippingBlocked === true) {
        veloToast.info("O Mercado Envios ainda não está ativo na sua conta. Conclua o anúncio de teste no Mercado Livre e tente de novo.");
      } else {
        veloToast.info("O Mercado Livre ainda não liberou sua conta. Aguarde alguns minutos e tente de novo.");
      }
    } catch {
      veloToast.error("Não consegui verificar agora. Tente de novo em instantes.");
    } finally {
      setVerificando(false);
    }
  };

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
            <button
              onClick={() => void verificarDeNovo()}
              disabled={verificando}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full border border-[#2563EB]/25 bg-[#EFF4FF] px-5 py-2.5 text-[13.5px] font-semibold text-[#2563EB] transition-colors hover:bg-[#E2EBFF] disabled:opacity-60"
            >
              <RefreshCw size={14} className={verificando ? "animate-spin" : ""} />
              {verificando ? "Verificando..." : "Já fiz, verificar de novo"}
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
