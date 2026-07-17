import { useRef, useState } from "react";
import { X, Upload, Loader2, Store as StoreIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { veloToast } from "@/components/ui/velo-toast";

export type CreateSalesPagePayload = {
  storeName: string;
  storeLogoUrl: string | null;
  storeDescription: string;
};

type Props = {
  open: boolean;
  productTitle: string;
  onClose: () => void;
  onConfirm: (payload: CreateSalesPagePayload) => Promise<void> | void;
};

const CreateSalesPageModal = ({ open, productTitle, onClose, onConfirm }: Props) => {
  const [storeName, setStoreName] = useState("");
  const [storeDescription, setStoreDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      veloToast.error("Envie um arquivo de imagem.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      veloToast.error("A imagem deve ter no máximo 5MB.");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id ?? "anon";
      const ext = file.name.split(".").pop() || "png";
      const path = `store-logos/${uid}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("assets").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("assets").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (err) {
      console.error(err);
      veloToast.error("Falha ao enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!storeName.trim()) {
      veloToast.error("Digite o nome da loja.");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm({
        storeName: storeName.trim(),
        storeLogoUrl: logoUrl,
        storeDescription: storeDescription.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-[15px] font-semibold text-[#1a1c1c]">Criar página de vendas</h2>
            <p className="text-[11px] text-gray-500 truncate max-w-[300px]">{productTitle}</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-40"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Logo */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1c1c] mb-2">Logo / Foto da loja</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-16 w-16 shrink-0 rounded-xl border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden hover:border-gray-400 transition"
              >
                {uploading ? (
                  <Loader2 size={18} className="animate-spin text-gray-400" />
                ) : logoUrl ? (
                  <img src={logoUrl} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  <StoreIcon size={20} className="text-gray-400" />
                )}
              </button>
              <div className="flex-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1a1c1c] hover:bg-gray-50 transition"
                >
                  <Upload size={12} />
                  {logoUrl ? "Trocar imagem" : "Enviar imagem"}
                </button>
                <p className="mt-1 text-[10px] text-gray-400">PNG ou JPG, até 5MB.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          {/* Nome */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1c1c] mb-1.5">Nome da loja *</label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Ex: Loja Aurora"
              maxLength={60}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1c1c] mb-1.5">Descrição</label>
            <textarea
              value={storeDescription}
              onChange={(e) => setStoreDescription(e.target.value)}
              placeholder="Conte em uma frase o que sua loja oferece."
              rows={3}
              maxLength={240}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-[13px] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black/10 resize-none"
            />
            <p className="mt-1 text-[10px] text-gray-400 text-right">{storeDescription.length}/240</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || uploading || !storeName.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-black text-white text-[12px] font-semibold hover:bg-[#222] disabled:opacity-50 transition"
          >
            {submitting ? <Loader2 size={13} className="animate-spin" /> : null}
            Criar página
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSalesPageModal;
