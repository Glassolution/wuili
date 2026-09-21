ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS ml_compliance_status text NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS ml_compliance_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ml_clean_images_count integer,
  ADD COLUMN IF NOT EXISTS ml_compliance_checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_catalog_products_ml_compliance
  ON public.catalog_products (ml_compliance_status);