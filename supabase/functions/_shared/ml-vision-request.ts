import { ACTIVE_IMAGE_PIPELINE, IMAGE_CRITERION_VERSION, IMAGE_VISION_PIPELINES, imageVisionPrompt } from './ml-image-criterion.ts';
import { generateChatCompletion } from 'npm:@lovable.dev/ai-gateway@0.1.11';
import type {} from './gateway-models.d.ts';
export { IMAGE_VISION_PROMPT } from './ml-image-criterion.ts';
export const IMAGE_VALIDATION_REVISION = IMAGE_CRITERION_VERSION;
export type VisionModel = 'google/gemini-3.6-flash' | 'google/gemini-3.8-flash' | 'openai/gpt-6.1-terra';
/** Models of the active pipeline, in order; catalog audit and publication share them. Default reasoning (no effort override). */
export const IMAGE_VISION_MODELS: readonly VisionModel[] = IMAGE_VISION_PIPELINES[ACTIVE_IMAGE_PIPELINE].models;
export const IMAGE_VISION_MODEL: VisionModel = IMAGE_VISION_MODELS[0];

export async function requestImageVision(input: string, runId?: string, primary = false, model: VisionModel = IMAGE_VISION_MODEL) {
  const common = {
    messages: [
      { role: 'system' as const, content: imageVisionPrompt(primary) },
      { role: 'user' as const, content: [
        { type: 'text' as const, text: 'Esta imagem pode ser publicada como foto de produto?' },
        { type: 'image_url' as const, image_url: { url: input } },
      ] },
    ],
    response_format: { type: 'json_object' as const },
  };
  const options = { signal: AbortSignal.timeout(30000), runId, maxRetries: 0 };
  const result = model === 'openai/gpt-6.1-terra'
    ? await generateChatCompletion({ ...common, model: 'openai/gpt-6.1-terra', max_completion_tokens: 1200 }, options)
    : await generateChatCompletion({ ...common, model, max_tokens: 1200 }, options);
  const content = result.choices?.[0]?.message?.content;
  return { raw: typeof content === 'string' ? content : null, usage: result.usage, id: result.id };
}
