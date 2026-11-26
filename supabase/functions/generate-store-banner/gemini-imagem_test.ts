import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { gerarNoGemini, imagemDaResposta, pedidoDoGemini } from "./gemini-imagem.ts";

Deno.test("pede só imagem e manda proporção/tamanho quando houver", () => {
  const corpo = pedidoDoGemini("cena", { aspectRatio: "16:9", imageSize: "2K" });
  assertEquals(corpo.generationConfig, { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "16:9", imageSize: "2K" } });
  assertEquals(pedidoDoGemini("cena", null).generationConfig, { responseModalities: ["IMAGE"] });
});

Deno.test("lê a imagem da resposta como data URL e ignora texto", () => {
  const url = imagemDaResposta({ candidates: [{ content: { parts: [{}, { inlineData: { mimeType: "image/png", data: "AAAA" } }] } }] });
  assertEquals(url, "data:image/png;base64,AAAA");
  assertEquals(imagemDaResposta({ candidates: [] }), null);
});

Deno.test("usa a chave no cabeçalho, nunca na URL, e não expõe o corpo do erro", async () => {
  let chamada: { url: string; init?: RequestInit } | null = null;
  const fetchFalso = ((url: string, init?: RequestInit) => {
    chamada = { url, init };
    return Promise.resolve(new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "prompt..." } }), { status: 429 }));
  }) as typeof fetch;
  const r = await gerarNoGemini("chave-teste", "gemini-2.5-flash-image", "cena", null, fetchFalso);
  assertEquals(r, { ok: false, status: 429, motivo: "RESOURCE_EXHAUSTED" });
  assertEquals(chamada!.url.includes("chave-teste"), false);
  assertEquals((chamada!.init!.headers as Record<string, string>)["x-goog-api-key"], "chave-teste");
});

Deno.test("recusa e resposta sem imagem viram falha", async () => {
  const resposta = (corpo: unknown) => (() => Promise.resolve(new Response(JSON.stringify(corpo)))) as unknown as typeof fetch;
  assertEquals(await gerarNoGemini("k", "m", "p", null, resposta({ promptFeedback: { blockReason: "SAFETY" } })), { ok: false, status: 400, motivo: "recusa_SAFETY" });
  assertEquals(await gerarNoGemini("k", "m", "p", null, resposta({ candidates: [{ finishReason: "STOP", content: { parts: [] } }] })), { ok: false, status: 502, motivo: "sem_imagem_STOP" });
});

Deno.test("falha de rede vira resultado, não exceção", async () => {
  const quebrado = (() => Promise.reject(new TypeError("network"))) as unknown as typeof fetch;
  assertEquals(await gerarNoGemini("k", "m", "p", null, quebrado), { ok: false, status: 0, motivo: "rede" });
});
