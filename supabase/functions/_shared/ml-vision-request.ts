import { generateChatCompletion, type GeminiChatMessage } from 'npm:@lovable.dev/ai-gateway@0.1.11';
import type {} from './generated/ai-gateway/models.d.ts';

export const IMAGE_VALIDATION_REVISION = 'tri-state-explicit-2026-11-08';
export const IMAGE_VISION_PROMPT = 'Você audita imagens de produto para o Mercado Livre. Responda APENAS com JSON: ' +
  '{"clean":true|false,"reason":"..."}. clean=false APENAS se a imagem tiver marca d\'água, logo/nome de loja ou de fornecedor, ' +
  'texto promocional sobreposto (preço, "oferta", "frete grátis", "compre já"), infográfico com textos explicativos, ' +
  'moldura com texto ou banner publicitário. clean=true para foto do produto em fundo limpo, inclusive quando mostra ' +
  'várias cores/ângulos do mesmo produto lado a lado, sombra, reflexo ou a marca impressa no próprio produto. ' +
  'Se não conseguir ver ou analisar a imagem, retorne {"clean":null,"reason":"análise inconclusiva"}; nunca retorne false por falha técnica.';

export async function requestImageVision(input: string, runId?: string) {
  const messages: GeminiChatMessage[] = [
    { role: 'system', content: IMAGE_VISION_PROMPT },
    { role: 'user', content: [
      { type: 'text', text: 'Esta imagem pode ser publicada como foto de produto?' },
      { type: 'image_url', image_url: { url: input } },
    ] },
  ];
  const result = await generateChatCompletion({
    model: 'google/gemini-3.6-flash', messages, max_tokens: 1200,
  }, { signal: AbortSignal.timeout(30000), maxRetries: 0, ...(runId ? { runId } : {}) });
  const content = result.choices?.[0]?.message?.content;
  return { raw: typeof content === 'string' ? content : null, usage: result.usage, id: result.id };
}