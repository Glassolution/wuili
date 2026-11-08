import { generateChatCompletion, type GeminiChatMessage } from 'npm:@lovable.dev/ai-gateway@0.1.11';
import type {} from './generated/ai-gateway/models.d.ts';
import { IMAGE_CRITERION_VERSION, imageVisionPrompt } from './ml-image-criterion.ts';
export { IMAGE_VISION_PROMPT } from './ml-image-criterion.ts';
export const IMAGE_VALIDATION_REVISION = IMAGE_CRITERION_VERSION;

export async function requestImageVision(input: string, runId?: string, primary = false) {
  const messages: GeminiChatMessage[] = [
    { role: 'system', content: imageVisionPrompt(primary) },
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