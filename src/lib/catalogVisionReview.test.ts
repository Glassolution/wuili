import { describe, it, expect } from 'vitest';
import { reviewProduct, runReviewBatch, attemptsAfterPublishFailure, classifyFailure, type ReviewDeps, type ModelAnswer, type QueueStore } from '../../supabase/functions/_shared/catalogVisionReview';
const ok: ModelAnswer = { kind: 'verdict', verdict: 'aprovada', code: 'OK', location: 'FUNDO_LIMPO', justification: 'limpa', raw: '{}' };
const no: ModelAnswer = { kind: 'verdict', verdict: 'reprovada', code: 'MARCA_DAGUA', location: 'CANTO', justification: 'marca', raw: '{}' };
function deps(answer: (m: string, u: string, r: string) => ModelAnswer) {
  const log: string[] = []; const cache = new Map(); const evidence: unknown[] = [];
  const d: ReviewDeps = {
    askModel: async (m, u, r) => { log.push(`${m}|${u}|${r}`); return answer(m, u, r); },
    primarySize: async () => 'eligible',
    appendEvidence: async rows => { evidence.push(...rows); },
    readCache: async k => cache.get(k) ?? null,
    writeCache: async (k, v) => { cache.set(k, v); },
  };
  return { d, log, cache, evidence };
}
const ctx = { runId: 'r', productId: 'p', title: 't', criterion: 'v' };
const urls = ['http://a', 'http://b', 'http://c', 'http://d', 'http://e'];
describe('conferência de fotos (só registra)', () => {
  it('aprova só com os dois modelos e para cedo com principal + 3', async () => {
    const { d, log } = deps(() => ok);
    const r = await reviewProduct(d, ctx, urls, { calls: 100 });
    expect(r.outcome).toBe('eligible'); expect(r.approved).toEqual(['http://a', 'http://b', 'http://c']);
    expect(log.some(l => l.includes('http://d'))).toBe(false);
  });
  it('reprovação do primeiro pula o segundo; reprovação do segundo reprova', async () => {
    const a = deps(m => m.startsWith('google') ? no : ok); await reviewProduct(a.d, ctx, urls, { calls: 100 });
    expect(a.log.every(l => l.startsWith('google'))).toBe(true);
    const b = deps(m => m.startsWith('openai') ? no : ok);
    expect((await reviewProduct(b.d, ctx, urls, { calls: 100 })).outcome).toBe('no_primary');
  });
  it('schema inválido fica inconclusivo, sem cache', async () => {
    const { d, cache } = deps(() => ({ kind: 'invalid', raw: 'x', reason: 'fora do formato' }));
    expect((await reviewProduct(d, ctx, urls, { calls: 100 })).outcome).toBe('inconclusive'); expect(cache.size).toBe(0);
  });
  it('timeout de qualquer modelo pausa e nunca aprova', async () => {
    for (const bad of ['google', 'openai']) {
      const { d, cache } = deps(m => m.startsWith(bad) ? { kind: 'failure', timeout: true, reason: 'timeout' } : ok);
      const r = await reviewProduct(d, ctx, urls, { calls: 100 });
      expect(r.outcome).toBeNull(); expect(r.halt?.kind).toBe('temporary'); expect(cache.size).toBe(0);
    }
  });
  it('principal precisa estar entre as 3 primeiras', async () => {
    const { d } = deps((_m, u, r) => r === 'primary' ? no : ok);
    expect((await reviewProduct(d, ctx, urls, { calls: 100 })).outcome).toBe('no_primary');
  });
  it('402/403 pausam sem espera; 429 respeita Retry-After limitado', () => {
    expect(classifyFailure({ kind: 'failure', status: 402, reason: 'x' })).toMatchObject({ kind: 'credit', delaySeconds: null });
    expect(classifyFailure({ kind: 'failure', status: 403, reason: 'x' }).kind).toBe('denied');
    expect(classifyFailure({ kind: 'failure', status: 429, retryAfter: 99999, reason: 'x' }).delaySeconds).toBe(3600);
  });
  it('lote: lease ocupado não roda; pausa persiste e item volta à fila; fencing', async () => {
    const calls: string[] = [];
    const store = (token: number | null, completeOk = true): QueueStore => ({
      acquireLease: async () => token, claim: async () => [{ id: 'q1', product_id: 'p', title: 't', urls }, { id: 'q2', product_id: 'p2', title: 't', urls }],
      complete: async (_t, id) => { calls.push('complete:' + id); return completeOk; }, release: async (_t, id) => { calls.push('release:' + id); },
      pause: async (_t, h) => { calls.push('pause:' + h.kind); }, end: async () => ({ remaining: 1 }),
    });
    expect((await runReviewBatch(store(null), deps(() => ok).d, { owner: 'o', runId: 'r', criterion: 'v', maxProducts: 5, maxCalls: 50, leaseSeconds: 60 })).ran).toBe(false);
    const r = await runReviewBatch(store(1), deps(() => ({ kind: 'failure', status: 402, reason: 'sem créditos' })).d, { owner: 'o', runId: 'r', criterion: 'v', maxProducts: 5, maxCalls: 50, leaseSeconds: 60 });
    expect(calls).toEqual(['release:q1', 'release:q2', 'pause:credit']); expect(r.halt?.kind).toBe('credit');
    const f = await runReviewBatch(store(2, false), deps(() => ok).d, { owner: 'o', runId: 'r', criterion: 'v', maxProducts: 5, maxCalls: 50, leaseSeconds: 60 });
    expect(f.fencedOut).toBe(2); expect(f.processed).toBe(0);
  });
  it('dependências da conferência não têm publicar/bloquear', () => {
    const keys = Object.keys(deps(() => ok).d);
    expect(keys.some(k => /publish|block|price|stock/i.test(k))).toBe(false);
  });
  it('503 e instabilidade não consomem as 25 tentativas', () => {
    expect(attemptsAfterPublishFailure(10, 503).attempts).toBe(10);
    expect(attemptsAfterPublishFailure(10, 200, 'IMAGE_COMPLIANCE_UNAVAILABLE').attempts).toBe(10);
    expect(attemptsAfterPublishFailure(10, 409).attempts).toBe(11);
  });
});
