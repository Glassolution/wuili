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
          viewBox="0 0 64 48"
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
          {/* Shopping cart icon — centered inside cloud */}
          <g transform="translate(20, 14) scale(0.95)">
            <path
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.5 6M17 13l1.5 6"
              stroke={codeFill}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="10" cy="20.5" r="1.2" fill={codeFill} />
            <circle cx="17" cy="20.5" r="1.2" fill={codeFill} />
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
