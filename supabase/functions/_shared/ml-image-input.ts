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

export function parseImageVerdict(raw: string | null): { clean: boolean | null; reason: string } {
  if (!raw) return { clean: null, reason: 'não foi possível validar visualmente a imagem' };
  const text = raw.replace(/```json|```/g, '').trim();
  const candidate = text.startsWith('{') ? text : (text.match(/\{[\s\S]*\}/)?.[0] ?? '');
  try {
    const parsed = JSON.parse(candidate);
    if (typeof parsed.clean === 'boolean') return {
      clean: parsed.clean,
      reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    };
  } catch { /* An invalid response is not proof that a photo violates rules. */ }
  return { clean: null, reason: 'resposta inválida na validação visual' };
}

export function isInconclusiveImageReason(reason: string | null | undefined): boolean {
  return !!reason && /não foi possível validar|resposta inválida|falha.*(valid|análise)|análise.*indisponível/i.test(reason);
}