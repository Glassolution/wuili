ALTER TABLE public.user_publications
  ADD COLUMN IF NOT EXISTS variation_group_id uuid,
  ADD COLUMN IF NOT EXISTS variation_name text,
  ADD COLUMN IF NOT EXISTS variation_value text;

CREATE INDEX IF NOT EXISTS idx_user_publications_variation_group
  ON public.user_publications (variation_group_id)
  WHERE variation_group_id IS NOT NULL;

DROP INDEX IF EXISTS public.user_publications_user_catalog_active_uniq;
DROP INDEX IF EXISTS public.user_publications_unique_active;

CREATE UNIQUE INDEX user_publications_user_catalog_active_uniq
  ON public.user_publications (user_id, catalog_product_id, (COALESCE(variation_value, '')))
  WHERE catalog_product_id IS NOT NULL AND status = ANY (ARRAY['active','published']);

CREATE UNIQUE INDEX user_publications_unique_active
  ON public.user_publications (user_id, catalog_product_id, (COALESCE(variation_value, '')))
  WHERE catalog_product_id IS NOT NULL AND status <> 'archived_duplicate';