ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS etiqueta_ml_url text,
  ADD COLUMN IF NOT EXISTS etiqueta_ml_path text,
  ADD COLUMN IF NOT EXISTS needs_shipping_label boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS dropship_orders_needs_shipping_label_idx
  ON public.dropship_orders (needs_shipping_label)
  WHERE needs_shipping_label = true;