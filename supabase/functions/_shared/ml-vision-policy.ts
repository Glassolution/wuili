import type { VisionFilterResult } from './ml-image-vision.ts';

export type VisionOpinion = { clean: boolean | null; reason: string };

/**
 * Ask models in order; a photo passes only if every model approves. The first explicit
 * rejection wins and later models are skipped. Any failure, timeout or invalid answer
 * is inconclusive (retried later), never an approval or a rejection.
 */
export async function sequentialVision<M extends string>(models: readonly M[], ask: (model: M) => Promise<VisionOpinion>): Promise<VisionOpinion & { model?: M }> {
  let approved: (VisionOpinion & { model?: M }) | null = null;
  for (const model of models) {
    let opinion: VisionOpinion;
    try { opinion = await ask(model); }
    catch { return { clean: null, reason: `análise indisponível: falha na IA (${model})` }; }
    if (opinion.clean === null) return { clean: null, reason: `${opinion.reason || 'análise inconclusiva'} (${model})` };
    if (opinion.clean === false) return { ...opinion, model };
    approved ??= { ...opinion, model };
  }
  return approved ?? { clean: null, reason: 'nenhum modelo configurado' };
}

export function imageProductDecision(result: VisionFilterResult): 'approved' | 'rejected' | 'inconclusive' | 'no_primary' {
  if (result.clean.length >= 1) return 'approved';
  if (result.inconclusive.length) return 'inconclusive';
  if (result.secondaryApproved?.length && result.primaryRejected?.length === result.secondaryApproved.length) return 'no_primary';
  if (result.inconclusive.length || !result.rejected.length) return 'inconclusive';
  return 'rejected';
}