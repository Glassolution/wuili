import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { imageEvidencePrefix } from './ml-image-criterion.ts';
import { imageInput, isInconclusiveImageReason, parseImageVerdict, reclassifySavedEvidence } from './ml-image-input.ts';
import { IMAGE_CRITERION_VERSION } from './ml-image-criterion.ts';
import { primarySizeDecision } from './ml-primary-size.ts';
import { filterCleanImagesCached } from './ml-image-vision.ts';
import { imageProductDecision } from './ml-vision-policy.ts';
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

Deno.test('falha ou JSON sem booleano não aprova nem reprova foto', () => {
  for (const raw of [null, '', '{}', '{"clean":"true"}', 'invalid']) assertEquals(parseImageVerdict(raw).clean, null);
});
Deno.test('decisões explícitas preservam foto limpa e rejeição real', () => {
  assertEquals(parseImageVerdict('{"veredito":"aprovada","codigo":"OK","localizacao":"FUNDO_LIMPO","justificativa":"foto limpa"}').clean, true);
  assertEquals(parseImageVerdict('{"veredito":"reprovada","codigo":"MARCA_DAGUA","localizacao":"SOBRE_FOTO","justificativa":"marca de água"}').clean, false);
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
Deno.test('dry-run com aprovação nova não grava cache', async () => {
  let writes = 0;
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }), upsert: () => { writes++; return Promise.resolve({}); } }) } as unknown as SupabaseClient;
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({ id: 'dry-test', choices: [{ message: { content: '{"veredito":"aprovada","codigo":"OK","localizacao":"FUNDO_LIMPO","justificativa":"foto limpa"}' } }] }), { headers: { 'Content-Type': 'application/json' } }));
  try {
    const result = await filterCleanImagesCached(db, ['https://example.com/photo.jpg'], { dryRun: true });
    assertEquals(result.clean.length, 0);
    assertEquals(result.inconclusive.length > 0, true);
    assertEquals(writes, 0);
  } finally { globalThis.fetch = original; }
});
Deno.test('erro da IA não interrompe próximo item nem grava reprovação', async () => {
  let writes = 0;
  let calls = 0;
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: [] }) }), upsert: () => { writes++; return Promise.resolve({}); } }) } as unknown as SupabaseClient;
  const original = globalThis.fetch;
  globalThis.fetch = () => { calls++; return calls === 1
    ? Promise.resolve(new Response('error', { status: 500 }))
    : Promise.resolve(new Response(JSON.stringify({ id: 'next-test', choices: [{ message: { content: '{"veredito":"aprovada","codigo":"OK","localizacao":"FUNDO_LIMPO","justificativa":"foto limpa"}' } }] }), { headers: { 'Content-Type': 'application/json' } })); };
  try {
    const result = await filterCleanImagesCached(db, ['https://example.com/a.jpg', 'https://example.com/b.jpg'], { dryRun: true });
    assertEquals(result.clean.length, 0);
    assertEquals(result.inconclusive.length > 0, true);
    assertEquals(result.rejected.length, 0);
    assertEquals(writes, 0);
  } finally { globalThis.fetch = original; }
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
  const rows = [{ url: 'https://example.com/photo.jpg', clean: false, reason: parseImageVerdict(JSON.stringify({ veredito: 'reprovada', codigo: 'MARCA_DAGUA', localizacao: 'SOBRE_FOTO', justificativa: 'marca de água' }), false).reason, checked_at: new Date().toISOString() }];
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: rows }) }) }) } as unknown as SupabaseClient;
  const result = await filterCleanImagesCached(db, [rows[0].url]);
  assertEquals(result.clean.length, 0);
  assertEquals(result.rejected.length, 1);
  assertEquals(result.inconclusive.length, 0);
});
Deno.test('rótulo físico e embalagem original são aprovados', () => {
  for (const location of ['PRODUTO', 'EMBALAGEM']) {
    assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'aprovada', codigo: 'OK', localizacao: location, justificativa: 'Texto impresso na etiqueta da embalagem' })).clean, true);
  }
});
Deno.test('rejeição atribuída a impressão física não é prova de sobreposição', () => {
  assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'reprovada', codigo: 'SOBREPOSICAO_TEXTO', localizacao: 'EMBALAGEM', justificativa: 'Especificações impressas' })).clean, null);
});
Deno.test('medidas sobrepostas não dependem da palavra texto', () => {
  for (const reason of ['Medidas e setas sobrepostas indicando dimensões', 'Texto com dimensões']) {
    assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'reprovada', codigo: 'MEDIDA_SOBREPOSTA', localizacao: 'SOBRE_FOTO', justificativa: reason }), true).clean, false);
  }
});
Deno.test('colagem e ausência do produto exigem evidência na imagem inteira', () => {
  for (const code of ['COLAGEM', 'SEM_PRODUTO']) {
    assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'reprovada', codigo: code, localizacao: 'IMAGEM_INTEIRA', justificativa: 'Evidência visual identificada' }), true).clean, false);
    assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'reprovada', codigo: code, localizacao: 'DESCONHECIDA', justificativa: 'Evidência visual identificada' })).clean, null);
  }
});
Deno.test('resposta antiga sem evidência estruturada exige análise nova', () => {
  assertEquals(parseImageVerdict('{"clean":false,"reason":"texto na embalagem"}').clean, null);
});
Deno.test('cache de critério antigo não rejeita nem desbloqueia produto', async () => {
  let writes = 0;
  const rows = [{ url: 'https://example.com/pack.jpg', clean: false, reason: 'texto na embalagem', checked_at: new Date().toISOString() }];
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: rows }) }), upsert: () => { writes++; return Promise.resolve({}); } }) } as unknown as SupabaseClient;
  const result = await filterCleanImagesCached(db, [rows[0].url], { maxChecks: 0, dryRun: true });
  assertEquals(result.rejected.length, 0);
  assertEquals(result.inconclusive.length, 1);
  assertEquals(writes, 0);
});

