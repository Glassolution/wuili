type BrandMarkProps = {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  /** "light" = fundo claro → logo normal · "dark" = fundo escuro → logo normal */
  tone?: "light" | "dark";
  className?: string;
};

const sizes = {
  xs: "h-6 w-6",
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

const BrandMark = ({
  size = "md",
  showWordmark = false,
  tone = "dark",
  className = "",
}: BrandMarkProps) => {
  const wordmarkColor = tone === "dark" ? "text-white" : "text-[#0a0a0a]";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className={`relative ${sizes[size]} shrink-0`}>
        <img
          src="/Logoj.png"
          alt="Velo"
          className="h-full w-full object-contain"
        />
      </div>
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
