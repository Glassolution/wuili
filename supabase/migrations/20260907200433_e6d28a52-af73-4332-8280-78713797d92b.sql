ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS customer_document text,
  ADD COLUMN IF NOT EXISTS shipping_label_wait_alerted_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS dropship_orders_ml_order_id_key
  ON public.dropship_orders (ml_order_id)
  WHERE ml_order_id IS NOT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();