
-- Restaurar subscriptions perdidas para usuários que estavam no trial
-- e ficaram sem registro após a descontinuação do trial de 5 dias.
-- Regra: quem tinha trial ativado ganha extensão de 1 mês.
INSERT INTO public.subscriptions (
  user_id, plan, status, amount, is_trial,
  current_period_start, current_period_end,
  created_at, updated_at
)
SELECT
  p.user_id,
  lower(p.plano),
  'active',
  0,
  false,
  now(),
  now() + interval '30 days',
  now(),
  now()
FROM public.profiles p
LEFT JOIN public.subscriptions s ON s.user_id = p.user_id
WHERE p.plano IS NOT NULL
  AND lower(p.plano) NOT IN ('gratis','free')
  AND s.id IS NULL;
