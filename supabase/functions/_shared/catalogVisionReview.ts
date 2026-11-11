// Conferência gradual de fotos do catálogo — SOMENTE registra resultados.
//
// Regra (Felipe, 11/11): mesma regra de dupla aprovação da `ml-publish`
// (gemini-3.8-flash em todas as fotos, gpt-6.1-terra só nas aprovadas pelo
// primeiro; só passa se os dois aprovarem). Esta via nunca publica, nunca
// bloqueia/desbloqueia, nunca mexe em preço/estoque e nunca chama a ml-publish.
// Por isso as dependências abaixo NÃO têm nenhum método que faça essas coisas.
// Módulo puro (sem imports) para ser testado no Vitest e usado no Deno.

export const REVIEW_MODELS = ['google/gemini-3.8-flash', 'openai/gpt-6.1-terra'] as const;
export type ReviewModel = typeof REVIEW_MODELS[number];
export type Role = 'primary' | 'secondary';
export const MIN_APPROVED = 3;
export const PRIMARY_CANDIDATES = 3;

export type ModelAnswer =
  | { kind: 'verdict'; verdict: 'aprovada' | 'reprovada'; code: string; location: string; justification: string; raw: string | null }
  | { kind: 'invalid'; raw: string | null; reason: string }
  | { kind: 'failure'; status?: number; type?: string; retryAfter?: number; refusal?: boolean; timeout?: boolean; reason: string };

export type EvidenceRow = {
  record_key: string; run_id: string; product_id: string; product_title: string; image_url: string; image_role: Role;
  verdict: 'aprovada' | 'reprovada' | 'inconclusiva'; reason_code: string; evidence_location: string; justification: string;
  criterion_version: string; model: string; method: 'catalog_review_dual'; evidence: Record<string, unknown>;
};
export type CachedDecision = { verdict: 'aprovada' | 'reprovada'; code: string; justification: string };

export type ReviewDeps = {
  askModel(model: ReviewModel, url: string, role: Role): Promise<ModelAnswer>;
  primarySize(url: string): Promise<'eligible' | 'too_small' | 'unavailable'>;
  appendEvidence(rows: EvidenceRow[]): Promise<void>;
  readCache(key: string): Promise<CachedDecision | null>;
  writeCache(key: string, decision: CachedDecision): Promise<void>;
};

export type PauseKind = 'credit' | 'denied' | 'rate' | 'temporary' | 'config';
export type Halt = { kind: PauseKind; message: string; delaySeconds: number | null };

/** Chave do cache: versão do critério + os dois modelos + papel + URL. */
export function reviewCacheKey(criterion: string, role: Role, url: string) {
  return `${criterion}|${REVIEW_MODELS.join('+')}|${role}|${url}`;
}

/** Espera limitada; Retry-After só é honrado em 429/5xx. */
export function backoffSeconds(consecutiveFailures: number, retryAfter?: number) {
  if (retryAfter && retryAfter > 0) return Math.min(3600, Math.max(60, Math.ceil(retryAfter)));
  return Math.min(3600, 300 * 2 ** Math.max(0, Math.min(4, consecutiveFailures)));
}

/**
 * Toda falha do provedor pausa a cadeia inteira (nunca retry imediato).
 * 402/403 e recusa: pausa até ação do dono, sem probes. 429/5xx: pausa com espera limitada.
 * Timeout/rede: pausa temporária sem retomada automática por Retry-After.
 */
export function classifyFailure(f: Extract<ModelAnswer, { kind: 'failure' }>, consecutiveFailures = 0): Halt {
  if (f.refusal) return { kind: 'denied', message: `Recusa do provedor: ${f.reason}`, delaySeconds: null };
  if (f.status === 402) return { kind: 'credit', message: f.reason, delaySeconds: null };
  if (f.status === 403) {
    const credit = ['credit_limit_reached', 'ai_disabled'].includes(f.type ?? '');
    return { kind: credit ? 'credit' : 'denied', message: f.reason, delaySeconds: null };
  }
  if (f.status === 429 || (f.status !== undefined && f.status >= 500)) {
    return { kind: 'rate', message: f.reason, delaySeconds: backoffSeconds(consecutiveFailures, f.retryAfter) };
  }
  if (f.status !== undefined && f.status >= 400) return { kind: 'config', message: f.reason, delaySeconds: null };
  return { kind: 'temporary', message: f.reason, delaySeconds: null };
}

type PhotoResult = { decision: 'aprovada' | 'reprovada' | 'inconclusiva'; halt?: Halt; calls: number };