Deno.test('principal só aprova fundo limpo e cache tem escopo próprio', () => {
  const data = { veredito: 'aprovada', codigo: 'OK', localizacao: 'EMBALAGEM', justificativa: 'Etiqueta física original' };
  assertEquals(parseImageVerdict(JSON.stringify(data), true).clean, null);
  assertEquals(parseImageVerdict(JSON.stringify({ ...data, localizacao: 'FUNDO_LIMPO' }), true).clean, true);
  assertEquals(imageEvidencePrefix(true) === imageEvidencePrefix(false), false);
});
Deno.test('banner e inserção circular têm rejeição codificada sem regex do motivo', () => {
  for (const codigo of ['SOBREPOSICAO_TEXTO', 'INSERCAO_CIRCULAR']) {
    assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'reprovada', codigo, localizacao: 'SOBRE_FOTO', justificativa: 'Arte de divulgação adicionada' }), true).clean, false);
  }
});
Deno.test('cerca JSON completa preserva validação estrita do conteúdo', () => {
  const raw = JSON.stringify({ veredito: 'aprovada', codigo: 'OK', localizacao: 'FUNDO_LIMPO', justificativa: 'Fundo limpo' });
  for (const wrapper of ['```json\n' + raw + '\n```', '```\n' + raw + '\n```', '  ```JSON\r\n' + raw + '\r\n```  ']) {
    assertEquals(parseImageVerdict(wrapper, true).clean, true);
  }
  const rejected = JSON.stringify({ veredito: 'reprovada', codigo: 'MARCA_DAGUA', localizacao: 'SOBRE_FOTO', justificativa: 'Marca sobreposta' });
  assertEquals(parseImageVerdict('```json\n' + rejected + '\n```').clean, false);
});
Deno.test('fora do esquema ou cerca incompleta/prosa permanece inconclusivo', () => {
  const raw = JSON.stringify({ veredito: 'aprovada', codigo: 'OK', localizacao: 'PRODUTO', justificativa: 'Produto físico' });
  for (const invalid of ['Prosa\n```json\n' + raw + '\n```', '```json\n' + raw, '```js\n' + raw + '\n```', '```json\n' + raw.slice(0, -1) + ',"extra":true}\n```', raw.slice(0, -1) + ',"extra":true}', raw.replace('"OK"', '"inventado"')]) assertEquals(parseImageVerdict(invalid).clean, null);
});
Deno.test('primeira foto aceita exige principal mesmo após rejeição da primeira URL', async () => {
  const urls = ['https://example.com/rejected.jpg', 'https://example.com/gallery.jpg'];
  const rows = [
    { url: urls[0], clean: false, reason: parseImageVerdict(JSON.stringify({ veredito: 'reprovada', codigo: 'MARCA_DAGUA', localizacao: 'SOBRE_FOTO', justificativa: 'Logo sobreposto' }), false).reason, checked_at: new Date().toISOString() },
    { url: urls[1], clean: true, reason: parseImageVerdict(JSON.stringify({ veredito: 'aprovada', codigo: 'OK', localizacao: 'PRODUTO', justificativa: 'Foto de galeria' }), false).reason, checked_at: new Date().toISOString() },
  ];
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: rows }) }) }) } as unknown as SupabaseClient;
  const result = await filterCleanImagesCached(db, urls, { maxChecks: 0, dryRun: true });
  assertEquals(result.clean.length, 0);
  assertEquals(result.rejected.length, 1);
  assertEquals(result.inconclusive.length, 2);
});

