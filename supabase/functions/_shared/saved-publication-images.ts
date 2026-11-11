/** Only explicit, same-run opinions from BOTH models can be reused. */
export const PUBLICATION_IMAGE_MODELS = ['google/gemini-3.8-flash', 'openai/gpt-6.1-terra'] as const;
export const IMAGE_QUEUE_MESSAGE = 'Estamos com instabilidade na conferência das fotos. Seu anúncio entrou na fila e será publicado automaticamente.';
export type SavedImageRow = {
  image_url: string; image_role: string; verdict: string; reason_code: string;
  evidence_location: string; justification: string; criterion_version: string;
  model: string; analyzed_at: string; run_id: string;
};
export type SavedRoles = Map<string, { secondary?: SavedImageRow; primary?: SavedImageRow }>;
export function savedPublicationRoles(rows: SavedImageRow[], urls: string[]): SavedRoles {
  const allowed = new Set(urls);
  const groups = new Map<string, SavedImageRow[]>();
  for (const row of rows) {
    if (!allowed.has(row.image_url) || !row.criterion_version.startsWith('two-level-') || !['primary', 'secondary'].includes(row.image_role)) continue;
    const key = JSON.stringify([row.image_url, row.image_role, row.criterion_version, row.run_id]);
    const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
  }
  const result: SavedRoles = new Map();
  for (const group of groups.values()) {
    const combined = group.find(row => PUBLICATION_IMAGE_MODELS.every(model => row.model.split('+').includes(model)));
    const opinions = combined ? [combined] : PUBLICATION_IMAGE_MODELS.map(model => group.filter(row => row.model === model).sort((a,b) => b.analyzed_at.localeCompare(a.analyzed_at))[0]);
    if (opinions.some(row => !row)) continue;
    const first = opinions[0];
    if (!first) continue;
    const denial = opinions.find(row => row?.verdict === 'reprovada');
    const decision = denial ?? (opinions.every(row => row?.verdict === 'aprovada') ? first : undefined);
    if (!decision) continue;
    const roles = result.get(first.image_url) ?? {};
    const role = first.image_role === 'primary' ? 'primary' : 'secondary';
    if (!roles[role] || decision.analyzed_at > roles[role].analyzed_at) roles[role] = decision;
    result.set(first.image_url, roles);
  }
  return result;
}

export function savedPublishableImages(roles: SavedRoles, urls: string[]): string[] {
  const approved = [...new Set(urls)].filter(url => roles.get(url)?.secondary?.verdict === 'aprovada');
  // Preserve the existing clean-secondary OK fallback; explicit primary approval wins.
  const primary = approved.find(url => roles.get(url)?.primary?.verdict === 'aprovada')
    ?? approved.find(url => roles.get(url)?.secondary?.reason_code === 'OK');
  return primary && approved.length >= 3 ? [primary, ...approved.filter(url => url !== primary)].slice(0, 6) : [];
}

export function publicationFailurePolicy(status?: number, type?: string): 'credit' | 'rate' | 'terminal' | 'temporary' {
  if (status === 402 || (status === 403 && ['credit_limit_reached', 'ai_disabled'].includes(type ?? ''))) return 'credit';
  if (status === 429) return 'rate';
  if (status === 401 || status === 403 || status === 404 || status === 400) return 'terminal';
  return 'temporary';
}