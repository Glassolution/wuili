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
  opts: { max?: number; maxChecks?: number; dryRun?: boolean; forceRecheck?: boolean } = {},
): Promise<VisionFilterResult> {
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
