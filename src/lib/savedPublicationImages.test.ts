import { describe, it, expect } from 'vitest';
import { savedPublicationRoles, savedPublishableImages, publicationFailurePolicy, type SavedImageRow } from '../../supabase/functions/_shared/saved-publication-images';
const row = (url: string, role = 'secondary', model = 'google/gemini-3.8-flash+openai/gpt-6.1-terra', verdict = 'aprovada'): SavedImageRow => ({ image_url: url, image_role: role, model, verdict, reason_code:'OK', evidence_location:'FUNDO_LIMPO', justification:'Foto limpa', criterion_version:'two-level-v5-old', analyzed_at:'2026-11-10', run_id:'run' });
describe('publicação com evidência salva', () => {
  it('reutiliza revisão anterior dos dois modelos e exclui foto sem veredito', () => {
    const urls = ['a','b','c','unknown'];
    expect(savedPublishableImages(savedPublicationRoles([row('a'),row('b'),row('c')],urls),urls)).toEqual(['a','b','c']);
  });
  it('exige três aprovadas e coloca principal explícita primeiro', () => {
    const urls=['a','b','c'];
    expect(savedPublishableImages(savedPublicationRoles([row('a'),row('b')],urls),urls)).toEqual([]);
    expect(savedPublishableImages(savedPublicationRoles([row('a'),row('b'),row('c'),row('c','primary')],urls),urls)).toEqual(['c','a','b']);
  });
  it('não aceita um modelo só ou opiniões de rodadas diferentes', () => {
    const rows=[row('a','secondary','google/gemini-3.8-flash'),{...row('a','secondary','openai/gpt-6.1-terra'),run_id:'another'}];
    expect(savedPublicationRoles(rows,['a']).size).toBe(0);
  });
  it('nunca usa reprovação nem inconclusivo no anúncio', () => {
    const urls=['a','b','c','d'];
    const roles=savedPublicationRoles([row('a'),row('b'),row('c','secondary',undefined,'reprovada'),row('d','secondary',undefined,'inconclusiva')],urls);
    expect(savedPublishableImages(roles,urls)).toEqual([]);
  });
  it('reprovação explícita do primeiro modelo não exige segunda opinião nem nova IA', () => {
    expect(savedPublicationRoles([row('a','secondary','google/gemini-3.8-flash','reprovada')],['a']).get('a')?.secondary?.verdict).toBe('reprovada');
  });
  it('exige principal ou reserva limpa OK, não usa medidas como principal', () => {
    const urls=['a','b','c'];
    expect(savedPublishableImages(savedPublicationRoles(urls.map(url=>({...row(url),reason_code:'MEDIDA_SOBREPOSTA'})),urls),urls)).toEqual([]);
  });
  it('crédito pausa, limite espera, negação de provedor não recebe sondagem', () => {
    expect(publicationFailurePolicy(402)).toBe('credit');
    expect(publicationFailurePolicy(429)).toBe('rate');
    expect(publicationFailurePolicy(403,'provider_access_denied')).toBe('terminal');
  });
});