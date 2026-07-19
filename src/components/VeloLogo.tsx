import React from "react";

interface VeloLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
}

export type VeloMarkTone = "solid" | "soft";

interface VeloMarkProps {
  /** Lado do quadrado, em px. */
  size?: number;
  /**
   * "solid" = marca escura em destaque; "soft" = versão clara, secundária.
   */
  tone?: VeloMarkTone;
  className?: string;
}

/** Gradiente, traço e sombra de cada tom. O gradiente vai do canto superior
 *  esquerdo (mais claro) ao inferior direito (mais escuro), simulando uma luz
 *  vinda de cima — é o que dá o volume no ícone em vez de um chapado. */
const MARK_TONES: Record<
  VeloMarkTone,
  { from: string; to: string; stroke: string; rim: string; shadow: string }
> = {
  solid: {
    from: "#43434B",
    to: "#0A0A0A",
    stroke: "#FFFFFF",
    // Borda interna clara: pega a "luz" na quina superior e separa o ícone do
    // fundo branco sem precisar de contorno duro.
    rim: "rgba(255,255,255,0.22)",
    // Duas camadas: elevação curta + contato. Blur baixo de propósito — sombra
    // muito difusa vira um halo cinza em volta do chip em vez de leitura de
    // profundidade.
    shadow: "drop-shadow(0 4px 8px rgba(10,10,10,0.22)) drop-shadow(0 1px 2px rgba(10,10,10,0.16))",
  },
  soft: {
    from: "#FFFFFF",
    // Fim do gradiente mais escuro que antes: com #E7E7E4 o chip lia como
    // chapado sobre o card branco. O contraste maior é o que cria o relevo.
    to: "#D9D9D6",
    stroke: "#0A0A0A",
    rim: "rgba(10,10,10,0.08)",
    // Mesma lógica do solid, com opacidade menor: no chip claro o halo aparecia
    // ainda mais, porque o cinza da sombra contrasta com o card branco.
    shadow: "drop-shadow(0 3px 6px rgba(10,10,10,0.10)) drop-shadow(0 1px 2px rgba(10,10,10,0.07))",
  },
};

/**
 * Só o símbolo da Velo, sem o texto — para usos em que a marca aparece como
 * ícone (ex.: cartões de plano, onde cada plano recebe um tom diferente).
 */
export function VeloMark({ size = 44, tone = "solid", className }: VeloMarkProps) {
  // Ids únicos por instância: a página renderiza vários VeloMark e ids de
  // gradiente repetidos fazem um sobrescrever o outro no documento.
  const gradientId = React.useId();
  const t = MARK_TONES[tone];

  // O desenho original é em uma viewBox 48x48. O raio é proporcional ao lado
  // (~30%) para o arredondamento ficar igual em qualquer tamanho — com raio
  // fixo, um ícone pequeno vira quase um círculo e um grande, um quadrado.
  const scale = size / 48;
  const radius = size * 0.3;
  const rx = radius / scale;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      style={{ flexShrink: 0, filter: t.shadow }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={t.from} />
          <stop offset="1" stopColor={t.to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx={rx} fill={`url(#${gradientId})`} />
      {/* Inset de 0.5 para o traço da borda ficar dentro do quadrado. */}
      <rect x="0.5" y="0.5" width="47" height="47" rx={rx - 0.5} fill="none" stroke={t.rim} strokeWidth="1" />
      <path d="M33 18 A11 11 0 1 0 33 30" stroke={t.stroke} strokeWidth={2.5 / scale} strokeLinecap="round" fill="none" />
      <path
        d="M30 26 L34 30 L38 26"
        stroke={t.stroke}
        strokeWidth={2.2 / scale}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
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
