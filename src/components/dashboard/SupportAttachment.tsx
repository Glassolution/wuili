import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const SUPPORT_BUCKET = "support-attachments";
export const MAX_ATTACHMENT_MB = 5;

/** Faz upload de uma imagem do ticket e devolve o caminho salvo no storage. */
export async function uploadSupportAttachment(params: {
  file: File;
  userId: string;
  ticketId: string;
}): Promise<string> {
  const { file, userId, ticketId } = params;
  if (!file.type.startsWith("image/")) {
    throw new Error("Envie apenas imagens (PNG, JPG ou WEBP).");
  }
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
    throw new Error(`A imagem deve ter no máximo ${MAX_ATTACHMENT_MB}MB.`);
  }
  const ext = (file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${userId}/${ticketId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(SUPPORT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error("Não foi possível enviar a imagem. Tente novamente.");
  return path;
}

/** Renderiza um anexo privado do ticket usando URL assinada. */
const SupportAttachment = ({ path }: { path: string }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** Visualizador em tela cheia — a imagem abre aqui, não numa aba nova. */
  const [ampliada, setAmpliada] = useState(false);

  useEffect(() => {
    if (!ampliada) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAmpliada(false);
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [ampliada]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage
        .from(SUPPORT_BUCKET)
        .createSignedUrl(path, 60 * 60);
      if (cancelled) return;
      if (error || !data?.signedUrl) setFailed(true);
      else setUrl(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (failed) {
    return (
      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-black/5 px-2.5 py-1.5 text-[12px] opacity-80 dark:bg-white/10">
        <ImageIcon size={13} /> Anexo indisponível
      </div>
    );
  }

  if (!url) {
    return (
      <div className="mt-2 flex h-[120px] w-[180px] items-center justify-center rounded-lg bg-black/5 dark:bg-white/10">
        <Loader2 size={16} className="animate-spin opacity-60" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        aria-label="Ampliar imagem"
        title="Clique para ampliar"
        className="mt-2 block"
      >
        <img
          src={url}
          alt="Anexo enviado no ticket de suporte"
          loading="lazy"
          className="max-h-[240px] w-auto max-w-full cursor-zoom-in rounded-lg border border-black/10 object-cover dark:border-white/10"
        />
      </button>

      {ampliada &&
        createPortal(
          <div
            className="fixed inset-0 z-[140] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            // Eventos de portal sobem pela árvore do React, não pelo DOM: sem o
            // stopPropagation o clique chegaria aos handlers do chat por baixo.
            onClick={(e) => {
              e.stopPropagation();
              setAmpliada(false);
            }}
          >
            <button
              type="button"
              onClick={() => setAmpliada(false)}
              aria-label="Fechar imagem"
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <X size={18} />
            </button>
            {/* O clique na própria imagem não fecha, só o clique no fundo. */}
            <img
              src={url}
              alt="Anexo enviado no ticket de suporte"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
            />
          </div>,
          document.body,
        )}
    </>
  );
};

export default SupportAttachment;
