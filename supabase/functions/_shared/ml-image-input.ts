import { IMAGE_EVIDENCE_PREFIX, IMAGE_REJECTION_CODES, imageEvidencePrefix, type ImageVerdict } from './ml-image-criterion.ts';
/** Only supplier CDNs are fetched server-side; arbitrary user URLs stay remote. */
const SUPPLIER_HOSTS = new Set(['arquivos.c7drop.com.br', 'ae01.alicdn.com', 'ae-pic-a1.aliexpress-media.com']);
const MAX_BYTES = 8 * 1024 * 1024;

export async function imageInput(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.port) throw new Error('URL de imagem inválida');
  if (!SUPPLIER_HOSTS.has(parsed.hostname)) return url;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok || !response.body) throw new Error(`foto indisponível (${response.status})`);
  const mime = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) throw new Error('formato de imagem não suportado');
  if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) {
    await response.body.cancel();
    throw new Error('imagem maior que 8 MB');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('imagem maior que 8 MB'); }
    chunks.push(value);
  }
  if (!size) throw new Error('imagem vazia');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}

export function parseImageVerdict(raw: string | null, primary = false): { clean: boolean | null; reason: string; evidence: ImageVerdict } {
  const invalid: ImageVerdict = { veredito: 'inconclusiva', codigo: 'FALHA_TECNICA', localizacao: 'DESCONHECIDA', justificativa: 'resposta fora do esquema na validação visual' };
  const inconclusive = () => ({ clean: null, reason: invalid.justificativa, evidence: invalid });
  if (!raw) return inconclusive();
  try {
    // Accept one complete Markdown wrapper, never prose or partial JSON extraction.
    const trimmed = raw.trim();
    const fence = /^```(?:json)?\s*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);
    const parsed = JSON.parse(fence ? fence[1].trim() : trimmed);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return inconclusive();
    if (Object.keys(parsed).length !== 4 || !['veredito', 'codigo', 'localizacao', 'justificativa'].every(key => Object.hasOwn(parsed, key))) return inconclusive();
    if (typeof parsed.justificativa !== 'string' || !parsed.justificativa.trim() || parsed.justificativa.length > 400) return inconclusive();
    // Location is descriptive only: any value is kept as evidence and never decides the verdict.
    const location = typeof parsed.localizacao === 'string' && parsed.localizacao.trim()
      ? parsed.localizacao.trim().slice(0, 60)
      : 'DESCONHECIDA';
    parsed.localizacao = location;
    if (parsed.veredito === 'inconclusiva' && parsed.codigo === 'FALHA_TECNICA') {
      return { clean: null, reason: parsed.justificativa, evidence: { ...invalid, localizacao: location, justificativa: parsed.justificativa } };
    }
    const code = IMAGE_REJECTION_CODES.find(code => code === parsed.codigo);
    if (parsed.veredito === 'reprovada' && code) {
      const secondaryReject = ['MARCA_DAGUA', 'LOGO_LOJA', 'CONTATO_QR', 'BANNER_PROMOCIONAL', 'PRECO_FRETE', 'SELO_ML', 'VARIOS_PRODUTOS'];
      if (!primary && !secondaryReject.includes(code)) return inconclusive();
      const evidence: ImageVerdict = { veredito: 'reprovada', codigo: code, localizacao: parsed.localizacao, justificativa: parsed.justificativa };
      return { clean: false, reason: `${imageEvidencePrefix(primary)}${JSON.stringify(evidence)}`, evidence };
    }
    const allowed = ['OK', 'MEDIDA_SOBREPOSTA', 'INSERCAO_CIRCULAR', 'SOBREPOSICAO_TEXTO', 'COLAGEM'];
    if (parsed.veredito === 'aprovada' && (primary ? parsed.codigo === 'OK' : allowed.includes(parsed.codigo))) {
      const evidence: ImageVerdict = { veredito: 'aprovada', codigo: parsed.codigo, localizacao: parsed.localizacao, justificativa: parsed.justificativa };
      return { clean: true, reason: `${imageEvidencePrefix(primary)}${JSON.stringify(evidence)}`, evidence };
    }
    return inconclusive();
  } catch { /* An invalid response is not proof that a photo violates rules. */ }
  return inconclusive();
}

/** Reuse old evidence by code only; ambiguous text/montage and old primary OK need review. */
export function hasPromotionalEvidence(justification: string): boolean {
  const normalized = justification.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /\b(promocional\w*|publicitari\w*|divulgacao|banner\w*|arte\w*)\b/.test(normalized);
}

export function reclassifySavedEvidence(evidence: ImageVerdict, primary = false): ImageVerdict {
  if (evidence.codigo === 'FALHA_TECNICA') return { ...evidence, veredito: 'inconclusiva' };
  if (!primary && ['MEDIDA_SOBREPOSTA', 'INSERCAO_CIRCULAR'].includes(evidence.codigo)) return { ...evidence, veredito: hasPromotionalEvidence(evidence.justificativa) ? 'inconclusiva' : 'aprovada' };
  if (!primary && ['SOBREPOSICAO_TEXTO', 'COLAGEM', 'SEM_PRODUTO'].includes(evidence.codigo) || primary && evidence.codigo === 'OK') return { ...evidence, veredito: 'inconclusiva' };
  return evidence;
}

export function isInconclusiveImageReason(reason: string | null | undefined): boolean {
  return !!reason && /não foi possível|n[aã]o consigo|n[aã]o.*(ler|visualizar|analisar)|resposta.*(inválida|ilegível)|falha|inconclusiv|indisponível|timeout|download|formato.*(inválido|suportado)|erro.*(ia|http|análise)|limite de análise|sem reprovação visual/i.test(reason);
}

export function isExplicitVisualRejection(reason: unknown): boolean {
  if (typeof reason === 'string' && reason.startsWith(IMAGE_EVIDENCE_PREFIX)) {
    for (const primary of [false, true]) {
      const prefix = imageEvidencePrefix(primary);
      if (reason.startsWith(prefix)) return parseImageVerdict(reason.slice(prefix.length), primary).clean === false;
    }
  }
  return false;
}