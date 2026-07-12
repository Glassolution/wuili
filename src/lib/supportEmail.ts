import { supabase } from "@/integrations/supabase/client";

const getFunctionErrorMessage = async (error: unknown) => {
  const context = (error as { context?: Response })?.context;
  if (!context) return (error as { message?: string })?.message ?? "Falha ao notificar por email.";

  try {
    const body = await context.clone().json();
    return body?.detail || body?.reason || body?.error || "Falha ao notificar por email.";
  } catch {
    return (error as { message?: string })?.message ?? "Falha ao notificar por email.";
  }
};

export async function notifyTicketReplyEmail(ticketId: string, messageId: string) {
  const { data, error } = await supabase.functions.invoke("send-ticket-reply-email", {
    body: { ticketId, messageId },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.sent === false) throw new Error(data.reason || "Email do usuário indisponível.");
  return data;
}

export async function notifyNewSupportTicketEmail(ticketId: string, messageId: string) {
  const { data, error } = await supabase.functions.invoke("send-new-support-ticket-email", {
    body: { ticketId, messageId },
  });

  if (error) throw new Error(await getFunctionErrorMessage(error));
  if (data?.sent === false) throw new Error(data.reason || "Nenhum admin disponível para receber o email.");
  return data;
}
