DO $do$
DECLARE
  s int;
  jname text;
  minute int;
BEGIN
  -- remove os lotes grandes anteriores (estouravam o tempo de execução)
  FOREACH jname IN ARRAY ARRAY[
    'scrape-c7drop-every-12h-p1','scrape-c7drop-every-12h-p2',
    'scrape-c7drop-every-12h-p3','scrape-c7drop-every-12h-p4'
  ] LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = jname) THEN
      PERFORM cron.unschedule(jname);
    END IF;
  END LOOP;

  minute := 0;
  FOR s IN 1..25 BY 3 LOOP
    jname := 'scrape-c7drop-12h-p' || s;
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = jname) THEN
      PERFORM cron.unschedule(jname);
    END IF;
    PERFORM cron.schedule(
      jname,
      minute || ' */12 * * *',
      format(
        'SELECT net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb);',
        'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/scrape-c7drop?mode=full&start=' || s || '&end=' || (s + 2),
        '{"Content-Type":"application/json","apikey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk"}',
        '{"trigger":"cron"}'
      )
    );
    minute := minute + 3;
  END LOOP;
END
$do$;