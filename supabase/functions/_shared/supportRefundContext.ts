export type RefundContext = "assinatura" | "pedido" | "ambiguo";

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** Only customer messages establish context; an incorrect assistant reply must not override it. */
export function classifyRefundContext(message: string, previousUserMessages: string[] = []): RefundContext {
  const classify = (value: string): RefundContext => {
    const text = normalize(value);
    const subscription = /assinatura|renovacao|mensalidade|plano|pagamento (da|na|para a) velo/.test(text);
    const order = /\bc7\b|c7drop|fornecedor|fornecedora|comprador|cliente.*cancel|pedido|produto|mercado livre|mercado pago|etiqueta/.test(text);
    if (subscription && order) return "ambiguo";
    if (subscription) return "assinatura";
    if (order) return "pedido";
    return "ambiguo";
  };
  const current = classify(message);
  if (current !== "ambiguo") return current;
  // Explicitly mixed requests need clarification, not inheritance from an earlier subject.
  if (/assinatura|renovacao|mensalidade|plano/.test(normalize(message))) return "ambiguo";
  for (const previous of [...previousUserMessages].reverse()) {
    const context = classify(previous);
    if (context !== "ambiguo") return context;
  }
  return "ambiguo";
}