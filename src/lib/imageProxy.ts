// Rehosting de imagens dos fornecedores.
//
// C7 Drop hospeda as imagens em `c7drop.com.br` (Vercel), que retorna 403 pra
// requisições vindas de cloud IPs (Supabase Edge, nossa sandbox). Isso significa
// que proxy server-side não resolve — a única saída é rehospedar as imagens
// no Storage do próprio Supabase quando o scraper roda em ambiente permitido.
//
// Por enquanto este helper é passthrough: navegadores dos usuários geralmente
// conseguem carregar direto (o bloqueio do Vercel mira em bots server-side),
// então roteá-los pelo proxy só piora. A função `img-proxy` continua deployada
// pra uso futuro se um host adicionar bloqueio a browsers também.

export function proxyImageUrl(input: string | null | undefined): string {
  if (!input) return "";
  return input.trim();
}

export function proxyImageList(list: readonly (string | null | undefined)[] | null | undefined): string[] {
  if (!list) return [];
  return list.map((u) => proxyImageUrl(u)).filter(Boolean);
}
