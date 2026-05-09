import { useState, useCallback } from "react";
import { Download, ImageOff, Archive } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

type Props = {
  images: string[];
  productTitle: string;
};

// Sanitise product title into a safe filename prefix
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

// Infer extension from URL or default to jpg
function inferExt(url: string): string {
  const match = url.split("?")[0].match(/\.(png|jpg|jpeg|webp|gif)$/i);
  return match ? match[1].toLowerCase() : "jpg";
}

// Fetch image as Blob. Returns null when CORS blocks the request.
async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}

// Download a single blob (or URL fallback) to disk
function triggerBlobDownload(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

// ── Skeleton card ──────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA]">
    <div className="aspect-square w-full animate-pulse bg-[#EBEBEB]" />
    <div className="p-2">
      <div className="h-7 w-full animate-pulse rounded-lg bg-[#EBEBEB]" />
    </div>
  </div>
);

// ── Main component ─────────────────────────────────────────────────────────
export default function ProductImagesDownload({ images, productTitle }: Props) {
  const slug = toSlug(productTitle);
  const [loadedMap, setLoadedMap] = useState<Record<number, boolean>>({});
  const [errorMap, setErrorMap] = useState<Record<number, boolean>>({});
  const [downloadingIdx, setDownloadingIdx] = useState<number | null>(null);
  const [zipping, setZipping] = useState(false);

  const allLoaded = images.every((_, i) => loadedMap[i] || errorMap[i]);

  const handleImageLoad = useCallback((i: number) => {
    setLoadedMap((prev) => ({ ...prev, [i]: true }));
  }, []);

  const handleImageError = useCallback((i: number) => {
    setErrorMap((prev) => ({ ...prev, [i]: true }));
  }, []);

  // Individual download
  const downloadOne = async (url: string, idx: number) => {
    if (downloadingIdx !== null) return;
    setDownloadingIdx(idx);
    try {
      const ext = inferExt(url);
      const filename = `${slug}-${idx + 1}.${ext}`;
      const blob = await fetchBlob(url);
      if (blob) {
        triggerBlobDownload(blob, filename);
      } else {
        // CORS fallback — open in new tab so user can save manually
        window.open(url, "_blank", "noopener");
        toast.info("Imagem aberta em nova aba. Use Ctrl+S para salvar.");
      }
    } finally {
      setDownloadingIdx(null);
    }
  };

  // Download all as ZIP
  const downloadAll = async () => {
    if (zipping || images.length === 0) return;
    setZipping(true);
    toast.info("Preparando ZIP...");

    try {
      const zip = new JSZip();
      const folder = zip.folder(slug) ?? zip;
      let added = 0;

      await Promise.all(
        images.map(async (url, i) => {
          const ext = inferExt(url);
          const filename = `${slug}-${i + 1}.${ext}`;
          const blob = await fetchBlob(url);
          if (blob) {
            folder.file(filename, blob);
            added++;
          }
        })
      );

      if (added === 0) {
        toast.error("Não foi possível baixar as imagens. Tente individualmente.");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      triggerBlobDownload(zipBlob, `${slug}-imagens.zip`);
      toast.success(`${added} ${added === 1 ? "imagem baixada" : "imagens baixadas"} em ZIP`);
    } catch {
      toast.error("Erro ao gerar o arquivo ZIP.");
    } finally {
      setZipping(false);
    }
  };

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F0F0F0]">
          <ImageOff size={18} className="text-[#A3A3A3]" />
        </div>
        <p className="font-['Manrope'] text-[13px] text-[#737373]">
          Nenhuma imagem disponível para este produto
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="font-['Manrope'] text-[15px] font-semibold text-[#0A0A0A]">
            Imagens do produto
          </p>
          <p className="text-[12px] text-[#737373]">
            {images.length} {images.length === 1 ? "imagem disponível" : "imagens disponíveis"}
          </p>
        </div>
        <button
          onClick={downloadAll}
          disabled={zipping}
          className="flex items-center gap-2 rounded-xl border border-[#E5E5E5] bg-white px-4 py-2 font-['Manrope'] text-[12.5px] font-medium text-[#0A0A0A] shadow-sm transition hover:border-[#0A0A0A] hover:bg-[#FAFAFA] disabled:opacity-50"
        >
          {zipping ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "1.5px solid rgba(10,10,10,0.2)",
                  borderTopColor: "#0A0A0A",
                  animation: "btn-spin 0.7s linear infinite",
                  transformOrigin: "center",
                  flexShrink: 0,
                }}
              />
              Gerando ZIP...
            </>
          ) : (
            <>
              <Archive size={13} />
              Baixar todas
            </>
          )}
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((url, i) => {
          const loaded = loadedMap[i];
          const errored = errorMap[i];
          const isDownloading = downloadingIdx === i;

          return (
            <div
              key={url + i}
              className="group overflow-hidden rounded-xl border border-[#E5E5E5] bg-[#FAFAFA] transition-all duration-200 hover:border-[#D4D4D4] hover:shadow-md"
            >
              {/* Image area */}
              <div className="relative aspect-square overflow-hidden bg-[#F0F0F0]">
                {/* Skeleton shown until image loads */}
                {!loaded && !errored && (
                  <div className="absolute inset-0 animate-pulse bg-[#EBEBEB]" />
                )}

                {errored ? (
                  <div className="flex h-full w-full items-center justify-center">
                    <ImageOff size={22} className="text-[#D4D4D4]" />
                  </div>
                ) : (
                  <img
                    src={url}
                    alt={`${productTitle} ${i + 1}`}
                    loading="lazy"
                    onLoad={() => handleImageLoad(i)}
                    onError={() => handleImageError(i)}
                    className={`h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${
                      loaded ? "opacity-100" : "opacity-0"
                    }`}
                  />
                )}
              </div>

              {/* Download button */}
              <div className="p-2">
                <button
                  onClick={() => downloadOne(url, i)}
                  disabled={isDownloading || !!errored}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E5E5E5] bg-white py-1.5 font-['Manrope'] text-[11.5px] font-medium text-[#525252] transition hover:border-[#0A0A0A] hover:text-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDownloading ? (
                    <>
                      <span
                        style={{
                          display: "inline-block",
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          border: "1.5px solid rgba(10,10,10,0.2)",
                          borderTopColor: "#0A0A0A",
                          animation: "btn-spin 0.7s linear infinite",
                          transformOrigin: "center",
                          flexShrink: 0,
                        }}
                      />
                      Baixando...
                    </>
                  ) : (
                    <>
                      <Download size={11} />
                      Baixar
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
