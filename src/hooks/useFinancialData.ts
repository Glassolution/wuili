import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resolveAfter } from "@/lib/requestTimeout";
import {
  getFinancialSummary,
  getCashflowData,
  getPendingOrders,
  type OrderRow,
  type FinancialSummary,
  type CashflowDataPoint,
} from "@/lib/financial";

const EMPTY_SUMMARY: FinancialSummary = {
  revenue: 0,
  costs: 0,
  fees: 0,
  profit: 0,
  margin: 0,
};

// ── Extended order type (includes display fields for transactions list) ────────
export interface OrderRowExtended extends OrderRow {
  platform: string | null;
  product_title: string | null;
  ordered_at: string | null;
}

type DbOrderRow = {
  id: string;
  sale_price: number | null;
  cost_price: number | null;
  profit: number | null;
  status: string;
  created_at: string;
  platform: string | null;
  product_title: string | null;
  ordered_at: string | null;
};

function mapDbOrderToFinancialOrder(order: DbOrderRow): OrderRowExtended {
  const total = Number(order.sale_price ?? 0);
  const cost = Number(order.cost_price ?? 0);
  const profit =
    typeof order.profit === "number" ? Number(order.profit) : total - cost;
  const fees = Math.max(total - cost - profit, 0);

  return {
    id: order.id,
    total,
    cost,
    fees,
    status: order.status,
    created_at: order.created_at,
    platform: order.platform ?? null,
    product_title: order.product_title ?? null,
    ordered_at: order.ordered_at ?? null,
  };
}

export function useFinancialData() {
  const { user } = useAuth();
  const userId = user?.id;

  const {
    data: orders = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["financial-data", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async ({ signal }) => {
      const { data, error } = await Promise.race([
        (supabase as any)
          .from("orders")
          .select(
            "id, sale_price, cost_price, profit, status, created_at, platform, product_title, ordered_at"
          )
          .eq("user_id", userId)
          .in("status", [
            "paid",
            "approved",
            "completed",
            "refunded",
            "pending",
            "cancelled",
          ])
          .order("created_at", { ascending: false })
          .abortSignal(signal),
        resolveAfter(5000, { data: [], error: null } as any),
      ]);

      if (error) throw error;
      return ((data ?? []) as DbOrderRow[]).map(mapDbOrderToFinancialOrder);
    },
  });

  const summary: FinancialSummary =
    orders.length > 0 ? getFinancialSummary(orders) : EMPTY_SUMMARY;
  const cashflowData: CashflowDataPoint[] =
    orders.length > 0 ? getCashflowData(orders) : [];
  const pendingOrders: OrderRowExtended[] =
    orders.length > 0
      ? (getPendingOrders(orders) as OrderRowExtended[])
      : [];

  return {
    summary,
    cashflowData,
    pendingOrders,
    orders, // real orders only — pages filter by period on top of this
    isLoading,
    error: error as Error | null,
  };
}
