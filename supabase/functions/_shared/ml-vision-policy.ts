import type { VisionFilterResult } from './ml-image-vision.ts';

export function imageProductDecision(result: VisionFilterResult): 'approved' | 'rejected' | 'inconclusive' {
  if (result.clean.length >= 1) return 'approved';
  if (result.inconclusive.length || !result.rejected.length) return 'inconclusive';
  return 'rejected';
}