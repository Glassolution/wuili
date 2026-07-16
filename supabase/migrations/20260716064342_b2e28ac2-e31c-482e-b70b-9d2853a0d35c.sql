-- Dedupe AliExpress products by title (variants with different IDs but same title)
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY lower(trim(title))
           ORDER BY
             COALESCE(jsonb_array_length(images), 0) DESC,
             COALESCE(scraped_at, updated_at, created_at) DESC,
             created_at DESC
         ) AS rn
  FROM public.catalog_products
  WHERE source = 'aliexpress' AND title IS NOT NULL AND trim(title) <> ''
)
DELETE FROM public.catalog_products
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Reviews count column
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS reviews_count integer;