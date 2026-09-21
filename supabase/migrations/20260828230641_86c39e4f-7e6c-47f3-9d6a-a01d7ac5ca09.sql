select cron.schedule(
  'scrape-c7drop-prune-daily',
  '30 5 * * *',
  $$
  select net.http_post(
    url := 'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/scrape-c7drop?mode=prune&stale_days=3',
    headers := '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);