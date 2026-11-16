CREATE INDEX IF NOT EXISTS catalog_image_analysis_results_url_version_idx
  ON public.catalog_image_analysis_results (image_url, criterion_version, analyzed_at DESC);

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
  RETURN state->>'kind' IS DISTINCT FROM 'terminal';
END
$function$;