ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS ml_order_id text,
  ADD COLUMN IF NOT EXISTS seller_email text,
  ADD COLUMN IF NOT EXISTS sku_c7drop text,
  ADD COLUMN IF NOT EXISTS c7drop_product_url text,
  ADD COLUMN IF NOT EXISTS quantidade integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS preco_ml numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS needs_manual_sku boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE UNIQUE INDEX IF NOT EXISTS dropship_orders_ml_order_id_key
  ON public.dropship_orders (ml_order_id)
  WHERE ml_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dropship_orders_needs_manual_sku_idx
  ON public.dropship_orders (needs_manual_sku)
  WHERE needs_manual_sku;
