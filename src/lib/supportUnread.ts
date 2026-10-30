/**
 * Regra da bolinha vermelha do suporte (admin): o ticket está "não lido" quando
 * a última mensagem visível (não interna, não da IA) é do cliente e é mais nova
 * que a última vez que um admin abriu ou respondeu o ticket. A mesma regra está
 * na função do banco `admin_support_unread_count`.
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

export const lastVisibleHumanMessage = <T extends UnreadMessage>(messages: T[]): T | null => {
  let last: T | null = null;
  for (const message of messages) {
    if (message.internal || message.sender === "ai") continue;
    if (!last || time(message.created_at) > time(last.created_at)) last = message;
  }
  return last;
};

export const isSupportTicketUnread = (
  lastMessage: Pick<UnreadMessage, "sender" | "created_at"> | null,
  adminLastSeenAt: string | null,
) => {
  if (!lastMessage || lastMessage.sender !== "user") return false;
  const seen = time(adminLastSeenAt);
  if (Number.isNaN(seen)) return true;
  return time(lastMessage.created_at) > seen;
};