/** Uma foto em um papel: os dois modelos em sequência; só decisões explícitas viram cache. */
export async function reviewPhoto(deps: ReviewDeps, ctx: { runId: string; productId: string; title: string; criterion: string }, url: string, role: Role, budget: { calls: number }): Promise<PhotoResult> {
  const key = reviewCacheKey(ctx.criterion, role, url);
  const cached = await deps.readCache(key);
  if (cached) return { decision: cached.verdict, calls: 0 };
  if (role === 'primary') {
    const size = await deps.primarySize(url);
    if (size === 'unavailable') return { decision: 'inconclusiva', calls: 0 };
    if (size === 'too_small') {
      const d: CachedDecision = { verdict: 'reprovada', code: 'RESOLUCAO_INSUFICIENTE', justification: 'Foto principal menor que 500x500 pixels' };
      await deps.appendEvidence([row(ctx, url, role, 'size-check', d.verdict, d.code, 'IMAGEM_INTEIRA', d.justification, { source: 'size_check' }, 0)]);
      await deps.writeCache(key, d);
      return { decision: 'reprovada', calls: 0 };
    }
  }
  const rows: EvidenceRow[] = [];
  let calls = 0; let decision: PhotoResult['decision'] = 'aprovada'; let halt: Halt | undefined; let first: CachedDecision | undefined;
  for (const [index, model] of REVIEW_MODELS.entries()) {
    if (budget.calls <= 0) { decision = 'inconclusiva'; halt = { kind: 'temporary', message: 'Teto de chamadas da execução atingido', delaySeconds: 0 }; break; }
    budget.calls--; calls++;
    let answer: ModelAnswer;
    try { answer = await deps.askModel(model, url, role); }
    catch (e) { answer = { kind: 'failure', reason: e instanceof Error ? e.message : 'Falha inesperada' }; }
    if (answer.kind === 'verdict') {
      rows.push(row(ctx, url, role, model, answer.verdict, answer.code, answer.location, answer.justification, { raw: answer.raw, pipeline_models: REVIEW_MODELS }, index));
      first ??= { verdict: answer.verdict, code: answer.code, justification: answer.justification };
      if (answer.verdict === 'reprovada') { decision = 'reprovada'; first = { verdict: 'reprovada', code: answer.code, justification: answer.justification }; break; }
      continue;
    }
    // Schema inválido, timeout ou falha: inconclusiva. Nunca aprovação, nunca reprovação.
    rows.push(row(ctx, url, role, model, 'inconclusiva', answer.kind === 'invalid' ? 'RESPOSTA_FORA_DO_FORMATO' : 'FALHA_TECNICA', 'NAO_SE_APLICA', answer.reason.slice(0, 400),
      { raw: answer.kind === 'invalid' ? answer.raw : null, failure: answer.kind === 'failure' ? { status: answer.status, type: answer.type, timeout: answer.timeout === true } : undefined }, index));
    decision = 'inconclusiva';
    if (answer.kind === 'failure') halt = classifyFailure(answer);
    break;
  }
  // Evidência gravada ANTES de qualquer cache ou avanço da fila.
  if (rows.length) await deps.appendEvidence(rows);
  if (decision !== 'inconclusiva' && first) await deps.writeCache(key, decision === 'aprovada' ? first : { ...first, verdict: 'reprovada' });
  return { decision, halt, calls };
}

function row(ctx: { runId: string; productId: string; title: string; criterion: string }, url: string, role: Role, model: string, verdict: EvidenceRow['verdict'], code: string, location: string, justification: string, evidence: Record<string, unknown>, index: number): EvidenceRow {
  return { record_key: `${ctx.runId}:${ctx.productId}:${url}:${role}:${index}`, run_id: ctx.runId, product_id: ctx.productId, product_title: ctx.title,
    image_url: url, image_role: role, verdict, reason_code: code, evidence_location: location, justification, criterion_version: ctx.criterion, model, method: 'catalog_review_dual', evidence };
}

export type ProductOutcome = 'eligible' | 'no_primary' | 'insufficient' | 'inconclusive';
export type ProductReview = { outcome: ProductOutcome | null; halt?: Halt; calls: number; approved: string[]; primary?: string };

