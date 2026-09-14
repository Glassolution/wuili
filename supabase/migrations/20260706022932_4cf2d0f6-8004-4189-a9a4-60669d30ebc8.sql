ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text;

CREATE INDEX IF NOT EXISTS catalog_products_brand_idx ON public.catalog_products (brand);