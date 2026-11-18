create or replace function public.get_checkout_resume_candidate()
returns table (
  subscription_id uuid,
  plan text,
  purchase_kind text,
  status text,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select s.id, s.plan, s.purchase_kind, s.status, s.created_at
  from public.subscriptions s
  where s.user_id = auth.uid()
    and s.provider = 'validapay'
    and s.status in ('pending', 'expired')
    and s.plan not in ('gratis', 'free')
    and s.created_at > now() - interval '7 days'
    and not exists (
      select 1 from public.subscriptions a
      where a.user_id = auth.uid()
        and a.status in ('active', 'cancel_scheduled')
        and (a.purchase_kind = 'lifetime'
             or a.current_period_end is null
             or a.current_period_end > now())
    )
    and not exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.refund_cooldown_until > now()
    )
  order by s.created_at desc
  limit 1;
$$;

revoke all on function public.get_checkout_resume_candidate() from public, anon;
grant execute on function public.get_checkout_resume_candidate() to authenticated;