/** Principal = 1ª aprovada pelos dois entre as 3 primeiras fotos; parada antecipada com principal + 3 aprovadas. */
export async function reviewProduct(deps: ReviewDeps, ctx: { runId: string; productId: string; title: string; criterion: string }, urls: string[], budget: { calls: number }): Promise<ProductReview> {
  const list = [...new Set(urls.filter(u => typeof u === 'string' && u.startsWith('http')))].slice(0, 50);
  const approved: string[] = []; let primary: string | undefined; let inconclusive = false; let calls = 0;
  for (const [index, url] of list.entries()) {
    if (primary && approved.length >= MIN_APPROVED) break;
    const secondary = await reviewPhoto(deps, ctx, url, 'secondary', budget); calls += secondary.calls;
    if (secondary.halt) return { outcome: null, halt: secondary.halt, calls, approved, primary };
    if (secondary.decision === 'inconclusiva') { inconclusive = true; continue; }
    if (secondary.decision === 'reprovada') continue;
    approved.push(url);
    if (!primary && index < PRIMARY_CANDIDATES) {
      const p = await reviewPhoto(deps, ctx, url, 'primary', budget); calls += p.calls;
      if (p.halt) return { outcome: null, halt: p.halt, calls, approved, primary };
      if (p.decision === 'aprovada') primary = url; else if (p.decision === 'inconclusiva') inconclusive = true;
    }
  }
  const outcome: ProductOutcome = primary && approved.length >= MIN_APPROVED ? 'eligible' : inconclusive ? 'inconclusive' : !primary ? 'no_primary' : 'insufficient';
  return { outcome, calls, approved, primary };
}

export type QueueItem = { id: string; product_id: string; title: string; urls: string[] };
export type QueueStore = {
  acquireLease(owner: string, ttlSeconds: number): Promise<number | null>;
  claim(token: number, limit: number): Promise<QueueItem[]>;
  complete(token: number, id: string, outcome: ProductOutcome, summary: Record<string, unknown>): Promise<boolean>;
  release(token: number, id: string): Promise<void>;
  pause(token: number, halt: Halt): Promise<void>;
  end(token: number, success: boolean): Promise<{ remaining: number }>;
};

export type BatchResult = { ran: boolean; processed: number; outcomes: Record<ProductOutcome, number>; calls: number; halt?: Halt; remaining: number; fencedOut: number };

/** Um lote pequeno e sequencial, com lease atômico e fencing. */
export async function runReviewBatch(store: QueueStore, deps: ReviewDeps, opts: { owner: string; runId: string; criterion: string; maxProducts: number; maxCalls: number; leaseSeconds: number }): Promise<BatchResult> {
  const outcomes: Record<ProductOutcome, number> = { eligible: 0, no_primary: 0, insufficient: 0, inconclusive: 0 };
  const token = await store.acquireLease(opts.owner, opts.leaseSeconds);
  if (token === null) return { ran: false, processed: 0, outcomes, calls: 0, remaining: -1, fencedOut: 0 };
  const budget = { calls: Math.max(0, opts.maxCalls) };
  let processed = 0; let calls = 0; let halt: Halt | undefined; let fencedOut = 0;
  try {
    const items = await store.claim(token, Math.max(0, Math.min(opts.maxProducts, 20)));
    for (const item of items) {
      if (halt) { await store.release(token, item.id); continue; }
      const r = await reviewProduct(deps, { runId: opts.runId, productId: item.product_id, title: item.title, criterion: opts.criterion }, item.urls, budget);
      calls += r.calls;
      if (r.halt || r.outcome === null) { halt = r.halt; await store.release(token, item.id); continue; }
      const ok = await store.complete(token, item.id, r.outcome, { approved: r.approved, primary: r.primary ?? null, calls: r.calls });
      if (ok) { processed++; outcomes[r.outcome]++; } else fencedOut++;
    }
    if (halt && halt.delaySeconds !== 0) await store.pause(token, halt);
  } catch (e) {
    halt = { kind: 'temporary', message: e instanceof Error ? e.message : 'Falha ao gravar', delaySeconds: null };
    await store.pause(token, halt);
  }
  const { remaining } = await store.end(token, !halt);
  return { ran: true, processed, outcomes, calls, halt, remaining, fencedOut };
}

/** Próximo passo da cadeia só quando há trabalho, sem pausa e com orçamento de saltos. */
export function shouldChainNext(r: BatchResult, hopsLeft: number) {
  return r.ran && !r.halt && r.remaining > 0 && hopsLeft > 0 && r.processed > 0;
}

/** Estimativa conservadora antes de IA real (parada antecipada: ~5 fotos → até 2 modelos + principal). */
export function estimateBudget(products: number, creditsPerCall = 0.013) {
  const callsPerProduct = 8;
  const calls = products * callsPerProduct;
  return { products, callsPerProduct, calls, credits: Math.round(calls * creditsPerCall * 100) / 100 };
}

/** Falha da fila de publicação: instabilidade (503/429/5xx/sem resposta) não consome as 25 tentativas. */
export function attemptsAfterPublishFailure(attempts: number, httpStatus: number, code?: string) {
  const unavailable = code === 'IMAGE_COMPLIANCE_UNAVAILABLE' || httpStatus === 0 || httpStatus === 429 || httpStatus >= 500;
  return { attempts: unavailable ? attempts : attempts + 1, unavailable };
}
