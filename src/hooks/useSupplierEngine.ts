import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Supplier {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  logo_url: string | null;
}

export interface SupplierProduct {
  id: string;
  product_id: string;
  supplier_id: string;
  external_id: string;
  cost_price: number;
  shipping_cost: number;
  shipping_days: number;
  stock_status: string;
  rating: number;
  supplier?: Supplier;
  _score?: number;
}

interface ScoringWeights {
  price: number;
  shipping: number;
  stock: number;
  rating: number;
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  price: 0.4,
  shipping: 0.3,
  stock: 0.2,
  rating: 0.1,
};

/**
 * Calculates a 0-100 score for a supplier product.
 * Higher = better supplier choice.
 */
export function calcSupplierScore(
  sp: SupplierProduct,
  allForProduct: SupplierProduct[],
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  if (sp.stock_status !== "available") return 0;

  const totalCosts = allForProduct.map((s) => s.cost_price + s.shipping_cost);
  const minCost = Math.min(...totalCosts);
  const maxCost = Math.max(...totalCosts);
  const thisCost = sp.cost_price + sp.shipping_cost;
  const priceScore = maxCost === minCost ? 100 : ((maxCost - thisCost) / (maxCost - minCost)) * 100;

  const shippingDays = allForProduct.map((s) => s.shipping_days);
  const minDays = Math.min(...shippingDays);
  const maxDays = Math.max(...shippingDays);
  const shippingScore = maxDays === minDays ? 100 : ((maxDays - sp.shipping_days) / (maxDays - minDays)) * 100;

  const stockScore = sp.stock_status === "available" ? 100 : 0;

  const ratingScore = (sp.rating || 0) * 20; // 0-5 → 0-100

  return Math.round(
    weights.price * priceScore +
    weights.shipping * shippingScore +
    weights.stock * stockScore +
    weights.rating * ratingScore
  );
}

/**
 * Returns the best supplier product for a given product, with scores.
 */
export function selectBestSupplier(
  supplierProducts: SupplierProduct[]
): { best: SupplierProduct | null; ranked: SupplierProduct[] } {
  const available = supplierProducts.filter((sp) => sp.stock_status === "available");
  if (available.length === 0) return { best: null, ranked: [] };

  const scored = available.map((sp) => ({
    ...sp,
    _score: calcSupplierScore(sp, available),
  }));

  scored.sort((a, b) => (b._score ?? 0) - (a._score ?? 0));

  return { best: scored[0], ranked: scored };
}

/**
 * Hook to fetch all suppliers.
 */
export function useSuppliers() {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .eq("is_active", true);
      if (error) throw error;
      return data as Supplier[];
    },
  });
}

/**
 * Hook to fetch supplier products for a specific catalog product.
 */
export function useSupplierProducts(productId: string | null) {
  return useQuery({
    queryKey: ["supplier_products", productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("supplier_products")
        .select("*, supplier:suppliers(*)")
        .eq("product_id", productId!);
      if (error) throw error;
      return (data || []).map((sp: any) => ({
        ...sp,
        supplier: sp.supplier as Supplier,
      })) as SupplierProduct[];
    },
  });
}
