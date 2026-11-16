import { describe, expect, it } from 'vitest';
import { FIRST_IMAGE_RETRY_DELAY_MS, imageFailureRetry, SECOND_IMAGE_RETRY_DELAY_MS } from '../../supabase/functions/_shared/image-retry-policy';

describe('retentativa de fotos inconclusivas', () => {
  const now = Date.parse('2026-11-16T20:00:00-03:00');
  it('primeira falha conta uma tentativa e permite nova análise após cinco minutos', () => {
    expect(imageFailureRetry(0, false, now)).toEqual({ attempts: 1, retryAfter: new Date(now + FIRST_IMAGE_RETRY_DELAY_MS).toISOString() });
  });
  it('segunda falha conta a segunda tentativa e espera exatamente 24 horas', () => {
    expect(imageFailureRetry(1, false, now)).toEqual({ attempts: 2, retryAfter: new Date(now + SECOND_IMAGE_RETRY_DELAY_MS).toISOString() });
  });
  it('falta de crédito não conta como tentativa', () => {
    expect(imageFailureRetry(1, true, now)).toEqual({ attempts: 1, retryAfter: new Date(now + FIRST_IMAGE_RETRY_DELAY_MS).toISOString() });
  });
});
