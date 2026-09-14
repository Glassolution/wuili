DO $$
DECLARE
  target_user_id uuid := '6de27280-c39c-4af2-81ee-d613e67733df';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = target_user_id AND status = 'active'
  ) THEN
    INSERT INTO public.subscriptions (
      user_id, plan, status, payment_method, amount,
      current_period_start, current_period_end, is_trial, updated_at
    ) VALUES (
      target_user_id, 'base', 'active', 'manual_payment_recovery', 29.90,
      now(), now() + interval '30 days', false, now()
    );
  END IF;

  UPDATE public.profiles
  SET plano = 'base'
  WHERE user_id = target_user_id;
END $$;