-- Auto-close open support tickets after 48 hours without messages/activity.

create or replace function public.close_stale_support_tickets()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  closed_count integer := 0;
begin
  update public.support_tickets
     set status = 'closed'
   where status = 'open'
     and updated_at <= now() - interval '48 hours';

  get diagnostics closed_count = row_count;
  return closed_count;
end;
$$;

grant execute on function public.close_stale_support_tickets() to authenticated;
grant execute on function public.close_stale_support_tickets() to service_role;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create schema if not exists extensions;
    execute 'create extension if not exists pg_cron with schema extensions';
  end if;
exception
  when others then
    raise notice 'pg_cron extension was not enabled: %', sqlerrm;
end;
$$;

do $$
begin
  if to_regnamespace('cron') is not null then
    if exists (
      select 1
      from cron.job
      where jobname = 'close-stale-support-tickets'
    ) then
      perform cron.unschedule('close-stale-support-tickets');
    end if;

    perform cron.schedule(
      'close-stale-support-tickets',
      '17 * * * *',
      'select public.close_stale_support_tickets();'
    );
  end if;
exception
  when others then
    raise notice 'support ticket auto-close cron was not scheduled: %', sqlerrm;
end;
$$;
