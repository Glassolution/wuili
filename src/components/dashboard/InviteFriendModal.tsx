import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X, Mail, Loader2, Check, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { veloToast as toast } from "@/components/ui/velo-toast";

type Props = {
  open: boolean;
  onClose: () => void;
};

const EASE = [0.22, 1, 0.36, 1] as const;

export const InviteFriendModal = ({ open, onClose }: Props) => {
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setSent(null);
    setCopied(false);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Digite um email válido.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("create-referral", {
      body: { email: trimmed },
    });
    setLoading(false);
    if (error || !data?.ok) {
      const msg = (data as { error?: string })?.error || "Não foi possível enviar o convite.";
      toast.error(msg);
      return;
    }
    setSent({ email: trimmed, url: (data as { invite_url: string }).invite_url });
    toast.success("Convite enviado!");
  };

  const copyLink = async () => {
    if (!sent) return;
    await navigator.clipboard.writeText(sent.url);
    setCopied(true);
    toast.success("Link copiado.");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Convide um amigo"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: EASE }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0B0D12]/50 p-4 backdrop-blur-[3px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleClose();
          }}
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="relative w-full max-w-[420px] overflow-hidden rounded-[18px] bg-white shadow-[0_28px_80px_rgba(11,13,18,0.28)]"
          >
            <button
              type="button"
              onClick={handleClose}
              className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-white/65 transition hover:bg-white/15 hover:text-white"
              aria-label="Fechar"
            >
              <X size={16} strokeWidth={2.2} />
            </button>

            {/* Painel de cor com o ícone centralizado, como no exemplo. */}
            {/* O ícone é centralizado pelo flex do container: o framer-motion
                escreve `transform` inline e apagaria um -translate-x/y do Tailwind. */}
            <div className="relative grid h-[150px] place-items-center overflow-hidden bg-gradient-to-br from-[#5B93FF] via-[#2563EB] to-[#1E3A8A]">
              <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border border-white/15" />
              <div className="pointer-events-none absolute -left-16 -bottom-20 h-48 w-48 rounded-full border border-white/10" />
              <motion.span
                initial={reduceMotion ? false : { scale: 0.82, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.36, ease: EASE, delay: 0.05 }}
                className="relative grid h-[68px] w-[68px] place-items-center rounded-[20px] bg-white/18 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] backdrop-blur"
              >
                {sent ? <Check size={30} strokeWidth={2.2} /> : <Mail size={28} strokeWidth={2} />}
              </motion.span>
            </div>

            {!sent ? (
              <div className="px-6 pb-6 pt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] font-bold tracking-[-0.03em] text-[#0F1117]">Convide um amigo</h2>
                  <span className="rounded-full bg-[#EAF1FF] px-2 py-0.5 text-[10.5px] font-bold text-[#2563EB]">
                    15% para os dois
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-[#6B6B72]">
                  Quando ele assinar um plano, vocês dois ganham 15% de desconto na primeira assinatura.
                </p>

                <form onSubmit={handleSubmit} className="mt-4">
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="amigo@exemplo.com"
                    className="h-[44px] w-full rounded-[12px] border border-black/[0.1] bg-[#F7F8FA] px-4 text-[13.5px] font-medium text-[#0F1117] outline-none transition placeholder:text-black/30 focus:border-[#2563EB]/60 focus:bg-white focus:ring-4 focus:ring-[#2563EB]/12"
                  />

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[12px] bg-[#0F1117] px-5 text-[13.5px] font-semibold text-white transition hover:bg-[#26262C] disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={15} className="animate-spin" /> Enviando...
                        </>
                      ) : (
                        "Enviar convite"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={handleClose}
                      className="inline-flex h-[42px] items-center justify-center rounded-[12px] px-4 text-[13.5px] font-medium text-[#6B6B72] transition hover:bg-black/[0.04] hover:text-[#0F1117]"
                    >
                      Agora não
                    </button>
                  </div>
                </form>

                <p className="mt-3 text-[11px] leading-[1.5] text-[#9A9AA0]">
                  O convite expira em 7 dias. Até 10 convites ativos ao mesmo tempo.
                </p>
              </div>
            ) : (
              <div className="px-6 pb-6 pt-5">
                <h2 className="text-[17px] font-bold tracking-[-0.03em] text-[#0F1117]">Convite enviado</h2>
                <p className="mt-1.5 text-[13px] leading-[1.5] text-[#6B6B72]">
                  Mandamos um e-mail para <span className="font-semibold text-[#0F1117]">{sent.email}</span>. Se preferir,
                  compartilhe o link direto.
                </p>

                <div className="mt-4 flex items-center gap-2 rounded-[12px] border border-black/[0.09] bg-[#F7F8FA] p-1.5 pl-3">
                  <input
                    readOnly
                    value={sent.url}
                    className="min-w-0 flex-1 truncate bg-transparent text-[12px] text-[#6B6B72] outline-none"
                  />
                  <button
                    type="button"
                    onClick={copyLink}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[9px] bg-white px-3 text-[12px] font-semibold text-[#0F1117] shadow-[0_1px_3px_rgba(15,17,23,0.12)] transition hover:bg-[#FAFAFA]"
                  >
                    {copied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.2} />}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="inline-flex h-[42px] flex-1 items-center justify-center rounded-[12px] bg-[#0F1117] px-5 text-[13.5px] font-semibold text-white transition hover:bg-[#26262C]"
                  >
                    Concluir
                  </button>
                  <button
                    type="button"
                    onClick={reset}
                    className="inline-flex h-[42px] items-center justify-center rounded-[12px] px-4 text-[13.5px] font-medium text-[#6B6B72] transition hover:bg-black/[0.04] hover:text-[#0F1117]"
                  >
                    Convidar outro
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default InviteFriendModal;
