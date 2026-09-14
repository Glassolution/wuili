update public.subscriptions set status='cancelled', updated_at=now() where user_id='ef9002c7-657f-4c53-9ebb-f10c9aaacf83' and status in ('active','paid','approved','trialing');

insert into public.subscriptions (user_id, plan, status, amount, provider, current_period_start, current_period_end, is_trial)
values ('ef9002c7-657f-4c53-9ebb-f10c9aaacf83', 'business', 'active', 159.60, 'manual', now(), now() + interval '30 days', false);

update public.profiles set plano='business', updated_at=now() where user_id='ef9002c7-657f-4c53-9ebb-f10c9aaacf83';