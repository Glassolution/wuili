
-- Cancel any active subscription for the two admins, then insert a fresh 30-day Business trial.
WITH admins AS (
  SELECT id AS user_id, email FROM auth.users
  WHERE email IN ('xavierluisfelipe12@gmail.com','lucassrby@gmail.com')
)
UPDATE public.subscriptions s
SET status = 'cancelled', updated_at = now()
FROM admins a
WHERE s.user_id = a.user_id AND s.status = 'active';

INSERT INTO public.subscriptions (user_id, plan, status, is_trial, trial_ends_at, post_trial_plan, amount, current_period_start, current_period_end, payment_method)
SELECT u.id, 'business', 'active', true, now() + interval '30 days', 'business', 0, now(), now() + interval '30 days', 'trial'
FROM auth.users u
WHERE u.email IN ('xavierluisfelipe12@gmail.com','lucassrby@gmail.com');

UPDATE public.profiles p
SET plano = 'business', updated_at = now()
FROM auth.users u
WHERE p.user_id = u.id AND u.email IN ('xavierluisfelipe12@gmail.com','lucassrby@gmail.com');
