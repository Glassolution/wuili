ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS c7drop_pix_copy_paste text,
  ADD COLUMN IF NOT EXISTS c7drop_pix_key text,
  ADD COLUMN IF NOT EXISTS c7drop_pix_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS c7drop_pix_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS c7drop_pix_renewal_count integer NOT NULL DEFAULT 0;