Deno.test('medida e inserção secundária mudam por código sem IA e preservam código', () => {
  for (const codigo of ['MEDIDA_SOBREPOSTA', 'INSERCAO_CIRCULAR'] as const) {
    const original = { veredito: 'reprovada', codigo, localizacao: 'SOBRE_FOTO', justificativa: 'evidência salva' } as const;
    const secondary = reclassifySavedEvidence(original);
    assertEquals(secondary.veredito, 'aprovada');
    assertEquals(secondary.codigo, codigo);
    assertEquals(parseImageVerdict(JSON.stringify(secondary)).clean, true);
    assertEquals(reclassifySavedEvidence(original, true).veredito, 'reprovada');
  }
});
Deno.test('texto e colagem antigos exigem revisão sem regex de justificativa', () => {
  for (const codigo of ['SOBREPOSICAO_TEXTO', 'COLAGEM'] as const) assertEquals(reclassifySavedEvidence({ veredito: 'reprovada', codigo, localizacao: 'SOBRE_FOTO', justificativa: 'promoção ou especificação' }).veredito, 'inconclusiva');
});
Deno.test('aprovação por medida ou inserção não ignora evidência promocional', () => {
  for (const codigo of ['MEDIDA_SOBREPOSTA', 'INSERCAO_CIRCULAR'] as const) {
    for (const justificativa of ['arte promocional', 'arte publicitária', 'textos de divulgação', 'banner', 'arte gráfica']) {
      assertEquals(reclassifySavedEvidence({ veredito: 'aprovada', codigo, localizacao: 'SOBRE_FOTO', justificativa }).veredito, 'inconclusiva');
    }
    assertEquals(reclassifySavedEvidence({ veredito: 'reprovada', codigo, localizacao: 'SOBRE_FOTO', justificativa: 'Detalhe da parte interna' }).veredito, 'aprovada');
  }
});
Deno.test('principal mínimo 500x500 em ambas as dimensões', () => {
  assertEquals(primarySizeDecision(500, 500), 'eligible');
  assertEquals(primarySizeDecision(499, 1000), 'too_small');
  assertEquals(primarySizeDecision(1000, 499), 'too_small');
});
Deno.test('secundárias rejeitam só códigos proibidos e embalagem não é principal', () => {
  for (const codigo of ['CONTATO_QR', 'BANNER_PROMOCIONAL', 'PRECO_FRETE', 'SELO_ML', 'VARIOS_PRODUTOS']) assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'reprovada', codigo, localizacao: 'IMAGEM_INTEIRA', justificativa: 'evidência identificada' })).clean, false);
  assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'aprovada', codigo: 'OK', localizacao: 'EMBALAGEM', justificativa: 'embalagem' })).clean, true);
  assertEquals(parseImageVerdict(JSON.stringify({ veredito: 'aprovada', codigo: 'OK', localizacao: 'EMBALAGEM', justificativa: 'embalagem' }), true).clean, null);
});
Deno.test('publicação reordena principal elegível sem perder secundária original', async () => {
  const urls = ['https://example.com/pack.jpg', 'https://example.com/clean.jpg'];
  const ok = { veredito: 'aprovada', codigo: 'OK', localizacao: 'FUNDO_LIMPO', justificativa: 'produto limpo' };
  const rows = urls.map((url, i) => ({ url, clean: true, checked_at: new Date().toISOString(), reason: `[${IMAGE_CRITERION_VERSION}] roles: ` + JSON.stringify({ secondary: i === 0 ? { ...ok, localizacao: 'EMBALAGEM' } : ok, primary: i === 0 ? { veredito: 'reprovada', codigo: 'EMBALAGEM_PRINCIPAL', localizacao: 'EMBALAGEM', justificativa: 'embalagem' } : ok }) }));
  const db = { from: () => ({ select: () => ({ in: () => Promise.resolve({ data: rows }) }) }) } as unknown as SupabaseClient;
  const result = await filterCleanImagesCached(db, urls, { maxChecks: 0, dryRun: true });
  assertEquals(result.clean, [urls[1], urls[0]]);
});
