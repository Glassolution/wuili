import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
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

// ── Demo override (single user only) ─────────────────────────────────────────
const DEMO_EMAIL = "xavierluisfelipe12@gmail.com";

const DEMO_REVENUE = 70482.37;
const DEMO_COSTS   = 21890.55;
const DEMO_FEES    = 8420.80;

// Build synthetic orders confined to the current calendar month so that
// getFinancialSummary(filterOrdersByPeriod(orders, monthStart, monthEnd))
// returns exactly DEMO_REVENUE / DEMO_COSTS / DEMO_FEES.
function buildDemoOrders(): OrderRow[] {
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const count = 30; // one per day of the month

  // Per-order values (truncated to 2 dp)
  const perRevenue = Math.floor((DEMO_REVENUE / count) * 100) / 100;
  const perCost    = Math.floor((DEMO_COSTS   / count) * 100) / 100;
  const perFees    = Math.floor((DEMO_FEES    / count) * 100) / 100;

  // Remainder goes to the last order so totals are exact
  const lastRevenue = Math.round((DEMO_REVENUE - perRevenue * (count - 1)) * 100) / 100;
  const lastCost    = Math.round((DEMO_COSTS   - perCost    * (count - 1)) * 100) / 100;
  const lastFees    = Math.round((DEMO_FEES    - perFees    * (count - 1)) * 100) / 100;

  const rows: OrderRow[] = [];
  for (let i = 0; i < count; i++) {
    const dayOffset = Math.floor((i / count) * daysInMonth); // 0 … daysInMonth-1
    const d = new Date(monthStart);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(8 + (i % 12), (i * 7) % 60, 0, 0);
    const isLast = i === count - 1;
    rows.push({
      id:         `demo-${i}`,
      total:      isLast ? lastRevenue : perRevenue,
      cost:       isLast ? lastCost    : perCost,
      fees:       isLast ? lastFees    : perFees,
      status:     "paid",
      created_at: d.toISOString(),
    });
  }
  return rows;
}

const DEMO_ORDERS: OrderRow[] = buildDemoOrders();

export function useFinancialData() {
  const { user } = useAuth();
  const userId = user?.id;
  const isDemo = user?.email === DEMO_EMAIL;

  const { data: orders = [], isLoading, error } = useQuery({
    queryKey: ["financial-data", userId],
    enabled: !!user && !isDemo, // skip fetch entirely for demo user
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("id, total, cost, fees, status, created_at")
        .eq("user_id", userId)
        .in("status", ["paid", "approved", "completed", "refunded", "pending"]);

      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  // Demo user: use synthetic orders so period filtering works correctly in all pages
  const effectiveOrders: OrderRow[] = isDemo ? DEMO_ORDERS : orders;

  const summary: FinancialSummary = effectiveOrders.length > 0 ? getFinancialSummary(effectiveOrders) : EMPTY_SUMMARY;
  const cashflowData: CashflowDataPoint[] = effectiveOrders.length > 0 ? getCashflowData(effectiveOrders) : [];
  const pendingOrders: OrderRow[] = effectiveOrders.length > 0 ? getPendingOrders(effectiveOrders) : [];

  return {
    summary,
    cashflowData,
    pendingOrders,
    orders: effectiveOrders, // always return the effective set — pages filter by period on top of this
    isLoading: isDemo ? false : isLoading,
    error: isDemo ? null : (error as Error | null),
  };
}
