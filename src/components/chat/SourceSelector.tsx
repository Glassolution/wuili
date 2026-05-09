import { useState } from "react";
import { Search } from "lucide-react";

export type ProductSource = "aliexpress" | "mercadolivre";

interface SourceSelectorProps {
  onConfirm: (source: ProductSource) => void;
}

const sources: {
  id: ProductSource | "shopee";
  label: string;
  logo: React.ReactNode;
  disabled?: boolean;
  badge?: string;
}[] = [
  {
    id: "aliexpress",
    label: "AliExpress",
    logo: (
      <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#FF6A00" />
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="18" fontWeight="bold" fontFamily="Arial">A</text>
      </svg>
    ),
  },
  {
    id: "mercadolivre",
    label: "Mercado Livre",
    logo: (
      <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#FFE600" />
        <text x="20" y="27" textAnchor="middle" fill="#333" fontSize="14" fontWeight="bold" fontFamily="Arial">ML</text>
      </svg>
    ),
  },
  {
    id: "shopee",
    label: "Shopee",
    disabled: true,
    badge: "Em breve",
    logo: (
      <svg width="20" height="20" viewBox="0 0 40 40" fill="none">
        <rect width="40" height="40" rx="8" fill="#EE4D2D" />
        <text x="20" y="27" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold" fontFamily="Arial">S</text>
      </svg>
    ),
  },
];

export const SourceSelector = ({ onConfirm }: SourceSelectorProps) => {
  const [selected, setSelected] = useState<ProductSource>("aliexpress");

  return (
    <div className="rounded-2xl border border-border bg-background shadow-sm w-full max-w-[340px] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted">
          <Search size={14} className="text-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground">Onde buscar os produtos?</p>
      </div>

      {/* Options */}
      <div className="px-3 py-3 space-y-2">
        {sources.map((src) => {
          const isSelected = !src.disabled && selected === src.id;
          return (
            <button
              key={src.id}
              disabled={src.disabled}
              onClick={() => !src.disabled && setSelected(src.id as ProductSource)}
              className={`
                w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all
                ${src.disabled
                  ? "opacity-40 cursor-not-allowed bg-muted/40"
                  : isSelected
                  ? "bg-muted border border-border"
                  : "hover:bg-muted/60 border border-transparent"
                }
              `}
            >
              {/* Radio indicator */}
              <div className={`
                flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors
                ${isSelected ? "border-foreground bg-foreground" : "border-border bg-transparent"}
              `}>
                {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
              </div>

              {/* Logo */}
              <span className="shrink-0">{src.logo}</span>

              {/* Label */}
              <span className={`flex-1 text-sm font-medium text-foreground`}>
                {src.label}
              </span>

              {/* Badge */}
              {src.badge && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {src.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-3 pb-3">
        <button
          onClick={() => onConfirm(selected)}
          className="w-full rounded-xl bg-[#0a0a0a] py-2.5 text-sm font-semibold text-white hover:bg-[#222] transition-colors"
        >
          Buscar agora
        </button>
      </div>
    </div>
  );
};
