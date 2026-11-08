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
import { isInconclusiveImageReason, isExplicitVisualRejection } from "./ml-image-input.ts";
import { imageEvidencePrefix } from './ml-image-criterion.ts';

export type VisionFilterResult = {
  clean: string[];
  rejected: { url: string; reason: string }[];
  inconclusive: { url: string; reason: string }[];
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
  const maxChecks = opts.maxChecks ?? 14;

  const rejected: { url: string; reason: string }[] = [];
  const inconclusive: { url: string; reason: string }[] = [];
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
    const primary = row.url === candidatos[0];
    if (String(row.checked_at) >= limite && typeof row.reason === 'string' && row.reason.startsWith(imageEvidencePrefix(primary)) &&
      (row.clean === true || (row.clean === false && isExplicitVisualRejection(row.reason)))) {
      cache.set(row.url as string, { clean: !!row.clean, reason: row.reason ?? undefined });
    }
  }

  const clean: string[] = [];
  const novos: Array<{ url: string; clean: boolean; reason: string | null }> = [];
  let analises = 0;

  for (const url of candidatos) {
    if (clean.length >= max) break;
    let veredito = opts.forceRecheck ? undefined : cache.get(url);
    if (!veredito) {
      if (analises >= maxChecks) {
        inconclusive.push({ url, reason: 'limite de análise atingido' });
        continue;
      }
      analises++;
      let v;
      try { v = await visionCheck(url, url === candidatos[0]); }
      catch { v = { clean: null, reason: 'análise indisponível: falha inesperada' }; }
      if (v.clean === null || (v.clean === false && !isExplicitVisualRejection(v.reason))) {
        inconclusive.push({ url, reason: v.reason ?? 'análise inconclusiva' });
        continue;
      }
      veredito = { clean: v.clean, reason: v.reason };
      novos.push({ url, clean: v.clean, reason: v.reason ?? null });
    }
    if (veredito.clean) clean.push(url);
    else {
      rejected.push({
        url,
        reason: veredito.reason || "marca d'água ou texto promocional na imagem",
      });
    }
  }

  if (novos.length && !opts.dryRun) {
    const { error } = await supabase
      .from("ml_image_vision_cache")
      .upsert(
        novos.map((n) => ({ ...n, checked_at: new Date().toISOString() })),
        { onConflict: "url" },
      );
    if (error) console.warn("[ml-image-vision] não foi possível gravar o cache:", error.message);
  }

  return { clean: clean.slice(0, max), rejected, inconclusive };
}
