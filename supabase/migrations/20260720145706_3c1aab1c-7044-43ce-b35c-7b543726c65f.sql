DO $$
DECLARE
  target_user_id uuid := '6de27280-c39c-4af2-81ee-d613e67733df';
BEGIN
  UPDATE public.profiles SET plano = 'base' WHERE user_id = target_user_id;
  IF NOT EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = target_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'Assinatura ativa esperada não foi encontrada';
  END IF;
END $$;