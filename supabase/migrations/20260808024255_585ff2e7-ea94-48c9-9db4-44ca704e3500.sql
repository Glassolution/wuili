SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'payments-reconcile-every-5min'),
  schedule := '* * * * *'
);