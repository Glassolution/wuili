import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useLucroTotal = () =>
  useQuery({
    queryKey: ["lucro-total"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_lucro_total").select("*").single();
      if (error) throw error;
      return data as { receita: number; custo: number; frete: number; lucro: number };
    },
  });

export const useResumoLoja = () =>
  useQuery({
    queryKey: ["resumo-loja"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_resumo_loja").select("*");
      if (error) throw error;
      return data as { loja: string; pedidos: number; receita: number; lucro: number }[];
    },
  });

export const useResumoStatus = () =>
  useQuery({
    queryKey: ["resumo-status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_resumo_status").select("*");
      if (error) throw error;
      return data as { status: string; pedidos: number; receita: number; lucro: number }[];
    },
  });

export const useResumoCategoria = () =>
  useQuery({
    queryKey: ["resumo-categoria"],
    queryFn: async () => {
      const { data, error } = await supabase.from("v_resumo_categoria").select("*");
      if (error) throw error;
      return data as { categoria: string; pedidos: number; receita: number; lucro: number; margem_pct: number }[];
    },
  });

export const usePedidos = (filters?: { status?: string; search?: string }) =>
  useQuery({
    queryKey: ["pedidos", filters],
    queryFn: async () => {
      let query = supabase.from("v_pedidos_completos").select("*");
      if (filters?.status && filters.status !== "Todos") {
        query = query.eq("status", filters.status);
      }
      if (filters?.search) {
        query = query.or(`produto.ilike.%${filters.search}%,id.ilike.%${filters.search}%,cliente.ilike.%${filters.search}%`);
      }
      const { data, error } = await query.order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

export const useTransacoes = () =>
  useQuery({
    queryKey: ["transacoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transacoes")
        .select("*, pedidos(id, loja, status)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
