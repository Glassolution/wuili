REVOKE ALL ON public.ml_webhook_queue FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.ml_webhook_queue TO service_role;

ALTER TABLE public.ml_webhook_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ml_webhook_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_only_ml_webhook_queue" ON public.ml_webhook_queue;
CREATE POLICY "ml_webhook_queue_deny_all"
ON public.ml_webhook_queue
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'forbidden: apenas administradores podem alterar is_admin'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.plano IS DISTINCT FROM OLD.plano THEN
    IF NOT public.is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'forbidden: apenas administradores podem alterar plano'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;