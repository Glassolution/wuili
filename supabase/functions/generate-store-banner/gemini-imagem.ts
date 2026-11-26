/*
  Geração de imagem direto na API do Gemini (GEMINI_API_KEY), sem passar pelo
  gateway da Lovable: os créditos da Lovable ficam para o trabalho no projeto.
  O custo passa a ser o da conta do Google dona da chave.
*/

export type ConfigDaImagem = { aspectRatio: string; imageSize?: "1K" | "2K" | "4K" };

/** Modelos tentados em ordem. O nome do Pro mudou de "-preview" para estável; vale o que existir. */
export const MODELOS_PRO = ["gemini-3-pro-image", "gemini-3-pro-image-preview"];
export const MODELO_RAPIDO = "gemini-2.5-flash-image";

export function pedidoDoGemini(prompt: string, config: ConfigDaImagem | null) {
  return {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(config ? { imageConfig: config } : {}),
    },
  };
}

type RespostaDoGemini = {
  candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
};

/** Devolve a imagem como data URL (o mesmo formato que o gateway devolvia) ou null. */
export function imagemDaResposta(resposta: RespostaDoGemini): string | null {
  for (const parte of resposta.candidates?.[0]?.content?.parts ?? []) {
    const { mimeType, data } = parte.inlineData ?? {};
    if (mimeType?.startsWith("image/") && data) return `data:${mimeType};base64,${data}`;
  }
  return null;
}

export type ResultadoDoGemini =
  | { ok: true; imageUrl: string }
  | { ok: false; status: number; motivo: string };

export async function gerarNoGemini(
  chave: string,
  modelo: string,
  prompt: string,
  config: ConfigDaImagem | null,
  fazerFetch: typeof fetch = fetch,
): Promise<ResultadoDoGemini> {
  let resposta: Response;
  try {
    resposta = await fazerFetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": chave },
      body: JSON.stringify(pedidoDoGemini(prompt, config)),
      signal: AbortSignal.timeout(120_000),
    });
  } catch {
    // Rede ou tempo esgotado: quem chama tenta o próximo modelo ou a reserva.
    return { ok: false, status: 0, motivo: "rede" };
  }
  if (!resposta.ok) {
    // Só o código e o status: o corpo pode repetir o prompt.
    const corpo = await resposta.json().catch(() => null) as { error?: { status?: string } } | null;
    return { ok: false, status: resposta.status, motivo: corpo?.error?.status ?? "erro" };
  }
  const json = await resposta.json() as RespostaDoGemini;
  if (json.promptFeedback?.blockReason) return { ok: false, status: 400, motivo: `recusa_${json.promptFeedback.blockReason}` };
  const imageUrl = imagemDaResposta(json);
  if (!imageUrl) return { ok: false, status: 502, motivo: `sem_imagem_${json.candidates?.[0]?.finishReason ?? "?"}` };
  return { ok: true, imageUrl };
}
