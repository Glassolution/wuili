import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/** Tickets de suporte em aberto; a mesma chave alimenta a sidebar e o sino. */
export const useOpenSupportTickets = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin-sidebar-open-support-tickets"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000,
  });
};
