export const VELO_TOP_OFFSET_CSS_VAR = "--velo-top-offset";

/**
 * Mede uma possível barra fixa no topo (ex.: "Start Mode") para evitar que
 * modais/drawers fiquem escondidos atrás dela.
 *
 * Não altera a lógica do Start Mode — apenas detecta o elemento no DOM.
 */
export function measureTopOverlayOffset(): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;

  const selectors = [
    "#start-mode",
    "#start-mode-bar",
    "#startmode",
    "[data-start-mode]",
    "[data-startmode]",
    ".start-mode",
    "#lovable-start-mode",
    "#lovable-startmode",
  ];

  const isFixedAtTop = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0 || rect.height > 220) return false;
    const style = window.getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") return false;
    return Math.abs(rect.top) <= 1;
  };

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el instanceof HTMLElement && isFixedAtTop(el)) {
      return Math.round(el.getBoundingClientRect().height);
    }
  }

  // Fallback: procurar por algo fixo no topo que contenha "Start Mode"
  const nodes = document.querySelectorAll<HTMLElement>("header, div, nav");
  const max = Math.min(nodes.length, 400);
  for (let i = 0; i < max; i++) {
    const el = nodes[i];
    const text = (el.textContent || "").toLowerCase();
    if (!text.includes("start mode")) continue;
    if (isFixedAtTop(el)) return Math.round(el.getBoundingClientRect().height);
  }

  return 0;
}

