create or replace function public.get_admin_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start timestamptz := date_trunc('month', now());
  total_users integer := 0;
  paid_users integer := 0;
  active_mrr numeric := 0;
  churned_users integer := 0;
  churn_rate numeric := 0;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  select count(*) into total_users
  from public.profiles;

  select count(distinct s.user_id), coalesce(sum(s.amount), 0)
    into paid_users, active_mrr
  from public.subscriptions s
  where lower(s.plan) in ('pro', 'business')
    and lower(s.status) in ('active', 'approved', 'authorized', 'paid');

  select count(distinct s.user_id) into churned_users
  from public.subscriptions s
  where lower(s.plan) in ('pro', 'business')
    and lower(s.status) in ('cancelled', 'canceled', 'inactive', 'refunded')
    and s.updated_at >= month_start;

  churn_rate :=
    case
      when paid_users + churned_users = 0 then 0
      else round((churned_users::numeric / (paid_users + churned_users)::numeric) * 100, 1)
    end;

  select jsonb_build_object(
    'metrics', jsonb_build_object(
      'total_users', total_users,
      'paid_users', paid_users,
      'mrr', active_mrr,
      'churn_rate', churn_rate
    ),
    'users', coalesce((
      select jsonb_agg(row_to_json(u) order by u.created_at desc)
      from (
        select
          p.user_id,
          coalesce(p.display_name, au.email, 'Usuario') as name,
          au.email,
          p.avatar_url,
          coalesce(nullif(latest_sub.plan, ''), nullif(p.plano, ''), 'free') as plan,
          p.created_at,
          exists (
            select 1
            from public.user_integrations ui
            where ui.user_id = p.user_id
              and ui.platform = 'mercadolivre'
              and ui.access_token is not null
          ) as ml_connected,
          coalesce(order_counts.orders_count, 0) as orders_count
        from public.profiles p
        left join auth.users au on au.id = p.user_id
        left join lateral (
          select s.plan, s.status, s.amount, s.created_at
          from public.subscriptions s
          where s.user_id = p.user_id
          order by s.created_at desc
          limit 1
        ) latest_sub on true
        left join lateral (
          select count(*)::integer as orders_count
          from public.orders o
          where o.user_id = p.user_id
        ) order_counts on true
        order by p.created_at desc
        limit 50
      ) u
    ), '[]'::jsonb),
    'transactions', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select
          s.id,
          s.user_id,
          coalesce(p.display_name, au.email, 'Usuario') as user_name,
          au.email,
          s.plan,
          s.amount,
          s.status,
          s.created_at
        from public.subscriptions s
        left join public.profiles p on p.user_id = s.user_id
        left join auth.users au on au.id = s.user_id
        order by s.created_at desc
        limit 12
      ) t
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

grant execute on function public.get_admin_dashboard() to authenticated;
