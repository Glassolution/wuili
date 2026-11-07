import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { imageInput, isInconclusiveImageReason, parseImageVerdict } from './ml-image-input.ts';
import { filterCleanImagesCached } from './ml-image-vision.ts';
import { imageProductDecision } from './ml-vision-policy.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

Deno.test('falha ou JSON sem booleano não aprova nem reprova foto', () => {
  for (const raw of [null, '', '{}', '{"clean":"true"}', 'invalid']) assertEquals(parseImageVerdict(raw).clean, null);
});
Deno.test('decisões explícitas preservam foto limpa e rejeição real', () => {
  assertEquals(parseImageVerdict('```json\n{"clean":true,"reason":"foto limpa"}\n```').clean, true);
  assertEquals(parseImageVerdict('{"clean":false,"reason":"marca de água"}').clean, false);
});
Deno.test('falhas antigas de leitura não são cache de reprovação', () => {
  assertEquals(isInconclusiveImageReason('não foi possível validar visualmente a imagem'), true);
  assertEquals(isInconclusiveImageReason('resposta inválida na validação visual'), true);
  assertEquals(isInconclusiveImageReason('marca de água'), false);
});
Deno.test('false por download, formato, timeout, IA ou resposta ilegível é inconclusivo', () => {
  for (const reason of ['falha download', 'formato não suportado', 'timeout', 'erro da IA', 'resposta ilegível', '']) {
    assertEquals(parseImageVerdict(JSON.stringify({ clean: false, reason })).clean, null);
  }
});
Deno.test('vazio ou misto inconclusivo nunca bloqueia; só rejeição explícita bloqueia', () => {
  assertEquals(imageProductDecision({ clean: [], rejected: [], inconclusive: [] }), 'inconclusive');
  assertEquals(imageProductDecision({ clean: [], rejected: [{ url: 'a', reason: 'texto promocional' }], inconclusive: [{ url: 'b', reason: 'timeout' }] }), 'inconclusive');
  assertEquals(imageProductDecision({ clean: [], rejected: [{ url: 'a', reason: 'texto promocional' }], inconclusive: [] }), 'rejected');
  assertEquals(imageProductDecision({ clean: ['a'], rejected: [], inconclusive: [] }), 'approved');
});
Deno.test('nome suspeito da URL não é reprovação visual', async () => {
  let writes = 0;
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }), upsert: () => { writes++; return Promise.resolve({}); } }) } as unknown as SupabaseClient;
  const result = await filterCleanImagesCached(db, ['https://example.com/banner.jpg'], { maxChecks: 0, dryRun: true });
  assertEquals(result.rejected.length, 0);
  assertEquals(result.inconclusive.length, 1);
  assertEquals(writes, 0);
});
Deno.test('foto da fornecedora é enviada com bytes e MIME real', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/webp' } }));
  try { assertEquals(await imageInput('https://arquivos.c7drop.com.br/test.webp'), 'data:image/webp;base64,AQID'); }
  finally { globalThis.fetch = original; }
});
Deno.test('cache inconclusivo não rejeita nem grava resultado com análise pendente', async () => {
  const rows = [{ url: 'https://example.com/photo.jpg', clean: false, reason: 'não foi possível validar visualmente a imagem', checked_at: new Date().toISOString() }];
  let writes = 0;
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: rows }) }), upsert: () => { writes++; return Promise.resolve({}); } }) } as unknown as SupabaseClient;
  const result = await filterCleanImagesCached(db, [rows[0].url], { maxChecks: 0 });
  assertEquals(result.clean.length, 0);
  assertEquals(result.rejected.length, 0);
  assertEquals(result.inconclusive.length, 1);
  assertEquals(writes, 0);
});
Deno.test('reprovação visual conclusiva permanece bloqueada no cache', async () => {
  const rows = [{ url: 'https://example.com/photo.jpg', clean: false, reason: 'marca de água', checked_at: new Date().toISOString() }];
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: rows }) }) }) } as unknown as SupabaseClient;
  const result = await filterCleanImagesCached(db, [rows[0].url]);
  assertEquals(result.clean.length, 0);
  assertEquals(result.rejected.length, 1);
  assertEquals(result.inconclusive.length, 0);
});