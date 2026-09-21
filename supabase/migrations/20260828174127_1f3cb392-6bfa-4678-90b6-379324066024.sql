CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $do$
DECLARE
  s text[];
  slices text[][] := ARRAY[
    ARRAY['scrape-c7drop-every-12h-p1', '0 */12 * * *',  '1', '15'],
    ARRAY['scrape-c7drop-every-12h-p2', '5 */12 * * *',  '16', '30'],
    ARRAY['scrape-c7drop-every-12h-p3', '10 */12 * * *', '31', '45'],
    ARRAY['scrape-c7drop-every-12h-p4', '15 */12 * * *', '46', '60']
  ];
BEGIN
  FOREACH s SLICE 1 IN ARRAY slices
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = s[1]) THEN
      PERFORM cron.unschedule(s[1]);
    END IF;

    PERFORM cron.schedule(
      s[1],
      s[2],
      format(
        'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
        'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/scrape-c7drop?mode=full&start=' || s[3] || '&end=' || s[4],
        '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk"}',
        '{"trigger":"cron"}'
      )
    );
  END LOOP;
END
$do$;