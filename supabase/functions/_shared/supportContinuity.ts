export type SupportTurn = { sender: string; message: string | null; internal?: boolean };

export function humanHasTakenOver(turns: SupportTurn[]): boolean {
  return turns.some((turn) => turn.sender === "admin" && !turn.internal);
}

export function shouldPauseSupport(aiPaused: boolean, status: string, turns: SupportTurn[]): boolean {
  return aiPaused || status === "closed" || humanHasTakenOver(turns);
}

function normalize(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

// Compare complete responses and paragraphs, including deterministic navigation/refund replies.
export function omitRepeatedReply(text: string, turns: SupportTurn[]): string {
  const previous = turns.filter((turn) => turn.sender === "ai" && !turn.internal)
    .map((turn) => normalize(turn.message ?? ""));
  if (previous.includes(normalize(text))) return "";
  return text.split(/\n\s*\n/).filter((paragraph) => {
    const candidate = normalize(paragraph);
    return candidate && !previous.some((reply) => reply === candidate || reply.includes(candidate));
  }).join("\n\n").trim();
}

export const SUPPORT_CONTINUITY_PROMPT = `Solicitar atendimento humano não encerra sua participação: continue respondendo dúvidas novas e ajudando no que souber até uma pessoa da equipe assumir. Não invente solução para a pendência que depende da equipe.
Leia o histórico antes de responder. Se a mesma pergunta já recebeu uma orientação e não existe informação nova, não reenvie nem reformule a mesma orientação: reconheça brevemente que ela já foi dada e explique só o ponto que ainda falta esclarecer. Não repita o aviso de espera nem os horários a cada mensagem. Não peça de novo dados que o cliente já enviou. Se a pessoa disser que já tentou, reconheça isso e não mande repetir o mesmo procedimento.`;