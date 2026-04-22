import React from "react";

interface VeloLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
}

export function VeloLogo({ size = "md", variant = "dark" }: VeloLogoProps) {
  const sizes = {
    sm: { icon: 28, rx: 8, fontSize: 16, gap: 8, stroke: 2 },
    md: { icon: 40, rx: 11, fontSize: 22, gap: 10, stroke: 2.5 },
    lg: { icon: 56, rx: 15, fontSize: 32, gap: 14, stroke: 3 },
  };

  const s = sizes[size];
  const isDark = variant === "dark";
  const iconBg = isDark ? "#0A0A0A" : "#FFFFFF";
  const iconStroke = isDark ? "#FFFFFF" : "#0A0A0A";
  const textColor = isDark ? "#0A0A0A" : "#FFFFFF";
  const scale = s.icon / 48;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
      <svg
        width={s.icon}
        height={s.icon}
        viewBox="0 0 48 48"
        fill="none"
        style={{ flexShrink: 0 }}
      >
        <rect width="48" height="48" rx={s.rx / scale} fill={iconBg} />
        {variant === "light" && (
          <rect
            width="48"
            height="48"
            rx={s.rx / scale}
            fill="none"
            stroke="#0A0A0A"
            strokeWidth="1.5"
          />
        )}
        <path
          d="M33 18 A11 11 0 1 0 33 30"
          stroke={iconStroke}
          strokeWidth={s.stroke / scale}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M30 26 L34 30 L38 26"
          stroke={iconStroke}
          strokeWidth={(s.stroke - 0.3) / scale}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <span
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
          fontSize: s.fontSize,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          color: textColor,
          lineHeight: 1,
        }}
      >
        Velo
      </span>
    </div>
  );
}
