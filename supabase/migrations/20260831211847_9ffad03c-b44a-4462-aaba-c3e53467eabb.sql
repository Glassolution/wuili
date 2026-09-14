ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS bot_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bot_payload JSONB,
  ADD COLUMN IF NOT EXISTS needs_manual_sku BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS orders_needs_manual_sku_idx
  ON public.orders (needs_manual_sku)
  WHERE needs_manual_sku = true;