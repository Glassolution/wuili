// Meta Pixel (Facebook Pixel) por seller.
// O ID fica em user_projects.meta_pixel_id e só é usado na renderização da
// storefront pública do próprio seller. Se não houver ID válido, nada é
// injetado — lojas sem pixel seguem intocadas.

const PIXEL_SCRIPT_ID = "meta-pixel-base";

/** Aceita apenas dígitos, 10 a 20 — mesmo critério do campo no dashboard. */
export function isValidPixelId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{10,20}$/.test(value.trim());
}

export function normalizePixelId(value: string): string {
  return value.replace(/\D/g, "").slice(0, 20);
}

type Fbq = ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };

function getFbq(): Fbq | null {
  if (typeof window === "undefined") return null;
  // O fbq é injetado pelo script base da Meta; não há tipagem oficial.
  return ((window as unknown as { fbq?: Fbq }).fbq) ?? null;
}

/** Injeta o script base da Meta (async) e dispara o PageView inicial. Idempotente. */
export function initMetaPixel(pixelId: string | null | undefined): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (!isValidPixelId(pixelId)) return;
  const id = pixelId.trim();

  const w = window as unknown as Record<string, unknown> & { fbq?: Fbq; _fbq?: Fbq };
  const initialized = (w.__veloMetaPixels as Set<string> | undefined) ?? new Set<string>();
  w.__veloMetaPixels = initialized;
  if (initialized.has(id)) return;
  initialized.add(id);

  if (!w.fbq) {
    const n: Fbq = function (...args: unknown[]) {
      const self = n as Fbq & { callMethod?: (...a: unknown[]) => void; queue: unknown[] };
      if (self.callMethod) self.callMethod.apply(self, args);
      else self.queue.push(args);
    } as Fbq;
    n.queue = [];
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    w.fbq = n;
    if (!w._fbq) w._fbq = n;

    if (!document.getElementById(PIXEL_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.id = PIXEL_SCRIPT_ID;
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      const first = document.getElementsByTagName("script")[0];
      first?.parentNode?.insertBefore(script, first);
    }
  }

  const fbq = getFbq();
  if (!fbq) return;
  fbq("init", id);
  fbq("track", "PageView");
}

/** Dispara um evento padrão do Pixel, se algum pixel estiver ativo. */
export function trackPixel(event: string, params?: Record<string, unknown>): void {
  const fbq = getFbq();
  if (!fbq) return;
  fbq("track", event, params ?? {});
}
