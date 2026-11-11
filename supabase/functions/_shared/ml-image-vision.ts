// Verificação visual das fotos com memória (cache) compartilhada.
//
// Antes, o catálogo usava só a heurística de URL e a `ml-publish` usava IA:
// o produto aparecia no catálogo e só na hora de publicar o lojista descobria
// que as fotos eram arte do fornecedor. Agora as duas pontas usam ESTA função,
// com o veredito de cada foto gravado em `ml_image_vision_cache` — a mesma
// imagem nunca é analisada duas vezes, então auditar o catálogo inteiro é
// barato e o resultado é idêntico ao da publicação.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { visionCheck } from "./ml-content-sanitizer.ts";
import { parseImageVerdict, isExplicitVisualRejection } from "./ml-image-input.ts";
import { imageEvidencePrefix } from './ml-image-criterion.ts';
import { IMAGE_CRITERION_VERSION, type ImageVerdict } from './ml-image-criterion.ts';
import { checkPrimarySize } from './ml-primary-size.ts';
import { savedPublicationRoles, savedPublishableImages, type SavedImageRow } from './saved-publication-images.ts';
import { imageCallAllowed, recordImageFailure, recordImageSuccess } from './publication-image-state.ts';
import { requestImageVision, IMAGE_VISION_MODELS } from './ml-vision-request.ts';
import { imageInput } from './ml-image-input.ts';
import { sequentialVision } from './ml-vision-policy.ts';

export type VisionFilterResult = {
  clean: string[];
  rejected: { url: string; reason: string }[];
  inconclusive: { url: string; reason: string }[];
  primaryRejected?: { url: string; reason: string }[];
  secondaryApproved?: string[];
};

/** Quanto tempo um veredito continua valendo (fotos do fornecedor não mudam). */
const VALIDADE_DIAS = 60;

/**
 * Filtra as fotos de um produto usando o cache. `max` limita quantas fotos
 * limpas retornam; `maxChecks` limita quantas análises novas são feitas por
 * produto (as já conhecidas pelo cache não contam).
 */
export async function filterCleanImagesCached(
  supabase: SupabaseClient,
  urls: string[],
  opts: { max?: number; maxChecks?: number; dryRun?: boolean; forceRecheck?: boolean; publication?: { productId?: string; title?: string; background?: boolean } } = {},
): Promise<VisionFilterResult> {
  if (opts.publication) return filterPublicationImages(supabase, urls, opts.publication, opts.dryRun === true);
  const max = opts.max ?? 6;
  // Each URL can require a secondary and a primary verdict, not just one check.
  const maxChecks = opts.maxChecks ?? urls.length * 2;

  const rejected: { url: string; reason: string }[] = [];
  const inconclusive: { url: string; reason: string }[] = [];
  const primaryRejected: { url: string; reason: string }[] = [];
  const candidatos: string[] = [];

  for (const url of urls) {
    // A filename is not a visual verdict; even suspicious URLs must be seen.
    if (!candidatos.includes(url)) {
      candidatos.push(url);
    }
  }
  if (candidatos.length === 0) return { clean: [], rejected, inconclusive };

  const limite = new Date(Date.now() - VALIDADE_DIAS * 864e5).toISOString();
  const { data: cacheRows } = await supabase
    .from("ml_image_vision_cache")
    .select("url, clean, reason, checked_at")
    .in("url", candidatos.slice(0, 50));

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
      if (analises >= maxChecks) {
        return { clean: null, reason: 'limite de análise atingido' };
      }
      if (primary) {
        const size = await checkPrimarySize(url);
        if (size === 'unavailable') return { clean: null, reason: 'falha técnica ao verificar resolução da principal' };
        if (size === 'too_small') {
          const evidence: ImageVerdict = { veredito: 'reprovada', codigo: 'RESOLUCAO_INSUFICIENTE', localizacao: 'IMAGEM_INTEIRA', justificativa: 'Foto principal menor que 500x500 pixels' };
          roles.primary = evidence;
          evidenceByUrl.set(url, roles); changed.add(url);
          return parseImageVerdict(JSON.stringify(evidence), true);
        }
      }
      analises++;
      let v;
      try { v = await visionCheck(url, primary); }
      catch { v = { clean: null, reason: 'análise indisponível: falha inesperada' }; }
      if (v.clean === null || (v.clean === false && !isExplicitVisualRejection(v.reason))) {
        return { clean: null, reason: v.reason ?? 'análise inconclusiva' };
      }
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
  // Fallback (regra do dono, 09/11): sem principal aprovada, usa a melhor foto limpa da galeria —
  // aprovada pelos modelos como secundária com código OK (sem texto, medida, inserção ou embalagem).
  if (!primaryUrl) {
    primaryUrl = clean.find(url => evidenceByUrl.get(url)?.secondary?.codigo === 'OK');
  }
  if (changed.size && !opts.dryRun) {
    const { error } = await supabase
      .from("ml_image_vision_cache")
      .upsert(
        [...changed].map(url => ({ url, clean: evidenceByUrl.get(url)?.secondary?.veredito === 'aprovada', reason: rolePrefix + JSON.stringify(evidenceByUrl.get(url)), checked_at: new Date().toISOString() })),
        { onConflict: "url" },
      );
    if (error) console.warn("[ml-image-vision] não foi possível gravar o cache:", error.message);
  }

  return { clean: primaryUrl ? [primaryUrl, ...clean.filter(url => url !== primaryUrl)].slice(0, max) : [], rejected, inconclusive, primaryRejected, secondaryApproved: clean };
}

