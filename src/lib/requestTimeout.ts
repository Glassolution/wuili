export function resolveAfter<T>(ms: number, value: T): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

export function createTimeoutSignal(ms: number, parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), ms);

  parentSignal?.addEventListener("abort", () => controller.abort(), { once: true });

  return {
    signal: controller.signal,
    clear: () => window.clearTimeout(timeoutId),
  };
}
