// Verificação visual das fotos com memória (cache) compartilhada por URL.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { visionCheck } from "./ml-content-sanitizer.ts";
import { parseImageVerdict, isExplicitVisualRejection } from "./ml-image-input.ts";
import { imageEvidencePrefix } from './ml-image-criterion.ts';
import { IMAGE_CRITERION_VERSION, type ImageVerdict } from './ml-image-criterion.ts';
import { checkPrimarySize } from './ml-primary-size.ts';
import { savedPublicationRoles, type SavedImageRow } from './saved-publication-images.ts';
import { imageCallAllowed, isTerminalImageFailure, recordImageFailure, recordImageSuccess, recordImageUsage } from './publication-image-state.ts';
import { requestImageVision, IMAGE_VISION_MODELS, isCreditImageFailure } from './ml-vision-request.ts';
import { imageInput } from './ml-image-input.ts';
import { sequentialVision } from './ml-vision-policy.ts';
import { imageFailureRetry } from './image-retry-policy.ts';

export type VisionFilterResult = {
  clean: string[];
  rejected: { url: string; reason: string }[];
  inconclusive: { url: string; reason: string }[];
  primaryRejected?: { url: string; reason: string }[];
  secondaryApproved?: string[];
  creditUnavailable?: boolean;
};

/** Quanto tempo um veredito continua valendo na auditoria legada (desativada). */
const VALIDADE_DIAS = 60;

/** Filtra fotos para a auditoria legada; a publicação usa o fluxo global abaixo. */
export async function filterCleanImagesCached(
  supabase: SupabaseClient,
  urls: string[],
  opts: { max?: number; maxChecks?: number; dryRun?: boolean; forceRecheck?: boolean; publication?: { productId?: string; title?: string; background?: boolean } } = {},
): Promise<VisionFilterResult> {
  if (opts.publication) return filterPublicationImages(supabase, urls, opts.publication, opts.dryRun === true);
  const max = opts.max ?? 6;
  const maxChecks = opts.maxChecks ?? urls.length * 2;
  const rejected: { url: string; reason: string }[] = [];
  const inconclusive: { url: string; reason: string }[] = [];
  const primaryRejected: { url: string; reason: string }[] = [];
  const candidatos: string[] = [];
  for (const url of urls) if (!candidatos.includes(url)) candidatos.push(url);
  if (candidatos.length === 0) return { clean: [], rejected, inconclusive };

  const limite = new Date(Date.now() - VALIDADE_DIAS * 864e5).toISOString();
  const { data: cacheRows } = await supabase.from("ml_image_vision_cache").select("url, clean, reason, checked_at").in("url", candidatos.slice(0, 50));
  const cache = new Map<string, { clean: boolean; reason?: string }>();
  for (const row of cacheRows ?? []) {
    if (String(row.checked_at) >= limite && typeof row.reason === 'string') cache.set(row.url as string, { clean: row.clean === true, reason: row.reason });
  }
  const clean: string[] = [];
  const evidenceByUrl = new Map<string, { secondary?: ImageVerdict; primary?: ImageVerdict }>();
  const changed = new Set<string>();
  let analises = 0;
  const rolePrefix = `[${IMAGE_CRITERION_VERSION}] roles: `;
  for (const url of candidatos) {
    const reason = cache.get(url)?.reason;
    if (!opts.forceRecheck && reason?.startsWith(rolePrefix)) {
      try { evidenceByUrl.set(url, JSON.parse(reason.slice(rolePrefix.length))); } catch { /* invalid cache needs analysis */ }
    } else if (!opts.forceRecheck && reason) {
      for (const primary of [false, true]) {
        const prefix = imageEvidencePrefix(primary);
        if (reason.startsWith(prefix)) {
          const parsed = parseImageVerdict(reason.slice(prefix.length), primary);
          if (parsed.clean !== null) evidenceByUrl.set(url, { [primary ? 'primary' : 'secondary']: parsed.evidence });
        }
      }
    }
  }
  async function check(url: string, primary: boolean) {
    const roles = evidenceByUrl.get(url) ?? {};
    const key = primary ? 'primary' : 'secondary';
    const saved = roles[key];
    if (saved) {
      const parsed = parseImageVerdict(JSON.stringify(saved), primary);
      if (parsed.clean !== null) return parsed;
    }
    if (analises >= maxChecks) return { clean: null, reason: 'limite de análise atingido' };
    if (primary) {
      const size = await checkPrimarySize(url);
      if (size === 'unavailable') return { clean: null, reason: 'falha técnica ao verificar resolução da principal' };
      if (size === 'too_small') {
        const evidence: ImageVerdict = { veredito: 'reprovada', codigo: 'RESOLUCAO_INSUFICIENTE', localizacao: 'IMAGEM_INTEIRA', justificativa: 'Foto principal menor que 500x500 pixels' };
        roles.primary = evidence; evidenceByUrl.set(url, roles); changed.add(url);
        return parseImageVerdict(JSON.stringify(evidence), true);
      }
    }
    analises++;
    let v;
    try { v = await visionCheck(url, primary); }
    catch { v = { clean: null, reason: 'análise indisponível: falha inesperada' }; }
    if (v.clean === null || (v.clean === false && !isExplicitVisualRejection(v.reason))) return { clean: null, reason: v.reason ?? 'análise inconclusiva' };
    const prefix = imageEvidencePrefix(primary);
    if (v.reason?.startsWith(prefix)) {
      roles[key] = parseImageVerdict(v.reason.slice(prefix.length), primary).evidence;
      evidenceByUrl.set(url, roles); changed.add(url);
    }
    return v;
  }
  let primaryUrl: string | undefined;
  for (const url of candidatos) {
    if (primaryUrl && clean.length >= max) break;
    const secondary = await check(url, false);
    if (secondary.clean === null) { inconclusive.push({ url, reason: secondary.reason ?? 'análise inconclusiva' }); continue; }
    if (!secondary.clean) { rejected.push({ url, reason: secondary.reason ?? 'reprovação visual' }); continue; }
    clean.push(url);
    if (!primaryUrl) {
      const primary = await check(url, true);
      if (primary.clean === true) primaryUrl = url;
      else if (primary.clean === null) inconclusive.push({ url, reason: primary.reason ?? 'principal inconclusiva' });
      else primaryRejected.push({ url, reason: primary.reason ?? 'principal reprovada' });
    }
  }
  if (!primaryUrl) primaryUrl = clean.find(url => evidenceByUrl.get(url)?.secondary?.codigo === 'OK');
  if (changed.size && !opts.dryRun) {
    const { error } = await supabase.from("ml_image_vision_cache").upsert(
      [...changed].map(url => ({ url, clean: evidenceByUrl.get(url)?.secondary?.veredito === 'aprovada', reason: rolePrefix + JSON.stringify(evidenceByUrl.get(url)), checked_at: new Date().toISOString() })),
      { onConflict: "url" },
    );
    if (error) console.warn("[ml-image-vision] não foi possível gravar o cache:", error.message);
  }
  return { clean: primaryUrl ? [primaryUrl, ...clean.filter(url => url !== primaryUrl)].slice(0, max) : [], rejected, inconclusive, primaryRejected, secondaryApproved: clean };
}

