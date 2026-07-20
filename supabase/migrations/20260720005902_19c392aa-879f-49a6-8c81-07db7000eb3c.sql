-- Sincroniza profiles.plano com subscriptions ativas: usuários que pagaram
-- ficaram com plano "gratis" no perfil por falha do webhook em atualizar
-- profiles.plano, fazendo a UI mostrar como gratuito mesmo pagando.
UPDATE public.profiles p
SET plano = s.plan
FROM public.subscriptions s
WHERE s.user_id = p.user_id
  AND s.status = 'active'
  AND s.plan IS NOT NULL
  AND LOWER(s.plan) NOT IN ('gratis','free')
  AND (p.plano IS NULL OR LOWER(p.plano) IN ('gratis','free'));