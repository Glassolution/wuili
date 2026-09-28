import { useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowRight, Copy, ExternalLink, ShieldCheck, X } from "lucide-react";
import { veloToast } from "@/components/ui/velo-toast";
import { ehNavegadorInternoDeApp } from "@/lib/mlConexao";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Chamado quando a pessoa confirma que quer ir ao Mercado Livre. */
  onConfirm: () => void;
  /** Texto do botão principal (ex.: "Reconectar minha conta"). */
  confirmLabel?: string;
};

/**
 * Tela curta antes de mandar a pessoa ao Mercado Livre.
 *
 * Só afirma o que a integração realmente faz hoje: publica e atualiza anúncios,
 * sincroniza preço/estoque e acompanha pedidos. A Velo não vê senha nem tem
 * acesso ao dinheiro da conta — o login acontece no site do Mercado Livre.
 */
const MLConnectPrepareModal = ({ open, onClose, onConfirm, confirmLabel = "Ir para o Mercado Livre" }: Props) => {
  const [copiado, setCopiado] = useState(false);
  if (!open) return null;

  const navegadorInterno = ehNavegadorInternoDeApp();

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      veloToast.success("Link copiado. Cole no Chrome ou no Safari.");
    } catch {
      veloToast.error("Não foi possível copiar. Use o menu do app e escolha “Abrir no navegador”.");
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[96] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-[#0A0F1F]/45 backdrop-blur-[3px]" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Conectar sua conta do Mercado Livre"
        className="relative w-full max-w-[460px] rounded-t-[22px] bg-white p-6 shadow-[0_40px_120px_-30px_rgba(8,20,60,0.55)] sm:rounded-[22px] sm:p-7"
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-black/[0.06] bg-white text-[#0A0A0A]"
        >
          <X size={16} />
        </button>

        <span className="grid h-11 w-11 place-items-center rounded-full bg-[#EFF4FF]">
          <ShieldCheck size={20} className="text-[#2563EB]" />
        </span>

        <h2 className="mt-4 text-[21px] font-semibold leading-[1.2] tracking-[-0.02em] text-[#0A0A0A]">
          Vamos conectar sua conta do Mercado Livre
        </h2>
        <p className="mt-2 text-[13.5px] leading-[1.6] text-[#5C5F66]">
          É rápido e você só faz isso uma vez.
        </p>

        <ol className="mt-4 space-y-3">
          {[
            "Você vai para o site do Mercado Livre e entra na sua conta.",
            "Toque em “Permitir” para autorizar a Velo.",
            "Você volta sozinho para cá, com seu produto e seu preço do jeito que estavam.",
          ].map((texto, i) => (
            <li key={texto} className="flex gap-3">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#EFF4FF] text-[12px] font-bold text-[#2563EB]">
                {i + 1}
              </span>
              <p className="text-[13.5px] leading-[1.55] text-[#3F4450]">{texto}</p>
            </li>
          ))}
        </ol>

        <div className="mt-4 rounded-xl bg-[#F6F7F9] p-3.5">
          <p className="text-[12.5px] font-semibold text-[#0A0A0A]">O que a Velo faz na sua conta</p>
          <p className="mt-1 text-[12.5px] leading-[1.55] text-[#5C5F66]">
            Cria e atualiza seus anúncios, ajusta preço e estoque e acompanha seus pedidos. Sua senha é digitada
            só no site do Mercado Livre — a Velo não vê sua senha.
          </p>
        </div>

        {navegadorInterno && (
          <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="text-[12.5px] font-semibold text-amber-900">
                Você está dentro do app do Instagram ou do TikTok
              </p>
              <p className="mt-1 text-[12.5px] leading-[1.55] text-amber-800">
                Aqui a conexão costuma falhar. Abra a Velo no Chrome ou no Safari e conecte por lá.
              </p>
              <button
                type="button"
                onClick={copiarLink}
                className="mt-2.5 inline-flex min-h-10 items-center gap-2 rounded-full bg-amber-600 px-4 text-[12.5px] font-semibold text-white"
              >
                <Copy size={14} />
                {copiado ? "Link copiado" : "Copiar link da página"}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#2563EB] px-5 text-[15px] font-semibold text-white"
        >
          {confirmLabel}
          {navegadorInterno ? <ExternalLink size={15} /> : <ArrowRight size={15} />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-full py-3 text-[13px] font-medium text-[#5C5F66]"
        >
          Agora não
        </button>
      </div>
    </div>,
    document.body,
  );
};

export default MLConnectPrepareModal;
