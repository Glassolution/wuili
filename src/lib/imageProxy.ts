// Reescreve URLs de fornecedores que bloqueiam hotlink (ex.: C7 Drop tem
// firewall Vercel que devolve 403 pra qualquer <img src>). Roteamos essas URLs
// pela edge function `img-proxy`, que refaz o fetch com headers de browser e
// serve o binário com CORS + cache imutável.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

const PROXY_HOSTS = new Set(["c7drop.com.br", "www.c7drop.com.br"]);

export function proxyImageUrl(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (!SUPABASE_URL) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (!PROXY_HOSTS.has(parsed.hostname)) return trimmed;
    return `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/img-proxy?u=${encodeURIComponent(trimmed)}`;
  } catch {
    return trimmed;
  }
}

export function proxyImageList(list: readonly (string | null | undefined)[] | null | undefined): string[] {
  if (!list) return [];
  return list.map((u) => proxyImageUrl(u)).filter(Boolean);
}
