INSERT INTO public.subscriptions (user_id, plan, status, amount, provider, payment_method, current_period_start, current_period_end)
VALUES ('cb9170fa-eea4-4a6e-85fa-c191d1f5aa8a', 'business', 'active', 159.60, 'validapay', 'manual', now(), now() + interval '30 days');

UPDATE public.profiles SET plano = 'business', updated_at = now() WHERE user_id = 'cb9170fa-eea4-4a6e-85fa-c191d1f5aa8a';