type CacheEntry = { url: string; clean: boolean | null; reason: string | null; checked_at: string };
type ClaimRow = { claimed: boolean; inconclusive_attempts: number; retry_after: string | null };

function cachedEvidence(entry: CacheEntry): SavedImageRow[] {
  const reason = entry.reason ?? '';
  const match = /^\[(two-level-[^\]]+)\] roles: (.+)$/.exec(reason);
  const single = /^\[(two-level-[^\]]+)\] (galeria|principal): (.+)$/.exec(reason);
  if (!match && !single) return [];
  const rows: SavedImageRow[] = [];
  try {
    if (single) {
      const primary = single[2] === 'principal';
      const parsed = parseImageVerdict(single[3], primary);
      if (parsed.clean !== null) rows.push({
        image_url: entry.url, image_role: primary ? 'primary' : 'secondary', verdict: parsed.evidence.veredito,
        reason_code: parsed.evidence.codigo, evidence_location: parsed.evidence.localizacao,
        justification: parsed.evidence.justificativa, criterion_version: single[1],
        model: single[1].includes('gemini-3.6-flash') || single[1] === 'two-level-v4-2026-11-08' ? 'google/gemini-3.6-flash' : 'google/gemini-3.8-flash',
        analyzed_at: entry.checked_at, run_id: 'cache-single',
      });
      return rows;
    }
    if (!match) return rows;
    const roles = JSON.parse(match[2]);
    for (const role of ['secondary', 'primary']) {
      const parsed = parseImageVerdict(JSON.stringify(roles[role]), role === 'primary');
      if (parsed.clean === null) continue;
      const model = match[1].includes('gpt-6.1-terra')
        ? 'google/gemini-3.8-flash+openai/gpt-6.1-terra'
        : match[1].includes('gemini-3.6-flash') || match[1] === 'two-level-v4-2026-11-08'
          ? 'google/gemini-3.6-flash'
          : 'google/gemini-3.8-flash';
      rows.push({
        image_url: entry.url, image_role: role, verdict: parsed.evidence.veredito,
        reason_code: parsed.evidence.codigo, evidence_location: parsed.evidence.localizacao,
        justification: parsed.evidence.justificativa, criterion_version: match[1], model,
        analyzed_at: entry.checked_at, run_id: 'cache',
      });
    }
  } catch { /* Invalid cache is not a verdict. */ }
  return rows;
}

