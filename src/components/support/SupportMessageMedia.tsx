import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, Image as ImageIcon, X } from "lucide-react";
import { parseSupportMessage } from "@/lib/support";

type SupportMessageMediaProps = {
  value: string;
  textClassName?: string;
  imageClassName?: string;
};

export const SupportMessageMedia = ({
  value,
  textClassName = "whitespace-pre-wrap",
  imageClassName = "max-h-[300px] w-full max-w-[420px]",
}: SupportMessageMediaProps) => {
  const { text, attachment } = parseSupportMessage(value);
  const [open, setOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      {attachment ? (
        <div className="space-y-2.5">
          {imageError ? (
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-24 items-center gap-3 rounded-xl border border-black/10 bg-black/[0.035] px-4 text-sm font-medium"
            >
              <ImageIcon size={20} />
              <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
              <ExternalLink size={16} />
            </a>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="group relative block max-w-full overflow-hidden rounded-[14px] bg-black/5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              aria-label={`Ampliar ${attachment.name}`}
            >
              <img
                src={attachment.url}
                alt={attachment.name}
                loading="lazy"
                onError={() => setImageError(true)}
                className={`${imageClassName} block object-cover transition duration-300 group-hover:scale-[1.015]`}
              />
              <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/65 to-transparent px-3 pb-2.5 pt-8 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                <span className="truncate">{attachment.name}</span>
                <span className="shrink-0">Clique para ampliar</span>
              </span>
            </button>
          )}
          {text ? <p className={textClassName}>{text}</p> : null}
        </div>
      ) : (
        <p className={textClassName}>{text}</p>
      )}

      {open && attachment && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-center justify-center bg-[#0b0d12]/90 p-4 backdrop-blur-md sm:p-8"
              onMouseDown={(event) => {
                if (event.currentTarget === event.target) setOpen(false);
              }}
              role="dialog"
              aria-modal="true"
              aria-label={`Visualização de ${attachment.name}`}
            >
              <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-7 sm:top-6">
                <a
                  href={attachment.url}
                  download={attachment.name}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Baixar imagem"
                >
                  <Download size={18} />
                </a>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20"
                  aria-label="Fechar imagem"
                >
                  <X size={20} />
                </button>
              </div>
              <figure className="flex max-h-full max-w-[min(1100px,100%)] flex-col items-center gap-3">
                <img
                  src={attachment.url}
                  alt={attachment.name}
                  className="max-h-[calc(100vh-120px)] max-w-full rounded-2xl object-contain shadow-2xl"
                />
                <figcaption className="max-w-full truncate text-xs font-medium text-white/70">
                  {attachment.name}
                </figcaption>
              </figure>
            </div>,
            document.body,
          )
        : null}
    </>
  );
};

export default SupportMessageMedia;
