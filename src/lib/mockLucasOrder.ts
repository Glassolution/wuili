import type { Database } from "@/integrations/supabase/types";

export const mockLucasOrderEmail = "lucassrby@gmail.com";
export const mockLucasOrderId = "mock-lucassrby-order-001";
export const mockLucasMlOrderId = "ML-MOCK-20260712-001";

type MlOrderRow = Database["public"]["Views"]["ml_orders_view"]["Row"];

export type MockLucasOrder = MlOrderRow & {
  shipment_status: string | null;
  shipment_substatus: string | null;
  date_ready_to_ship: string | null;
  date_shipped: string | null;
  date_delivered: string | null;
  subtotal: number | null;
  shipping_cost: number | null;
};

export const isLucasMockOrderUser = (email: string | null | undefined) =>
  email?.trim().toLowerCase() === mockLucasOrderEmail;

export const isMockLucasOrder = (order: Pick<MlOrderRow, "id" | "ml_order_id" | "external_order_id">) =>
  order.id === mockLucasOrderId ||
  order.ml_order_id === mockLucasMlOrderId ||
  order.external_order_id === "VELO-MOCK-001";

export const getMockLucasOrder = (userId: string): MockLucasOrder => ({
  id: mockLucasOrderId,
  user_id: userId,
  ml_order_id: mockLucasMlOrderId,
  ml_user_id: "lucas-demo-ml-938271",
  external_order_id: "VELO-MOCK-001",
  shipment_id: "SHIP-MOCK-001",
  status: "paid",
  fulfillment_status: "ready_to_buy",
  sale_price: 189.9,
  total_amount: 209.8,
  cost_price: 82.4,
  profit: 107.5,
  quantity: 1,
  ordered_at: "2026-07-12T14:20:00.000Z",
  created_at: "2026-07-12T14:20:00.000Z",
  product_title: "Fone de ouvido Bluetooth TWS E10 Pro a prova d'agua",
  product_image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300",
  buyer_name: "Mariana Souza",
  buyer_email: "mariana.souza.demo@mercadolivre.com",
  buyer_phone: "(11) 98765-4321",
  buyer_address: "Rua das Palmeiras",
  buyer_number: "120",
  buyer_complement: "Apto 42",
  buyer_neighborhood: "Centro",
  buyer_city: "Sao Paulo",
  buyer_state: "SP",
  buyer_zip: "01000-000",
  tracking_code: "BR123456789MOCK",
  catalog_product_id: null,
  supplier_url: "https://www.c7drop.com.br/produto/fone-bluetooth-tws-e10",
  supplier_name: "C7Drop Brasil",
  catalog_title: "Fone de ouvido Bluetooth TWS E10 Pro",
  catalog_images: [
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300",
  ],
  shipment_status: "ready_to_ship",
  shipment_substatus: "invoice_pending",
  date_ready_to_ship: "2026-07-12T15:05:00.000Z",
  date_shipped: null,
  date_delivered: null,
  subtotal: 189.9,
  shipping_cost: 19.9,
});
