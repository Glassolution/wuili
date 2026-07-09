UPDATE public.subscriptions
SET is_trial = true,
    trial_ends_at = now() + interval '5 days',
    updated_at = now()
WHERE id = 'f4872973-68cc-44a3-8e51-581256a4a68d';