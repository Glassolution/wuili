type BrandMarkProps = {
  size?: "sm" | "md" | "lg" | "xl";
  showWordmark?: boolean;
  className?: string;
};

const sizes = {
  sm: "h-9 w-9",
  md: "h-12 w-12",
  lg: "h-16 w-16",
  xl: "h-24 w-24",
};

const BrandMark = ({ size = "md", showWordmark = false, className = "" }: BrandMarkProps) => (
  <div className={`inline-flex items-center gap-3 ${className}`}>
    <div className={`relative ${sizes[size]} shrink-0 overflow-hidden rounded-[30%] bg-white/10 p-1 shadow-[0_0_40px_rgba(123,211,255,0.25)] backdrop-blur`}>
      <img
        src="/brand-star-logo.png"
        alt="Wuilli"
        className="h-full w-full rounded-[26%] object-cover"
      />
    </div>
    {showWordmark && (
      <div className="flex flex-col">
        <span className="font-['Syne'] text-lg font-bold uppercase tracking-[0.28em] text-white">
          Wuilli
        </span>
        <span className="text-[10px] uppercase tracking-[0.34em] text-cyan-100/60">
          Commerce Command
        </span>
      </div>
    )}
  </div>
);

export default BrandMark;
