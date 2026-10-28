import { initMetaPixel, trackSinglePixel } from "./metaPixel";

// Identificador público do conjunto de dados da própria Velo.
export const VELO_META_PIXEL_ID = "1732267104505162";

export function rotaTemPixelMeta(pathname: string): boolean {
  return ["/", "/login", "/cadastro"].includes(pathname.replace(/\/+$/, "") || "/");
}

export function iniciarMetaVelo(): boolean {
  if (typeof window === "undefined" || !rotaTemPixelMeta(window.location.pathname)) return false;
  if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl) return false;
  try {
    initMetaPixel(VELO_META_PIXEL_ID, { seller: false });
    return true;
  } catch {
    return false;
  }
}

export function medirMetaVelo(event: string, params: Record<string, unknown> = {}, custom = false): void {
  if (!iniciarMetaVelo()) return;
  try {
    trackSinglePixel(VELO_META_PIXEL_ID, event, params, custom);
  } catch {
    // Medição não pode interromper a navegação nem o cadastro.
  }
}
