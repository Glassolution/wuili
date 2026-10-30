import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tickets com mensagem nova do cliente que nenhum admin abriu/respondeu.
 * Mesma regra da bolinha da lista (função do banco `admin_support_unread_count`).
 * Atualiza em tempo real com mudanças em mensagens e tickets.
 */
export const useUnreadSupportTickets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-support-unread-count"] });
    };
    const channel = supabase
      .channel(`admin-support-unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, refresh)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  return useQuery({
    queryKey: ["admin-support-unread-count"],
    enabled: !!user?.id,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC nova ainda pode faltar nos tipos gerados
      const { data, error } = await (supabase as any).rpc("admin_support_unread_count");
      if (error) throw error;
      return Number(data ?? 0);
    },
    refetchInterval: 30_000,
    retry: false,
  });
};
