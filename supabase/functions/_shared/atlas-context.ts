/**
 * Janela de contexto do Atlas com resumo progressivo.
 *
 * Conversa longa reenviada por inteiro a cada mensagem é o maior custo do chat:
 * o histórico cresce, o preço por resposta cresce junto, e quase nada do começo
 * ainda importa. Aqui as últimas mensagens seguem cruas (é onde está o assunto
 * atual) e o excedente vira um resumo curto e estruturado, gerado uma vez pelo
 * modelo mais barato.
 *
 * O resumo guarda o que muda o rumo da conversa — produto escolhido,
 * marketplace, etapa do guia, pendências — e não a transcrição.
 */

export type ContextMessage = { role: string; content: string; product_data?: unknown };

/** Mensagens recentes que sempre vão cruas. */
export const JANELA_RECENTE = 10;
/** Abaixo disso não compensa resumir: o histórico já é barato. */
export const LIMITE_PARA_RESUMIR = 16;

export const MODELO_RESUMO = "google/gemini-2.5-flash-lite";

const PROMPT_RESUMO =
  "Resuma a conversa abaixo entre um usuário e o Atlas (assistente da Velo) em no máximo 120 palavras, em português brasileiro. " +
  "Escreva em tópicos curtos e registre apenas fatos que ainda importam: produto escolhido (nome e id se houver), nicho, marketplace, " +
  "etapa do fluxo (ex.: passo 2 de 4), se a conta do Mercado Livre já está conectada, dúvidas ainda abertas e decisões tomadas. " +
  "Não invente nada e não escreva conselhos.";

type ResumoDeps = {
  apiKey: string;
  /** Telemetria opcional: o chamador decide como registrar. */
  onUso?: (info: { modelo: string; data: unknown; duracaoMs: number; erro?: string }) => void;
};

const conversaEmTexto = (messages: ContextMessage[]) =>
  messages
    .map((m) => `${m.role === "assistant" ? "Atlas" : "Usuário"}: ${String(m.content ?? "").slice(0, 1200)}`)
    .join("\n");

/**
 * Resumo do trecho antigo. Falhou? Devolve null e o chamador simplesmente
 * trunca — perder contexto antigo é melhor que derrubar a resposta.
 */
const resumirTrecho = async (antigos: ContextMessage[], deps: ResumoDeps): Promise<string | null> => {
  const inicio = Date.now();
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${deps.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODELO_RESUMO,
        messages: [
          { role: "system", content: PROMPT_RESUMO },
          { role: "user", content: conversaEmTexto(antigos) },
        ],
        temperature: 0.1,
        max_tokens: 320,
      }),
    });

    if (!resp.ok) {
      deps.onUso?.({ modelo: MODELO_RESUMO, data: null, duracaoMs: Date.now() - inicio, erro: `gateway ${resp.status}` });
      return null;
    }

    const data = await resp.json();
    deps.onUso?.({ modelo: MODELO_RESUMO, data, duracaoMs: Date.now() - inicio });
    const texto = data?.choices?.[0]?.message?.content;
    return typeof texto === "string" && texto.trim() ? texto.trim() : null;
  } catch (e) {
    deps.onUso?.({
      modelo: MODELO_RESUMO,
      data: null,
      duracaoMs: Date.now() - inicio,
      erro: e instanceof Error ? e.message.slice(0, 200) : "erro no resumo",
    });
    return null;
  }
};

export type JanelaDeContexto = {
  mensagens: ContextMessage[];
  resumo: string | null;
  resumiu: boolean;
};

export const montarJanelaDeContexto = async (
  messages: ContextMessage[],
  deps: ResumoDeps,
): Promise<JanelaDeContexto> => {
  if (messages.length <= LIMITE_PARA_RESUMIR) {
    return { mensagens: messages, resumo: null, resumiu: false };
  }

  const recentes = messages.slice(-JANELA_RECENTE);
  const antigos = messages.slice(0, -JANELA_RECENTE);
  const resumo = await resumirTrecho(antigos, deps);

  return { mensagens: recentes, resumo, resumiu: Boolean(resumo) };
};
