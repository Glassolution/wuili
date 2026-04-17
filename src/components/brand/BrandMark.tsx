type BrandMarkProps = {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  /** "light" = fundo claro → nuvem preta · "dark" = fundo escuro → nuvem branca */
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
  const cloudFill = tone === "dark" ? "#ffffff" : "#000000";
  const codeFill = tone === "dark" ? "#0a0a0a" : "#ffffff";
  const wordmarkColor = tone === "dark" ? "text-white" : "text-[#0a0a0a]";

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div className={`relative ${sizes[size]} shrink-0`}>
        <svg
          viewBox="8 3 54 37"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-full w-full"
          aria-label="Velo"
        >
          {/* Cloud silhouette */}
          <path
            fill={cloudFill}
            d="M50.8 20.3c.1-.6.1-1.2.1-1.8 0-7.2-5.9-13.1-13.1-13.1-5.4 0-10.2 3.3-12.2 8.1-1.2-.5-2.5-.7-3.9-.7C15.2 12.8 9.8 18.2 9.8 24.8c0 6.6 5.4 12 12 12h28.6c5.5 0 9.9-4.4 9.9-9.9 0-4.3-2.7-7.9-6.5-9.3-.9 1.1-1.9 2-3 2.7z"
          />
          {/* 3D box — centered in cloud */}
          <g transform="translate(24, 10)">
            {/* Top face */}
            <path d="M11 1L21 6L11 11L1 6Z" fill={codeFill} fillOpacity={1} />
            {/* Right face */}
            <path d="M21 6L21 17L11 22L11 11Z" fill={codeFill} fillOpacity={0.5} />
            {/* Left face */}
            <path d="M1 6L1 17L11 22L11 11Z" fill={codeFill} fillOpacity={0.25} />
          </g>
        </svg>
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
