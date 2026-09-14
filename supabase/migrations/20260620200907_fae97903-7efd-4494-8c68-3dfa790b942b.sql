
-- 1. Add new columns
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS product_url text,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS scraped_at timestamptz;

-- 2. Unique index for upsert
CREATE UNIQUE INDEX IF NOT EXISTS catalog_products_source_external_id_key
  ON public.catalog_products(source, external_id);

-- 3. Public read policy (only non-blocked, active, in-stock items)
GRANT SELECT ON public.catalog_products TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read non-blocked catalog products" ON public.catalog_products;
CREATE POLICY "Public can read non-blocked catalog products"
  ON public.catalog_products
  FOR SELECT
  TO anon, authenticated
  USING (is_blocked = false);

-- 4. Cron extensions + schedule scrape-b2drop every 12h
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing schedule if present (idempotent re-run)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'scrape-b2drop-every-12h') THEN
    PERFORM cron.unschedule('scrape-b2drop-every-12h');
  END IF;
END $$;

SELECT cron.schedule(
  'scrape-b2drop-every-12h',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/scrape-b2drop',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);
