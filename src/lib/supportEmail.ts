import { supabase } from "@/integrations/supabase/client";

export async function notifyTicketReplyEmail(ticketId: string, messageId: string) {
  const { data, error } = await supabase.functions.invoke("send-ticket-reply-email", {
    body: { ticketId, messageId },
  });

  if (error) throw error;
  return data;
}
