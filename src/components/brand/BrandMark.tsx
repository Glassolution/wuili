import { Zap } from "lucide-react";

type BrandMarkProps = {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  /** "light" = fundo claro → ícone preto · "dark" = fundo escuro → ícone branco */
  tone?: "light" | "dark";
  className?: string;
};

// Mapeamento de tamanhos → px do ícone Zap
// navbar: 20px (sm) · sidebar: 24px (md) · landing hero: 32px (lg)
const zapSizes: Record<NonNullable<BrandMarkProps["size"]>, number> = {
  xs: 18,
  sm: 20,
  md: 24,
  lg: 32,
  xl: 40,
};

const BrandMark = ({
  size = "md",
  showWordmark = false,
  tone = "dark",
  className = "",
}: BrandMarkProps) => {
  const color = tone === "dark" ? "#ffffff" : "#000000";
  const wordmarkColor = tone === "dark" ? "text-white" : "text-[#0a0a0a]";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <Zap
        size={zapSizes[size]}
        color={color}
        strokeWidth={2.25}
        aria-label="Velo"
      />
      {showWordmark && (
        <span
          className={`font-['Manrope'] text-lg font-bold tracking-[-0.02em] ${wordmarkColor}`}
        >
          Velo
        </span>
      )}
    </div>
  );
};

export default BrandMark;
