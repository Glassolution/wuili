ALTER TABLE public.generated_sales_pages
  ADD COLUMN IF NOT EXISTS store_name text,
  ADD COLUMN IF NOT EXISTS store_logo_url text,
  ADD COLUMN IF NOT EXISTS store_description text;