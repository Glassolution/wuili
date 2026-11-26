import { describe, it, expect } from 'vitest';
import { fulfilledPublication, publicationCatalogKeys, imageClaimFailure } from '../../supabase/functions/_shared/publication-recovery';

describe('recuperação de pendências de publicação', () => {
  it('reconhece UUID da fila e código do catálogo da Raquete', () => {
    expect(publicationCatalogKeys('74118a73-637e-45ca-9306-25bab2d48c0d', 'raquete-eletrica-led-usb-inseto-dp-839')).toEqual(['74118a73-637e-45ca-9306-25bab2d48c0d', 'raquete-eletrica-led-usb-inseto-dp-839']);
  });
  it('encerra pendência atendida mesmo quando o anúncio fechou depois', () => {
    expect(fulfilledPublication('closed', '2026-11-25T21:10:12Z', '2026-11-25T20:55:41Z')).toBe(true);
    expect(fulfilledPublication('closed', '2026-11-24T21:10:12Z', '2026-11-25T20:55:41Z')).toBe(false);
  });
  it('somente reserva ativa recebe motivo análise em andamento', () => {
    expect(imageClaimFailure('analysis_in_progress').code).toBe('IMAGE_ANALYSIS_IN_PROGRESS');
    expect(imageClaimFailure('verdict_changed').code).toBe('IMAGE_LEGACY_VERDICT_INCOMPATIBLE');
    expect(imageClaimFailure('retry_wait').code).toBe('IMAGE_RETRY_WAIT');
  });
});