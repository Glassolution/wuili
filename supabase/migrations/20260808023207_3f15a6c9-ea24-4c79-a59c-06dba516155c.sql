CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  jwt_role text := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (current_setting('request.jwt.claims', true)::jsonb ->> 'role'));
  is_backend boolean := (jwt_role IS NULL OR jwt_role = 'service_role');
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT is_backend AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'forbidden: apenas administradores podem alterar is_admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.plano IS DISTINCT FROM OLD.plano THEN
    IF NOT is_backend AND NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'forbidden: apenas administradores podem alterar plano'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: sincroniza o plano do perfil com a assinatura ativa mais recente
UPDATE public.profiles p
SET plano = s.plan
FROM (
  SELECT DISTINCT ON (user_id) user_id, plan
  FROM public.subscriptions
  WHERE status IN ('active','paid','approved','trialing')
  ORDER BY user_id, created_at DESC
) s
WHERE p.user_id = s.user_id
  AND coalesce(p.plano,'gratis') IS DISTINCT FROM s.plan;