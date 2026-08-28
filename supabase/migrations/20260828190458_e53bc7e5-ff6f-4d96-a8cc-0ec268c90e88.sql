select cron.alter_job(
  (select jobid from cron.job where jobname = 'ml-sync-stock-6h'),
  schedule => '40 * * * *'
);