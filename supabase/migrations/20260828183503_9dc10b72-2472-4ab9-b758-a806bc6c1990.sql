create or replace function public.rpc_ml_reconnect_required()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_integrations ui
    where ui.user_id = auth.uid()
      and ui.platform = 'mercadolivre'
      and ui.expires_at is not null
      and ui.expires_at < now()
      and (
        exists (
          select 1 from public.subscriptions s
          where s.user_id = ui.user_id
            and s.status = 'active'
            and lower(s.plan) not in ('gratis','free')
        )
        or exists (
          select 1 from public.profiles p
          where p.user_id = ui.user_id
            and p.plano is not null
            and lower(p.plano) not in ('gratis','free')
        )
      )
  );
$$;

grant execute on function public.rpc_ml_reconnect_required() to authenticated;