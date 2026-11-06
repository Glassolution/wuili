/**
 * Regra da bolinha vermelha do suporte (admin): o ticket está "não lido" se
 * existir pelo menos uma mensagem NÃO interna do cliente (sender = "user") mais
 * nova que a última vez que um admin abriu ou respondeu o ticket
 * (`admin_last_seen_at`). Se nunca foi visto, qualquer mensagem do cliente
 * conta. Não depende de needs_human, ai_active nem de a IA ter respondido.
 * A mesma regra está no banco: `support_ticket_is_unread`, usada pela lista
 * (`admin_support_tickets_page`) e pelo contador do menu (`admin_support_unread_count`).
 */
export type UnreadMessage = {
  sender: "user" | "admin" | "ai" | string;
  created_at: string;
  internal?: boolean | null;
};

const time = (value: string | null | undefined) => {
  if (!value) return Number.NaN;
  return new Date(value).getTime();
};

export const hasUnreadCustomerMessage = (messages: UnreadMessage[], adminLastSeenAt: string | null) => {
  const seen = time(adminLastSeenAt);
  return messages.some(
    (message) =>
      message.sender === "user" &&
      !message.internal &&
      (Number.isNaN(seen) || time(message.created_at) > seen),
  );
};
