CREATE OR REPLACE FUNCTION public.claim_publication_image_analysis(p_url text, p_owner uuid)
 RETURNS TABLE(claimed boolean, reason text, clean boolean, retry_after timestamp with time zone, inconclusive_attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.ml_image_vision_cache%ROWTYPE;
BEGIN
  IF p_owner IS NULL OR p_url IS NULL OR btrim(p_url) = '' OR length(p_url) > 4096 THEN
    RAISE EXCEPTION 'Invalid image analysis claim';
  END IF;
  INSERT INTO public.ml_image_vision_cache(url, clean, reason, checked_at)
  VALUES (p_url, NULL, NULL, now())
  ON CONFLICT (url) DO NOTHING;
  SELECT * INTO r FROM public.ml_image_vision_cache WHERE url = p_url FOR UPDATE;
  IF coalesce(r.reason ~ '"veredito"\s*:\s*"(aprovada|reprovada)"', false)
     OR coalesce(r.analysis_lease_until > now(), false)
     OR coalesce(r.retry_after > now(), false) THEN
    RETURN QUERY SELECT false, r.reason, r.clean, r.retry_after, r.inconclusive_attempts;
    RETURN;
  END IF;
  IF r.retry_after IS NOT NULL AND r.retry_after <= now() AND r.inconclusive_attempts >= 2 THEN
    r.inconclusive_attempts := 0;
  END IF;
  -- Lease covers download (15s) + gateway (30s) + direct fallback (30s).
  UPDATE public.ml_image_vision_cache
  SET inconclusive_attempts = r.inconclusive_attempts,
      analysis_lease_owner = p_owner,
      analysis_lease_until = now() + interval '120 seconds',
      last_error = NULL
  WHERE url = p_url;
  RETURN QUERY SELECT true, r.reason, r.clean, r.retry_after, r.inconclusive_attempts;
END
$function$;

CREATE OR REPLACE FUNCTION public.finish_publication_image_analysis(p_url text, p_owner uuid, p_reason text DEFAULT NULL::text, p_clean boolean DEFAULT NULL::boolean, p_provider text DEFAULT NULL::text, p_attempts integer DEFAULT NULL::integer, p_retry_after timestamp with time zone DEFAULT NULL::timestamp with time zone, p_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_reason IS NOT NULL THEN
    IF NOT coalesce(p_reason ~ '"veredito"\s*:\s*"(aprovada|reprovada)"', false) THEN
      RAISE EXCEPTION 'Only explicit image verdicts can replace the cache reason';
    END IF;
    -- A paid verdict is kept even if the lease expired, unless another
    -- analysis already saved an explicit verdict for this URL.
    UPDATE public.ml_image_vision_cache
    SET clean = p_clean,
        reason = p_reason,
        checked_at = now(),
        inconclusive_attempts = 0,
        retry_after = NULL,
        last_provider = p_provider,
        last_error = NULL,
        analysis_lease_owner = NULL,
        analysis_lease_until = NULL
    WHERE url = p_url
      AND (analysis_lease_owner = p_owner
           OR NOT coalesce(reason ~ '"veredito"\s*:\s*"(aprovada|reprovada)"', false));
  ELSE
    UPDATE public.ml_image_vision_cache
    SET inconclusive_attempts = greatest(0, least(coalesce(p_attempts, inconclusive_attempts), 2)),
        retry_after = p_retry_after,
        last_provider = p_provider,
        last_error = left(coalesce(p_error, ''), 500),
        analysis_lease_owner = NULL,
        analysis_lease_until = NULL
    WHERE url = p_url AND analysis_lease_owner = p_owner;
  END IF;
END
$function$;