-- Add product_data jsonb column to atlas_messages to persist product cards inline with chat history
ALTER TABLE public.atlas_messages
  ADD COLUMN IF NOT EXISTS product_data jsonb;

-- Ensure product_url is indexed lightly (no-op if already exists) — supplier link source
-- (product_url already exists on catalog_products; no schema change needed)
