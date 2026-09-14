CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ml-sync-stock-6h') THEN
    PERFORM cron.unschedule('ml-sync-stock-6h');
  END IF;
END $$;

SELECT cron.schedule(
  'ml-sync-stock-6h',
  '40 1,7,13,19 * * *',
  $$
  SELECT net.http_post(
    url := 'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/ml-sync-stock',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);