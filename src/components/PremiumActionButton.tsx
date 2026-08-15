import type { ButtonHTMLAttributes, CSSProperties } from "react";

type PremiumActionButtonIntensity = "standard" | "strong";

/** Azul da marca usado no CTA "Criar Página com IA" da home. */
export const PILOT_BLUE_BACKGROUND = "linear-gradient(180deg,#4F86FF 0%,#2563EB 52%,#1D4ED8 100%)";
const PRIME_DARK_BACKGROUND = "linear-gradient(180deg,#1F2633 0%,#111722 52%,#0B101A 100%)";

const PREMIUM_ACTION_EFFECTS: Record<PremiumActionButtonIntensity, CSSProperties> = {
  standard: {
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.48), inset 0 -1px 0 rgba(15,23,42,0.22), 0 1px 0 rgba(15,23,42,0.22), 0 8px 18px rgba(15,23,42,0.20)",
  },
  strong: {
    boxShadow:
      "inset 0 1px 0 rgba(255,255,255,0.48), inset 0 -1px 0 rgba(15,23,42,0.22), 0 1px 0 rgba(15,23,42,0.22), 0 8px 18px rgba(15,23,42,0.20)",
  },
};

export const getPremiumActionButtonStyle = ({
  background = PRIME_DARK_BACKGROUND,
  intensity = "standard",
}: {
  background?: CSSProperties["background"];
  intensity?: PremiumActionButtonIntensity;
} = {}) => ({
  ...PREMIUM_ACTION_EFFECTS[intensity],
  border: "1px solid rgba(255,255,255,0.10)",
  background,
  color: "#FFFFFF",
  textShadow: "none",
}) satisfies CSSProperties;

export const PREMIUM_ACTION_BUTTON_STYLE = getPremiumActionButtonStyle();

type PremiumActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  background?: CSSProperties["background"];
  intensity?: PremiumActionButtonIntensity;
};

export const PremiumActionButton = ({
  background,
  className = "",
  intensity = "standard",
  style,
  children,
  ...props
}: PremiumActionButtonProps) => (
  <button
    {...props}
    className={`relative overflow-hidden font-semibold tracking-normal transition hover:brightness-[1.03] active:translate-y-px ${className}`}
    style={{ ...style, ...getPremiumActionButtonStyle({ background, intensity }) }}
  >
    <span className="relative z-10 tracking-normal [text-shadow:none]">{children}</span>
  </button>
);
