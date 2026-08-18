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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/45 px-4 backdrop-blur-[3px]">
      <div className="w-full max-w-md overflow-hidden rounded-[24px] border border-[#D8E3F8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.18)]">
        <div className="h-1.5 bg-[#2563EB]" />
        <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-[#2563EB] text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]">
              <KeyRound size={16} strokeWidth={1.9} />
            </span>
            <div>
              <h2 className="text-[18px] font-black tracking-[-0.035em] text-[#020817]">Chave Pix</h2>
              <p className="mt-0.5 text-[12px] font-medium text-[#64748B]">Onde você vai receber o valor das suas vendas.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#64748B] transition hover:bg-[#EFF6FF] hover:text-[#2563EB]" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="flex h-28 items-center justify-center text-[#2563EB]">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#334155]">Tipo de chave</label>
              <select
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
                className="h-11 w-full rounded-[14px] border border-[#D8E3F8] bg-white px-3 text-[13px] font-semibold text-[#020817] outline-none transition focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
              >
                {KEY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-bold text-[#334155]">Chave Pix</label>
              <input
                value={pixKey}
                maxLength={140}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Digite sua chave Pix"
                className="h-11 w-full rounded-[14px] border border-[#D8E3F8] bg-white px-3 text-[13px] font-semibold text-[#020817] outline-none transition placeholder:text-[#94A3B8] focus:border-[#2563EB] focus:ring-4 focus:ring-[#2563EB]/10"
              />
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[#2563EB] px-4 text-[13px] font-black text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : null}
              Salvar chave Pix
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
