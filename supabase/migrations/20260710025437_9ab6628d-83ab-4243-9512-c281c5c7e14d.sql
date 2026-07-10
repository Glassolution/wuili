
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_complement text,
  ADD COLUMN IF NOT EXISTS shipment_id text,
  ADD COLUMN IF NOT EXISTS catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS supplier_url text;

CREATE INDEX IF NOT EXISTS orders_ml_order_id_idx ON public.orders (ml_order_id);
CREATE INDEX IF NOT EXISTS orders_shipment_id_idx ON public.orders (shipment_id);
CREATE INDEX IF NOT EXISTS orders_catalog_product_id_idx ON public.orders (catalog_product_id);

CREATE OR REPLACE VIEW public.ml_orders_view
WITH (security_invoker = true)
AS
SELECT
  o.id,
  o.user_id,
  o.ml_order_id,
  o.ml_user_id,
  o.external_order_id,
  o.shipment_id,
  o.status,
  o.fulfillment_status,
  o.sale_price,
  o.total_amount,
  o.cost_price,
  o.profit,
  o.quantity,
  o.ordered_at,
  o.created_at,
  o.product_title,
  o.product_image,
  o.buyer_name,
  o.buyer_email,
  o.buyer_phone,
  o.buyer_address,
  o.buyer_number,
  o.buyer_complement,
  o.buyer_neighborhood,
  o.buyer_city,
  o.buyer_state,
  o.buyer_zip,
  o.tracking_code,
  o.catalog_product_id,
  COALESCE(o.supplier_url, cp.product_url) AS supplier_url,
  cp.supplier_name,
  cp.title AS catalog_title,
  cp.images AS catalog_images
FROM public.orders o
LEFT JOIN public.catalog_products cp ON cp.id = o.catalog_product_id
WHERE o.platform = 'mercadolivre';

GRANT SELECT ON public.ml_orders_view TO authenticated;
GRANT ALL ON public.ml_orders_view TO service_role;