/** Publication-only analysis: global URL verdicts, no early stop and no spending cap. */
async function filterPublicationImages(db: SupabaseClient, urls: string[], opts: { productId?: string; title?: string; background?: boolean }, dryRun: boolean): Promise<VisionFilterResult> {
  const candidates = [...new Set(urls)].slice(0, 50);
  const rows: SavedImageRow[] = [];
  // Evidence follows the URL, not the customer or product that first submitted it.
  const { data, error } = await db.from('catalog_image_analysis_results')
    .select('image_url,image_role,verdict,reason_code,evidence_location,justification,criterion_version,model,analyzed_at,run_id')
    .in('image_url', candidates).like('criterion_version', 'two-level-%')
    .order('analyzed_at', { ascending: false }).limit(3000);
  if (error) throw new Error(error.message);
  rows.push(...(data ?? []) as SavedImageRow[]);

  const { data: cache, error: cacheError } = await db.from('ml_image_vision_cache').select('url,reason,clean,checked_at').in('url', candidates);
  if (cacheError) throw new Error(cacheError.message);
  for (const entry of cache ?? []) rows.push(...cachedEvidence(entry as CacheEntry));
  const roles = savedPublicationRoles(rows, candidates);
  const rejected: VisionFilterResult['rejected'] = [];
  const inconclusive: VisionFilterResult['inconclusive'] = [];
  const primaryRejected: NonNullable<VisionFilterResult['primaryRejected']> = [];
  let halted = false;
  let creditUnavailable = false;
  const runId = crypto.randomUUID();

  async function check(url: string) {
    const saved = roles.get(url)?.secondary ?? (roles.get(url)?.primary?.verdict === 'aprovada' ? roles.get(url)?.primary : undefined);
    if (saved) return parseImageVerdict(JSON.stringify({ veredito: saved.verdict, codigo: saved.reason_code, localizacao: saved.evidence_location, justificativa: saved.justification }), false);
    if (dryRun) return { clean: null, reason: 'Foto ainda sem veredito; validação sem IA' };
    if (halted || !await imageCallAllowed(db, opts.background === true)) { halted = true; return { clean: null, reason: 'Conferência de fotos temporariamente indisponível' }; }

    const owner = crypto.randomUUID();
    const { data: claimData, error: claimError } = await db.rpc('claim_publication_image_analysis', { p_url: url, p_owner: owner });
    if (claimError) throw new Error(claimError.message);
    const claim = (claimData?.[0] ?? null) as ClaimRow | null;
    if (!claim?.claimed) {
      const { data: fresh } = await db.from('ml_image_vision_cache').select('url,reason,clean,checked_at').eq('url', url).maybeSingle();
      if (fresh) {
        const freshRoles = savedPublicationRoles(cachedEvidence(fresh as CacheEntry), [url]);
        const current = freshRoles.get(url);
        if (current) roles.set(url, current);
        const decision = current?.secondary ?? (current?.primary?.verdict === 'aprovada' ? current.primary : undefined);
        if (decision) return parseImageVerdict(JSON.stringify({ veredito: decision.verdict, codigo: decision.reason_code, localizacao: decision.evidence_location, justificativa: decision.justification }), false);
      }
      return { clean: null, reason: claim?.retry_after ? 'Duas análises inconclusivas; nova tentativa após 24h' : 'Esta foto já está sendo analisada' };
    }

    let finished = false;
    let stage = 'download';
    const fail = async (cause: unknown) => {
      if (finished) return;
      const creditFailure = isCreditImageFailure(cause);
      const retry = imageFailureRetry(claim.inconclusive_attempts ?? 0, creditFailure);
      const { error: finishError } = await db.rpc('finish_publication_image_analysis', {
        p_url: url, p_owner: owner, p_provider: creditFailure ? 'unavailable' : 'gemini',
        p_attempts: retry.attempts, p_retry_after: retry.retryAfter,
        p_error: cause instanceof Error ? cause.message : String(cause),
      });
      finished = true;
      if (finishError) throw new Error(finishError.message);
    };
    try {
      const input = await imageInput(url);
      stage = 'ai';
      const response = await requestImageVision(input, runId, false, IMAGE_VISION_MODELS[0]);
      try { await recordImageUsage(db, response.creditCost, response.provider === 'gemini_direct'); }
      catch (usageError) { console.warn('[ml-image-vision] alerta de consumo não registrado:', String(usageError)); }
      const parsed = parseImageVerdict(response.raw, false);
      if (opts.productId && /^[0-9a-f-]{36}$/i.test(opts.productId)) {
        const { error: evidenceError } = await db.from('catalog_image_analysis_results').insert({
          run_id: runId, record_key: `${url}:secondary:0`, product_id: opts.productId, product_title: opts.title ?? '',
          image_url: url, image_role: 'secondary', verdict: parsed.evidence.veredito, reason_code: parsed.evidence.codigo,
          evidence_location: parsed.evidence.localizacao, justification: parsed.evidence.justificativa,
          criterion_version: IMAGE_CRITERION_VERSION, model: IMAGE_VISION_MODELS[0], method: 'publication_single',
          evidence: { raw: response.raw, pipeline_models: IMAGE_VISION_MODELS, provider: response.provider },
        });
        if (evidenceError) throw new Error(`Falha ao guardar evidência: ${evidenceError.message}`);
      }
      if (parsed.clean === null) {
        await fail(new Error(parsed.reason));
        return parsed;
      }
      const current = roles.get(url) ?? {};
      current.secondary = {
        image_url: url, image_role: 'secondary', verdict: parsed.evidence.veredito, reason_code: parsed.evidence.codigo,
        evidence_location: parsed.evidence.localizacao, justification: parsed.evidence.justificativa,
        criterion_version: IMAGE_CRITERION_VERSION, model: IMAGE_VISION_MODELS[0], analyzed_at: new Date().toISOString(), run_id: runId,
      };
      roles.set(url, current);
      const cacheRoles: { secondary?: ImageVerdict; primary?: ImageVerdict } = {};
      for (const role of ['secondary', 'primary'] as const) {
        const row = current[role]; if (!row) continue;
        const evidence = parseImageVerdict(JSON.stringify({ veredito: row.verdict, codigo: row.reason_code, localizacao: row.evidence_location, justificativa: row.justification }), role === 'primary');
        if (evidence.clean !== null) cacheRoles[role] = evidence.evidence;
      }
      const reason = `[${IMAGE_CRITERION_VERSION}] roles: ${JSON.stringify(cacheRoles)}`;
      const { error: finishError } = await db.rpc('finish_publication_image_analysis', {
        p_url: url, p_owner: owner, p_reason: reason, p_clean: parsed.clean,
        p_provider: response.provider,
      });
      if (finishError) throw new Error(finishError.message);
      finished = true;
      await recordImageSuccess(db);
      return parsed;
    } catch (cause) {
      await fail(cause);
      if (isCreditImageFailure(cause)) creditUnavailable = true;
      if (isTerminalImageFailure(cause)) await recordImageFailure(db, cause);
      if (stage === 'ai') halted = true;
      return { clean: null, reason: cause instanceof Error ? cause.message : 'Conferência indisponível' };
    }
  }

  const approved: string[] = [];
  let primaryUrl: string | undefined;
  for (const url of candidates) {
    const secondary = await check(url);
    if (secondary.clean === null) { inconclusive.push({ url, reason: secondary.reason }); continue; }
    if (!secondary.clean) { rejected.push({ url, reason: secondary.reason }); continue; }
    approved.push(url);
    if (!primaryUrl) {
      const current = roles.get(url);
      const primarySaved = current?.primary;
      if (primarySaved?.verdict === 'aprovada') primaryUrl = url;
      else if (current?.secondary?.reason_code === 'OK') {
        const size = await checkPrimarySize(url);
        if (size === 'eligible') primaryUrl = url;
        else if (size === 'too_small') primaryRejected.push({ url, reason: 'Foto principal menor que 500x500 pixels' });
        else inconclusive.push({ url, reason: 'Falha técnica ao verificar resolução da principal' });
      } else {
        primaryRejected.push({ url, reason: primarySaved?.justification ?? 'A foto aprovada como secundária não atende às regras da principal' });
      }
    }
  }
  // All URLs must have a conclusive verdict; no early stop after three approvals.
  const clean = primaryUrl && approved.length >= 3 && inconclusive.length === 0
    ? [primaryUrl, ...approved.filter(url => url !== primaryUrl)].slice(0, 6)
    : [];
  return { clean, rejected, inconclusive, primaryRejected, secondaryApproved: approved, creditUnavailable };
}
