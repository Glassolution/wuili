-- Descontinua definitivamente qualquer cron legado da antiga integracao CJ.
-- Nao altera o scraper C7Drop.

DO $$
DECLARE
  job_name text;
BEGIN
  FOREACH job_name IN ARRAY ARRAY[
    'cj-tracking-sync',
    'cj-sync',
    'cj-sync-products',
    'cj-sync-request',
    'scrape-b2drop-every-12h'
  ]
  LOOP
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = job_name) THEN
      PERFORM cron.unschedule(job_name);
    END IF;
  END LOOP;
END $$;
