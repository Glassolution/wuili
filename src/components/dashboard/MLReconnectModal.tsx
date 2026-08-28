import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, RefreshCw, AlertTriangle } from "lucide-react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { veloToast } from "@/components/ui/velo-toast";
import { startMercadoLivreOAuth, ML_CONNECT_FALLBACK_MESSAGE } from "@/lib/mercadoLivreOAuth";

const DISMISS_KEY = "velo:ml-reconnect-modal-dismissed";

/**
 * Aviso de reconexão do Mercado Livre para sellers com plano pago ativo cuja
 * integração está com token expirado (RPC `rpc_ml_reconnect_required`).
 *
 * O "Agora não" usa sessionStorage: some na sessão atual, mas volta no próximo
 * login. Só para de aparecer de vez quando o seller reconecta (a RPC passa a
 * devolver false).
 */
const MLReconnectModal = () => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const dentroDoPainel = location.pathname.startsWith("/dashboard");
  // Pré-visualização visual do modal (QA), sem consultar o backend.
  const previewQA = new URLSearchParams(location.search).get("velo_ml_reconnect") === "preview";

  useEffect(() => {
    if (previewQA) {
      setOpen(true);
      return;
    }
    if (loading || !user || !dentroDoPainel) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    let ativo = true;
    (async () => {
      const { data, error } = await supabase.rpc("rpc_ml_reconnect_required" as never);
      if (!ativo || error) return;
      if (data === true) setOpen(true);
    })();

    return () => {
      ativo = false;
    };
  }, [user, loading, dentroDoPainel, previewQA]);

  const fechar = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  };

  const reconectar = async () => {
    setConnecting(true);
    try {
      await startMercadoLivreOAuth();
    } catch {
      veloToast.error(ML_CONNECT_FALLBACK_MESSAGE);
    } finally {
      setConnecting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="absolute inset-0 bg-[#0A0F1F]/45 backdrop-blur-[3px]"
            onClick={fechar}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Sua conta do Mercado Livre foi desconectada"
            initial={{ opacity: 0, y: 24, scale: 0.965 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.975 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-[440px] overflow-hidden rounded-[22px] bg-white p-7 shadow-[0_40px_120px_-30px_rgba(8,20,60,0.55)] sm:p-8"
            data-testid="ml-reconnect-modal"
          >
            <button
              onClick={fechar}
              aria-label="Fechar"
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full border border-black/[0.06] bg-white text-[#0A0A0A] shadow-[0_2px_10px_rgba(120,80,40,0.18)] transition-shadow hover:shadow-[0_4px_14px_rgba(120,80,40,0.28)]"
            >
              <X size={16} />
            </button>

            <span className="grid h-11 w-11 place-items-center rounded-full bg-[#FFF3E4]">
              <AlertTriangle size={20} className="text-[#D97706]" />
            </span>

            <h2 className="mt-4 font-['Inter_Tight',_Inter,_sans-serif] text-[22px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#0A0A0A]">
              Sua conta do Mercado Livre foi desconectada
            </h2>
            <p className="mt-2.5 text-[13.5px] leading-[1.6] text-[#5C5F66]">
              Identificamos que a conexão da sua conta do Mercado Livre com a Velo expirou. Isso está
              impedindo que seus anúncios sejam publicados, atualizados ou tenham o estoque sincronizado
              corretamente.
            </p>

            <button onClick={reconectar} disabled={connecting} className="btn-primary btn-primary--md mt-6 w-full">
              <RefreshCw size={14} className={connecting ? "animate-spin" : undefined} />
              {connecting ? "Abrindo Mercado Livre..." : "Reconectar agora"}
            </button>
            <button
              onClick={fechar}
              className="mt-2.5 w-full rounded-full py-2.5 text-[13px] font-medium text-[#5C5F66] transition-colors hover:bg-black/[0.04]"
            >
              Agora não
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default MLReconnectModal;
