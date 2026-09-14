import React from "react";

interface VeloLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "dark" | "light";
}

export type VeloMarkTone = "solid" | "soft" | "violet" | "gold" | "dark";

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
    from: "#5C8CFF",
    to: "#1D4ED8",
    stroke: "#FFFFFF",
    // Borda interna clara: pega a "luz" na quina superior e separa o ícone do
    // fundo branco sem precisar de contorno duro.
    rim: "rgba(255,255,255,0.22)",
    // Filtro CSS pronto: drop-shadow aceita uma sombra por função, então as
    // duas camadas (difusa + contato) são encadeadas.
    shadow: "drop-shadow(0 6px 12px rgba(10,10,10,0.30)) drop-shadow(0 1px 2px rgba(10,10,10,0.18))",
  },
  soft: {
    from: "#FFFFFF",
    to: "#E7E7E4",
    stroke: "#0A0A0A",
    rim: "rgba(10,10,10,0.10)",
    shadow: "drop-shadow(0 4px 10px rgba(10,10,10,0.12)) drop-shadow(0 1px 2px rgba(10,10,10,0.07))",
  },
  violet: {
    from: "#8B7CFF",
    to: "#5B35EA",
    stroke: "#FFFFFF",
    rim: "rgba(255,255,255,0.24)",
    shadow: "drop-shadow(0 9px 18px rgba(91,53,234,0.32)) drop-shadow(0 1px 2px rgba(10,10,10,0.16))",
  },
  gold: {
    from: "#FFF5B7",
    to: "#F2B13D",
    stroke: "#B45309",
    rim: "rgba(255,255,255,0.42)",
    shadow: "drop-shadow(0 8px 18px rgba(180,83,9,0.16)) drop-shadow(0 1px 2px rgba(10,10,10,0.10))",
  },
  dark: {
    from: "#2B2B2B",
    to: "#050505",
    stroke: "#FFFFFF",
    rim: "rgba(255,255,255,0.14)",
    shadow: "drop-shadow(0 8px 18px rgba(0,0,0,0.26)) drop-shadow(0 1px 2px rgba(0,0,0,0.18))",
  },
};

export const VELO_MARK_SOLID_GRADIENT = `linear-gradient(135deg, ${MARK_TONES.solid.from} 0%, ${MARK_TONES.solid.to} 100%)`;

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
  // Logo oficial (public/logo.png): a cesta azul com o "C", gerada a partir de
  // "public/logo original.png" com o fundo branco removido e recortada na borda da
  // arte — por isso a imagem entra inteira (object-contain) e preenche a caixa. O
  // texto "Velo" muda de cor conforme a variante; a marca é a mesma em qualquer fundo.
  const isDark = variant === "dark";
  const textColor = isDark ? "#0A0A0A" : "#FFFFFF";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: s.gap }}>
      <img
        src="/logo.png"
        alt=""
        style={{ width: s.icon, height: s.icon, objectFit: "contain", display: "block", flexShrink: 0 }}
      />
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
