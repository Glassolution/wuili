import { useState } from "react";
import { X, Mail, Loader2, Check, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { veloToast as toast } from "@/components/ui/velo-toast";

type Props = {
  open: boolean;
  onClose: () => void;
};

export const InviteFriendModal = ({ open, onClose }: Props) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

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
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
          aria-label="Fechar"
        >
          <X size={18} />
        </button>

        {!sent ? (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-black">
              <Mail size={22} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900">Convide um amigo</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Se ele assinar um plano, vocês dois ganham 15% de desconto na primeira assinatura.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-600">Email do amigo</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="amigo@exemplo.com"
                  className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-black focus:outline-none focus:ring-2 focus:ring-black/10"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Enviando...
                  </>
                ) : (
                  "Enviar convite"
                )}
              </button>
              <p className="text-[11px] text-zinc-400">
                O convite expira em 7 dias. Você pode ter até 10 convites ativos ao mesmo tempo.
              </p>
            </form>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500">
              <Check size={22} className="text-white" />
            </div>
            <h2 className="text-xl font-semibold text-zinc-900">Convite enviado!</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Enviamos um email para <span className="font-medium text-zinc-800">{sent.email}</span>.
              Você também pode compartilhar o link diretamente.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
              <input
                readOnly
                value={sent.url}
                className="flex-1 truncate bg-transparent px-2 text-xs text-zinc-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={copyLink}
                className="flex items-center gap-1 rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="flex-1 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Convidar outro
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                Concluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default InviteFriendModal;
