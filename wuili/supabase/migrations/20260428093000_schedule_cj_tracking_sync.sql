create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'cj-tracking-sync'
  ) then
    perform cron.unschedule('cj-tracking-sync');
  end if;
end $$;

select cron.schedule(
  'cj-tracking-sync',
  '0 */2 * * *',
  $$select net.http_post(
    url := 'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/cj-tracking-sync',
    headers := '{"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenBvaW94dmJxYXZydHBodG9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyNDMyNDgsImV4cCI6MjA5MDgxOTI0OH0.G1VlS8doiHQtooC2tyiiHbWl4h9kqoMSuirShDhhjzk", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  )$$
);
