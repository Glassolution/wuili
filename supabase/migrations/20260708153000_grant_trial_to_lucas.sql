do $$
declare
  target_user_id uuid;
  target_subscription_id uuid;
  now_ts timestamptz := now();
  trial_end_ts timestamptz := now() + interval '5 days';
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
      'trialing',
      'manual_admin_trial',
      29.90,
      now_ts,
      trial_end_ts,
      true,
      trial_end_ts,
      99.90,
      trial_end_ts,
      'pro',
      now_ts,
      now_ts
    );
  else
    update public.subscriptions
    set
      plan = 'pro',
      status = 'trialing',
      payment_method = 'manual_admin_trial',
      amount = 29.90,
      current_period_start = now_ts,
      current_period_end = trial_end_ts,
      is_trial = true,
      trial_ends_at = trial_end_ts,
      next_charge_amount = 99.90,
      next_charge_at = trial_end_ts,
      post_trial_plan = 'pro',
      updated_at = now_ts
    where id = target_subscription_id;
  end if;
end $$;
