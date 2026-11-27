export function parseBackfillInput(value: unknown): { days: number; dry_run: boolean } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["days", "dry_run"].includes(key))) return null;
  const days = input.days === undefined ? 7 : input.days;
  const dry_run = input.dry_run === undefined ? true : input.dry_run;
  return typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 7 && typeof dry_run === "boolean"
    ? { days, dry_run } : null;
}
export async function backfillAuthorized(token: string, serviceKey: string,
  getUser: () => Promise<string | null>, isAdmin: (userId: string) => Promise<boolean>) {
  if (!token) return false;
  // Timing-independent exact credential comparison; never trust JWT role claims alone.
  const encode = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encode.encode(token)), crypto.subtle.digest("SHA-256", encode.encode(serviceKey))]);
  const left = new Uint8Array(a), right = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
  if (serviceKey && difference === 0) return true;
  const userId = await getUser();
  return userId ? await isAdmin(userId) : false;
}