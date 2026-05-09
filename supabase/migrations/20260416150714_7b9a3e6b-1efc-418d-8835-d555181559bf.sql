
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS weight numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variants jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orders_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_price numeric DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON public.catalog_products (category);
CREATE INDEX IF NOT EXISTS idx_catalog_products_orders_count ON public.catalog_products (orders_count DESC);
