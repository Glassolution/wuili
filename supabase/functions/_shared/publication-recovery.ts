/** The queue stores catalog UUIDs; published listings may store supplier codes. */
export function publicationCatalogKeys(productId: string | null, externalId: string | null): string[] {
  return [...new Set([productId, externalId].filter((key): key is string => Boolean(key)))];
}

export function fulfilledPublication(status: string, publishedAt: string | null, requestedAt: string): boolean {
  if (['active', 'published'].includes(status)) return true;
  return ['closed', 'paused', 'inactive', 'under_review'].includes(status)
    && Boolean(publishedAt && new Date(publishedAt).getTime() >= new Date(requestedAt).getTime());
}

export function imageClaimFailure(status: string | undefined): { code: string; reason: string } {
  if (status === 'analysis_in_progress') return { code: 'IMAGE_ANALYSIS_IN_PROGRESS', reason: 'Esta foto já está sendo analisada' };
  if (status === 'retry_wait') return { code: 'IMAGE_RETRY_WAIT', reason: 'Duas análises inconclusivas; nova tentativa após 24h' };
  return { code: 'IMAGE_LEGACY_VERDICT_INCOMPATIBLE', reason: 'Veredito antigo incompatível; nova análise necessária' };
}