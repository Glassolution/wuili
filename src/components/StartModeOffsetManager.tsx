import { useEffect } from "react";
import { measureTopOverlayOffset, VELO_TOP_OFFSET_CSS_VAR } from "@/lib/startModeOffset";

/**
 * Mantém um CSS var global com o offset do "Start Mode" (quando existir).
 * Assim, modais/drawers podem se posicionar abaixo da barra.
 */
export default function StartModeOffsetManager() {
  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const root = document.documentElement;

    const apply = () => {
      const offset = measureTopOverlayOffset();
      root.style.setProperty(VELO_TOP_OFFSET_CSS_VAR, `${offset}px`);
    };

    apply();

    // A barra pode aparecer/desaparecer dinamicamente (ex.: dev tools).
    const id = window.setInterval(apply, 800);
    window.addEventListener("resize", apply);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", apply);
    };
  }, []);

  return null;
}