/** Publication reuses dual evidence from any two-level revision, never legacy single-model approvals. */
async function filterPublicationImages(db: SupabaseClient, urls: string[], opts: { productId?: string; title?: string; background?: boolean }, dryRun: boolean): Promise<VisionFilterResult> {
  const candidates = [...new Set(urls)].slice(0, 50);
  const rows: SavedImageRow[] = [];
  if (opts.productId && /^[0-9a-f-]{36}$/i.test(opts.productId)) {
    const { data, error } = await db.from('catalog_image_analysis_results')
      .select('image_url,image_role,verdict,reason_code,evidence_location,justification,criterion_version,model,analyzed_at,run_id')
      .eq('product_id', opts.productId).in('image_url', candidates).like('criterion_version', 'two-level-%')
      .order('analyzed_at', { ascending: false }).limit(3000);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []) as SavedImageRow[]);
  }
  // Production dual verdicts previously lived ONLY in cache. Reuse these as dual evidence too.
  const { data: cache, error: cacheError } = await db.from('ml_image_vision_cache').select('url,reason,checked_at').in('url', candidates);
  if (cacheError) throw new Error(cacheError.message);
  for (const entry of cache ?? []) {
    const match = /^\[(two-level-[^\]]*gemini-3\.8-flash\+gpt-6\.1-terra)\] roles: (.+)$/.exec(entry.reason ?? '');
    if (!match) continue;
    try {
      const roles = JSON.parse(match[2]);
      for (const role of ['secondary','primary']) {
        const evidence = roles[role];
        const parsed = parseImageVerdict(JSON.stringify(evidence), role === 'primary');
        if (parsed.clean === null) continue;
        rows.push({ image_url: entry.url, image_role: role, verdict: parsed.evidence.veredito,
          reason_code: parsed.evidence.codigo, evidence_location: parsed.evidence.localizacao, justification: parsed.evidence.justificativa,
          criterion_version: match[1], model: 'google/gemini-3.8-flash+openai/gpt-6.1-terra', analyzed_at: entry.checked_at, run_id: 'cache' });
      }
    } catch { /* Invalid cache is not a verdict. */ }
  }
  const roles = savedPublicationRoles(rows, candidates);
  const rejected: VisionFilterResult['rejected'] = [];
  const inconclusive: VisionFilterResult['inconclusive'] = [];
  const primaryRejected: NonNullable<VisionFilterResult['primaryRejected']> = [];
  const immediate = savedPublishableImages(roles,candidates);
  if (immediate.length >= 3) return { clean: immediate, rejected, inconclusive, primaryRejected, secondaryApproved: immediate };
  if (dryRun) return { clean: [], rejected, inconclusive: [{url: candidates[0] ?? '',reason:'Fotos aprovadas insuficientes; validação sem IA'}], primaryRejected, secondaryApproved: [] };
  let halted = false;
  const runId = crypto.randomUUID();
  async function check(url: string, primary: boolean) {
    const key = primary ? 'primary' : 'secondary';
    const saved = roles.get(url)?.[key];
    if (saved) return parseImageVerdict(JSON.stringify({veredito:saved.verdict,codigo:saved.reason_code,localizacao:saved.evidence_location,justificativa:saved.justification}),primary);
    if (halted || !await imageCallAllowed(db,opts.background === true)) return { clean: null,reason:'Conferência de fotos pausada' };
    const opinions: Array<{model:string;raw:string|null;evidence:ImageVerdict}> = [];
    try {
      if (primary) {
        const size = await checkPrimarySize(url);
        if (size !== 'eligible') return {clean: size === 'too_small' ? false : null,reason:'Não foi possível aprovar a resolução da principal'};
      }
      const input = await imageInput(url);
      const result = await sequentialVision(IMAGE_VISION_MODELS, async model => {
        try {
          const {raw} = await requestImageVision(input,runId,primary,model);
          const parsed = parseImageVerdict(raw,primary);
          opinions.push({model,raw,evidence:parsed.evidence});
          if (parsed.clean === null) throw new Error('Resposta visual fora do formato ou inconclusiva');
          return {clean:parsed.clean,reason:parsed.reason};
        } catch(error) {
          halted = true;
          await recordImageFailure(db,error);
          return {clean:null,reason:error instanceof Error ? error.message : 'Falha da IA'};
        }
      });
      if (opts.productId && /^[0-9a-f-]{36}$/i.test(opts.productId) && opinions.length) {
        const {error} = await db.from('catalog_image_analysis_results').insert(opinions.map((opinion,index)=>({
          run_id:runId,record_key:`${url}:${key}:${index}`,product_id:opts.productId,product_title:opts.title ?? '',image_url:url,image_role:key,
          verdict:opinion.evidence.veredito,reason_code:opinion.evidence.codigo,evidence_location:opinion.evidence.localizacao,
          justification:opinion.evidence.justificativa,criterion_version:IMAGE_CRITERION_VERSION,model:opinion.model,
          method:'publication_dual',evidence:{raw:opinion.raw,pipeline_models:IMAGE_VISION_MODELS},
        })));
        if (error) throw new Error(`Falha ao guardar evidência: ${error.message}`);
      }
      if (result.clean !== null && opinions[0]) {
        const evidence = result.clean ? opinions[0].evidence : opinions.find(o=>o.evidence.veredito==='reprovada')?.evidence;
        if (evidence) {
          const current = roles.get(url) ?? {};
          current[key] = {image_url:url,image_role:key,verdict:evidence.veredito,reason_code:evidence.codigo,evidence_location:evidence.localizacao,
            justification:evidence.justificativa,criterion_version:IMAGE_CRITERION_VERSION,model:IMAGE_VISION_MODELS.join('+'),analyzed_at:new Date().toISOString(),run_id:runId};
          roles.set(url,current);
          const cacheRoles: {secondary?:ImageVerdict;primary?:ImageVerdict} = {};
          for (const role of ['secondary','primary'] as const) {
            const row=current[role]; if (!row) continue;
            const parsed=parseImageVerdict(JSON.stringify({veredito:row.verdict,codigo:row.reason_code,localizacao:row.evidence_location,justificativa:row.justification}),role==='primary');
            if(parsed.clean!==null) cacheRoles[role]=parsed.evidence;
          }
          const {error} = await db.from('ml_image_vision_cache').upsert({url,clean:current.secondary?.verdict==='aprovada',reason:`[${IMAGE_CRITERION_VERSION}] roles: ${JSON.stringify(cacheRoles)}`,checked_at:new Date().toISOString()},{onConflict:'url'});
          if(error) throw new Error(error.message);
          await recordImageSuccess(db);
        }
      }
      return result;
    } catch(error) {
      halted=true; await recordImageFailure(db,error);
      return {clean:null,reason:error instanceof Error ? error.message : 'Conferência indisponível'};
    }
  }
  const approved: string[] = [];
  let primaryUrl: string | undefined;
  for (const url of candidates) {
    const secondary = await check(url,false);
    if(secondary.clean === null) { inconclusive.push({url,reason:secondary.reason}); if(halted) break; continue; }
    if(!secondary.clean) { rejected.push({url,reason:secondary.reason}); continue; }
    approved.push(url);
    if(!primaryUrl) {
      const primary=await check(url,true);
      if(primary.clean) primaryUrl=url;
      else if(primary.clean===null) inconclusive.push({url,reason:primary.reason});
      else primaryRejected.push({url,reason:primary.reason});
    }
    const publishable=savedPublishableImages(roles,candidates);
    if(publishable.length>=3) return {clean:publishable,rejected,inconclusive,primaryRejected,secondaryApproved:approved};
    if(halted) break;
  }
  return {clean:[],rejected,inconclusive,primaryRejected,secondaryApproved:approved};
}
