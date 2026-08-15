import { useEffect, useState } from "react";
import { KeyRound, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const KEY_TYPES = [
  { value: "cpf", label: "CPF/CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "telefone", label: "Telefone" },
  { value: "aleatoria", label: "Chave aleatória" },
];

type Props = { open: boolean; onClose: () => void };

export default function PixKeyModal({ open, onClose }: Props) {
  const { user } = useAuth();
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoading(true);
    supabase
      .from("profiles")
      .select("pix_key,pix_key_type")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const row = data as { pix_key?: string | null; pix_key_type?: string | null } | null;
        setPixKey(row?.pix_key ?? "");
        setPixKeyType(row?.pix_key_type ?? "cpf");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, user]);

  if (!open) return null;

  const handleSave = async () => {
    const value = pixKey.trim();
    if (!user) return;
    if (!value) {
      toast.error("Informe sua chave Pix.");
      return;
    }
    if (value.length > 140) {
      toast.error("Chave Pix muito longa.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ pix_key: value, pix_key_type: pixKeyType } as never)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível salvar sua chave Pix.");
      return;
    }
    toast.success("Chave Pix salva com sucesso!");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black text-white">
              <KeyRound size={16} strokeWidth={1.9} />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-[#18191c]">Chave Pix</h2>
              <p className="text-[12px] text-[#6b7280]">Onde você vai receber o valor das suas vendas.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1 text-[#6b7280] hover:bg-[#f2f2f0]" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex h-28 items-center justify-center text-[#6b7280]">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#34373c]">Tipo de chave</label>
              <select
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
                className="w-full rounded-lg border border-[#e4e4e1] bg-white px-3 py-2 text-[13px] text-[#18191c] outline-none focus:border-black"
              >
                {KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold text-[#34373c]">Chave Pix</label>
              <input
                value={pixKey}
                maxLength={140}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Digite sua chave Pix"
                className="w-full rounded-lg border border-[#e4e4e1] bg-white px-3 py-2 text-[13px] text-[#18191c] outline-none focus:border-black"
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#18191c] disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : null}
              Salvar chave Pix
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
