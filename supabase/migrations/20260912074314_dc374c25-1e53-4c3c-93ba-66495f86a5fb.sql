CREATE TABLE IF NOT EXISTS public.ml_image_vision_cache (
  url text PRIMARY KEY,
  clean boolean NOT NULL,
  reason text,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.ml_image_vision_cache TO service_role;
ALTER TABLE public.ml_image_vision_cache ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS ml_vision_clean_count integer,
  ADD COLUMN IF NOT EXISTS ml_vision_clean_images jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ml_vision_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_catalog_products_vision_checked
  ON public.catalog_products (ml_vision_checked_at NULLS FIRST);