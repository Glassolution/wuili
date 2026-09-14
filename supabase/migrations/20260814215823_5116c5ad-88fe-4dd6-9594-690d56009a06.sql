ALTER TABLE public.user_publications
  ADD COLUMN IF NOT EXISTS paused_reason text,
  ADD COLUMN IF NOT EXISTS stock_synced_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_user_publications_catalog_product
  ON public.user_publications (catalog_product_id)
  WHERE catalog_product_id IS NOT NULL;