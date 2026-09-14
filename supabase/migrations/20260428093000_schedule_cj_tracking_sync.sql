create extension if not exists pg_cron with schema extensions;

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
