
ALTER TABLE public.user_publications
  ADD COLUMN IF NOT EXISTS ml_closed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS user_publications_unique_active
  ON public.user_publications (user_id, catalog_product_id)
  WHERE catalog_product_id IS NOT NULL AND status <> 'archived_duplicate';
