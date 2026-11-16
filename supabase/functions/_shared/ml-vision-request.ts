import { ACTIVE_IMAGE_PIPELINE, IMAGE_CRITERION_VERSION, IMAGE_VISION_PIPELINES, imageVisionPrompt } from './ml-image-criterion.ts';
import { GatewayError, generateChatCompletion } from 'npm:@lovable.dev/ai-gateway@0.1.11';
import type {} from './gateway-models.d.ts';
export { IMAGE_VISION_PROMPT } from './ml-image-criterion.ts';
export const IMAGE_VALIDATION_REVISION = IMAGE_CRITERION_VERSION;
export type VisionModel = 'google/gemini-3.8-flash';
/** Only Gemini 3.8 Flash performs new visual analyses. */
export const IMAGE_VISION_MODELS: readonly VisionModel[] = IMAGE_VISION_PIPELINES[ACTIVE_IMAGE_PIPELINE].models;
export const IMAGE_VISION_MODEL: VisionModel = IMAGE_VISION_MODELS[0];

type VisionUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
};

export function visionCreditCost(usage?: VisionUsage): number {
  if (!usage) return 0;
  const prompt = Math.max(0, usage.prompt_tokens ?? 0);
  const cached = Math.max(0, Math.min(prompt, usage.prompt_tokens_details?.cached_tokens ?? 0));
  const completion = Math.max(0, usage.completion_tokens ?? 0);
  return (prompt - cached) * 0.000003 + cached * 0.0000003 + completion * 0.000015;
}

export function shouldUseDirectGemini(status?: number, type?: string): boolean {
  return status === 402 || (status === 403 && ['credit_limit_reached', 'ai_disabled'].includes(type ?? ''));
}

export function isCreditImageFailure(error: unknown): boolean {
  const gateway = error instanceof GatewayError ? error : undefined;
  const candidate = error as { status?: number; httpStatus?: number; type?: string } | undefined;
  return shouldUseDirectGemini(gateway?.httpStatus ?? candidate?.httpStatus ?? candidate?.status, gateway?.remote?.type ?? candidate?.type);
}

async function requestDirectGemini(input: string, primary: boolean) {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) {
    const error = new Error('Créditos Lovable esgotados e GEMINI_API_KEY não configurada') as Error & { status?: number; type?: string };
    error.status = 402;
    error.type = 'credit_limit_reached';
    throw error;
  }
  const data = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(input);
  const imagePart = data
    ? { inline_data: { mime_type: data[1], data: data[2] } }
    : { file_data: { mime_type: 'image/jpeg', file_uri: input } };
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: imageVisionPrompt(primary) }] },
      contents: [{ role: 'user', parts: [
        { text: 'Esta imagem pode ser publicada como foto de produto? Responda em JSON.' },
        imagePart,
      ] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 1200 },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Gemini direto indisponível (HTTP ${response.status}): ${body.slice(0, 300)}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  const result = await response.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    promptFeedback?: { blockReason?: string };
  };
  if (result.promptFeedback?.blockReason) throw new Error(`Recusa do Gemini direto: ${result.promptFeedback.blockReason}`);
  const raw = result.candidates?.[0]?.content?.parts?.map(part => part.text ?? '').join('') || null;
  return { raw, usage: undefined, id: undefined, provider: 'gemini_direct', creditCost: 0 };
}

export async function requestImageVision(input: string, runId?: string, primary = false, model: VisionModel = IMAGE_VISION_MODEL) {
  const request = {
    model,
    messages: [
      { role: 'system' as const, content: imageVisionPrompt(primary) },
      { role: 'user' as const, content: [
        { type: 'text' as const, text: 'Esta imagem pode ser publicada como foto de produto?' },
        { type: 'image_url' as const, image_url: { url: input } },
      ] },
    ],
    response_format: { type: 'json_object' as const },
    max_tokens: 1200,
  };
  try {
    const result = await generateChatCompletion(request, { signal: AbortSignal.timeout(30000), runId, maxRetries: 0 });
    const content = result.choices?.[0]?.message?.content;
    return {
      raw: typeof content === 'string' ? content : null,
      usage: result.usage,
      id: result.id,
      provider: 'lovable_gateway',
      creditCost: visionCreditCost(result.usage as VisionUsage | undefined),
    };
  } catch (error) {
    const gateway = error instanceof GatewayError ? error : undefined;
    if (gateway && shouldUseDirectGemini(gateway.httpStatus, gateway.remote?.type)) {
      return requestDirectGemini(input, primary);
    }
    throw error;
  }
}
