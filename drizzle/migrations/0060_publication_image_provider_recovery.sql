CREATE OR REPLACE FUNCTION public.publication_image_gate(p_background boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE state jsonb;
BEGIN
  INSERT INTO public.job_locks(job) VALUES ('publication-image-circuit') ON CONFLICT DO NOTHING;
  SELECT last_result INTO state FROM public.job_locks WHERE job='publication-image-circuit';
  RETURN NOT (p_background AND state->>'kind' = 'terminal');
END
$function$;

CREATE OR REPLACE FUNCTION public.publication_image_resume_after_success()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  UPDATE public.job_locks
  SET locked_until = now(), last_result = '{}'::jsonb
  WHERE job = 'publication-image-circuit';
$function$;