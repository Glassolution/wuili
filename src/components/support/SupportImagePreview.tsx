import { useEffect, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
};

export const SupportImagePreview = ({ file, onRemove }: { file: File; onRemove: () => void }) => {
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-[#e0e5ef] bg-[#f8faff] p-2.5">
      {previewUrl ? (
        <img src={previewUrl} alt="Prévia do anexo" className="h-14 w-14 rounded-lg object-cover" />
      ) : (
        <span className="grid h-14 w-14 place-items-center rounded-lg bg-[#eef2f8] text-[#788397]">
          <ImageIcon size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-semibold text-[#343b49]">{file.name}</p>
        <p className="mt-1 text-[9.5px] text-[#8a93a3]">Imagem · {formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[#7d8797] transition hover:bg-white hover:text-[#20242c]"
        aria-label="Remover imagem"
      >
        <X size={15} />
      </button>
    </div>
  );
};

export default SupportImagePreview;
