ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS preco_produto numeric,
  ADD COLUMN IF NOT EXISTS frete_real numeric,
  ADD COLUMN IF NOT EXISTS pix_gerado_at timestamptz,
  ADD COLUMN IF NOT EXISTS pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_retry_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_retry_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_retry_count integer NOT NULL DEFAULT 0;