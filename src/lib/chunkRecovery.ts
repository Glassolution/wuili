const CHUNK_RELOAD_KEY = "velo:chunk-reload";
const RELOAD_GUARD_MS = 15_000;
const CACHE_BUST_PARAM = "__velo_refresh";

const chunkErrorPatterns = [
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /importing a module script failed/i,
  /loading chunk .* failed/i,
  /chunkloaderror/i,
];

export const isChunkLoadError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return chunkErrorPatterns.some((pattern) => pattern.test(message));
};

export const recoverFromChunkLoadError = (error: unknown): boolean => {
  if (!isChunkLoadError(error) || typeof window === "undefined") return false;

  const now = Date.now();
  const previousAttempt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
  if (Number.isFinite(previousAttempt) && now - previousAttempt < RELOAD_GUARD_MS) return false;

  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now));
  const freshUrl = new URL(window.location.href);
  freshUrl.searchParams.set(CACHE_BUST_PARAM, String(now));
  window.location.replace(freshUrl.toString());
  return true;
};

export const clearChunkReloadGuard = () => {
  if (typeof window === "undefined") return;
  window.setTimeout(() => {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    const cleanUrl = new URL(window.location.href);
    if (!cleanUrl.searchParams.has(CACHE_BUST_PARAM)) return;
    cleanUrl.searchParams.delete(CACHE_BUST_PARAM);
    window.history.replaceState(window.history.state, "", cleanUrl.toString());
  }, RELOAD_GUARD_MS);
};