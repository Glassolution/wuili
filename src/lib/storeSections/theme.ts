// Traduz ThemeTokens para CSS variables aplicadas no container das seções.
// Blocos consomem via `var(--st-primary)`, nunca cor fixa.
import type { CSSProperties } from "react";
import type { ThemeTokens } from "./types";

export function themeToCssVars(theme: ThemeTokens): CSSProperties {
  return {
    ["--st-primary" as string]: theme.primary,
    ["--st-primary-text" as string]: theme.primaryText,
    ["--st-accent" as string]: theme.accent,
    ["--st-bg" as string]: theme.background,
    ["--st-surface" as string]: theme.surface,
    ["--st-text" as string]: theme.text,
    ["--st-muted" as string]: theme.mutedText,
    ["--st-border" as string]: theme.border,
    ["--st-radius" as string]: `${theme.radius}px`,
    ["--st-font-heading" as string]: theme.fontHeading,
    ["--st-font-body" as string]: theme.fontBody,
  };
}
