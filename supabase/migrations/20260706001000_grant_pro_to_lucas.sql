do $$
declare
  target_user_id uuid;
  target_subscription_id uuid;
  now_ts timestamptz := now();
begin
  select id
    into target_user_id
  from auth.users
  where lower(email) = lower('lucassrby@gmail.com')
  limit 1;

  if target_user_id is null then
    raise notice 'Usuario lucassrby@gmail.com nao encontrado.';
    return;
  end if;

  update public.profiles
  set
    plano = 'pro',
    updated_at = now_ts
  where user_id = target_user_id;

  select id
    into target_subscription_id
  from public.subscriptions
  where user_id = target_user_id
  order by created_at desc
  limit 1;

  if target_subscription_id is null then
    insert into public.subscriptions (
      user_id,
      plan,
      status,
      payment_method,
      amount,
      current_period_start,
      current_period_end,
      is_trial,
      trial_ends_at,
      next_charge_amount,
      next_charge_at,
      post_trial_plan,
      created_at,
      updated_at
    )
    values (
      target_user_id,
      'pro',
      'active',
      'manual_admin_annual',
      1079.90,
      now_ts,
      now_ts + interval '1 year',
      false,
      null,
      1079.90,
      now_ts + interval '1 year',
      null,
      now_ts,
      now_ts
    );
  else
    update public.subscriptions
    set
      plan = 'pro',
      status = 'active',
      payment_method = 'manual_admin_annual',
      amount = 1079.90,
      current_period_start = coalesce(current_period_start, now_ts),
      current_period_end = greatest(coalesce(current_period_end, now_ts), now_ts + interval '1 year'),
      is_trial = false,
      trial_ends_at = null,
      next_charge_amount = 1079.90,
      next_charge_at = now_ts + interval '1 year',
      post_trial_plan = null,
      updated_at = now_ts
    where id = target_subscription_id;
  end if;
end $$;
