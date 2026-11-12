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

// Only compare the latest assistant response (which may be split across several rows).
// A user message between replies does not make repeating the immediately previous answer useful.
export function omitRepeatedReply(text: string, turns: SupportTurn[]): string {
  const publicTurns = turns.filter((turn) => !turn.internal);
  let lastAiIndex = -1;
  for (let i = publicTurns.length - 1; i >= 0; i--) {
    if (publicTurns[i].sender === "ai") { lastAiIndex = i; break; }
  }
  const previous: string[] = [];
  for (let i = lastAiIndex; i >= 0 && publicTurns[i].sender === "ai"; i--) {
    previous.unshift(normalize(publicTurns[i].message ?? ""));
  }
  if (lastAiIndex >= 0 && publicTurns.slice(lastAiIndex + 1).some((turn) => turn.sender === "admin")) return text;
  if (previous.includes(normalize(text))) return "";
  return text.split(/\n\s*\n/).filter((paragraph) => {
    const candidate = normalize(paragraph);
    return candidate && !previous.some((reply) => reply === candidate || reply.includes(candidate));
  }).join("\n\n").trim();
}

export const SUPPORT_CONTINUITY_PROMPT = `Solicitar atendimento humano não encerra sua participação: continue respondendo dúvidas novas e ajudando no que souber até uma pessoa da equipe assumir. Não invente solução para a pendência que depende da equipe.
Leia o histórico antes de responder. Evite apenas respostas repetidas CONSECUTIVAS: não reenvie nem reformule a sua resposta imediatamente anterior sem informação nova. Uma orientação antiga pode ser retomada quando a conversa tiver passado por outro assunto ou outra resposta. Não repita o aviso de espera nem os horários a cada mensagem. Não peça de novo dados que o cliente já enviou. Se a pessoa disser que já tentou, reconheça isso e não mande repetir o mesmo procedimento.`;