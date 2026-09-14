type AquasIconProps = {
  size?: number;
  inverted?: boolean;
  className?: string;
};

const AquasIcon = ({ size = 28, inverted = false, className }: AquasIconProps) => {
  const background = inverted ? "#111111" : "#FFFFFF";
  const foreground = inverted ? "#FFFFFF" : "#111111";

  return (
    <span
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-[30%] ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background,
        boxShadow: inverted
          ? "inset 0 1px 0 rgba(255,255,255,0.12), 0 10px 22px rgba(17,24,39,0.18)"
          : "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 22px rgba(17,24,39,0.10)",
      }}
      aria-hidden="true"
    >
      <svg width={size * 0.72} height={size * 0.72} viewBox="0 0 64 48" fill="none">
        <path
          d="M19.2 39.8C10.7 39.8 4 33.5 4 25.6c0-7 5.2-12.7 12.2-14 3.3-6.6 9.6-10.4 17-10.4 8.7 0 16 5.5 18.1 13.3 5.2 1.5 8.7 6 8.7 11.8 0 7.4-5.9 13.5-13.7 13.5H19.2Z"
          fill={foreground}
        />
        <path d="M23.2 24.2c1.5 4.4 6.1 4.4 7.6 0" stroke={background} strokeWidth="3.2" strokeLinecap="round" />
        <path d="M38.2 24.2c1.5 4.4 6.1 4.4 7.6 0" stroke={background} strokeWidth="3.2" strokeLinecap="round" />
        <path d="M31.4 34c4.6 3.3 10.2 3.3 14.8 0" stroke={background} strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="16.2" cy="29.2" r="2.2" fill={background} />
        <circle cx="22.4" cy="34.2" r="2.2" fill={background} />
        <circle cx="15.4" cy="37" r="1.8" fill={background} />
      </svg>
    </span>
  );
};

export default AquasIcon;
