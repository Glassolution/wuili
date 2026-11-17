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
  -- Null-safe: an empty/cleared circuit ('{}' or NULL) must allow analysis.
  RETURN NOT (coalesce(p_background, false) AND coalesce(state->>'kind', '') = 'terminal');
END
$function$;