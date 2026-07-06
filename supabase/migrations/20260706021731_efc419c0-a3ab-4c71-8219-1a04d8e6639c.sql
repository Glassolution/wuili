
ALTER TABLE public.user_publications
  ADD COLUMN IF NOT EXISTS catalog_product_id text;

UPDATE public.user_publications
SET catalog_product_id = cj_product_id
WHERE catalog_product_id IS NULL AND cj_product_id IS NOT NULL;

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY user_id, catalog_product_id
           ORDER BY published_at DESC NULLS LAST, created_at DESC NULLS LAST
         ) AS rn
  FROM public.user_publications
  WHERE catalog_product_id IS NOT NULL
    AND status IN ('active', 'published')
)
UPDATE public.user_publications p
SET status = 'archived_duplicate',
    updated_at = now()
FROM ranked r
WHERE p.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS user_publications_user_catalog_active_uniq
  ON public.user_publications (user_id, catalog_product_id)
  WHERE catalog_product_id IS NOT NULL
    AND status IN ('active', 'published');
