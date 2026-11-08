import { ACTIVE_IMAGE_PIPELINE, IMAGE_CRITERION_VERSION, IMAGE_VISION_PIPELINES, imageVisionPrompt } from './ml-image-criterion.ts';
export { IMAGE_VISION_PROMPT } from './ml-image-criterion.ts';
export const IMAGE_VALIDATION_REVISION = IMAGE_CRITERION_VERSION;
export type VisionModel = 'google/gemini-3.6-flash' | 'google/gemini-3.8-flash' | 'openai/gpt-6.1-terra';
/** Models of the active pipeline, in order; catalog audit and publication share them. Default reasoning (no effort override). */
export const IMAGE_VISION_MODELS: readonly VisionModel[] = IMAGE_VISION_PIPELINES[ACTIVE_IMAGE_PIPELINE].models;
export const IMAGE_VISION_MODEL: VisionModel = IMAGE_VISION_MODELS[0];

const AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export async function requestImageVision(input: string, runId?: string, primary = false, model: VisionModel = IMAGE_VISION_MODEL) {
  const key = Deno.env.get('LOVABLE_API_KEY');
  if (!key) throw new Error('LOVABLE_API_KEY ausente');
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system', content: imageVisionPrompt(primary) },
      { role: 'user', content: [
        { type: 'text', text: 'Esta imagem pode ser publicada como foto de produto?' },
        { type: 'image_url', image_url: { url: input } },
      ] },
    ],
    response_format: { type: 'json_object' },
  };
  // OpenAI chat models take max_completion_tokens; Gemini keeps max_tokens. Same cap for both.
  body[model.startsWith('openai/') ? 'max_completion_tokens' : 'max_tokens'] = 1200;
  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(runId ? { 'X-Lovable-AIG-Run-ID': runId } : {}) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`gateway ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const result = await res.json();
  const content = result.choices?.[0]?.message?.content;
  return { raw: typeof content === 'string' ? content : null, usage: result.usage, id: result.id };
}
