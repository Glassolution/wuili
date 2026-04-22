// Dashboard hooks — views not yet created in DB, returning empty/mock data for now
import { useQuery } from "@tanstack/react-query";

export const useLucroTotal = () =>
  useQuery({
    queryKey: ["lucro-total"],
    queryFn: async () => ({ receita: 0, custo: 0, frete: 0, lucro: 0 }),
  });

export const useResumoLoja = () =>
  useQuery({
    queryKey: ["resumo-loja"],
    queryFn: async () => [] as { loja: string; pedidos: number; receita: number; lucro: number }[],
  });

export const useResumoStatus = () =>
  useQuery({
    queryKey: ["resumo-status"],
    queryFn: async () => [] as { status: string; pedidos: number; receita: number; lucro: number }[],
  });

export const useResumoCategoria = () =>
  useQuery({
    queryKey: ["resumo-categoria"],
    queryFn: async () => [] as { categoria: string; pedidos: number; receita: number; lucro: number; margem_pct: number }[],
  });

export const usePedidos = (_filters?: { status?: string; search?: string }) =>
  useQuery({
    queryKey: ["pedidos", _filters],
    queryFn: async () => [] as any[],
  });

export const useTransacoes = () =>
  useQuery({
    queryKey: ["transacoes"],
    queryFn: async () => [] as any[],
  });
