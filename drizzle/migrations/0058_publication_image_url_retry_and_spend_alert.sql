ALTER TABLE public.ml_image_vision_cache
  ADD COLUMN IF NOT EXISTS inconclusive_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retry_after timestamp with time zone,
  ADD COLUMN IF NOT EXISTS analysis_lease_owner uuid,
  ADD COLUMN IF NOT EXISTS analysis_lease_until timestamp with time zone,
  ADD COLUMN IF NOT EXISTS last_provider text,
  ADD COLUMN IF NOT EXISTS last_error text;

CREATE TABLE public.image_ai_daily_usage (
  usage_date date PRIMARY KEY,
  lovable_credits numeric(14,6) NOT NULL DEFAULT 0,
  gateway_calls integer NOT NULL DEFAULT 0,
  direct_calls integer NOT NULL DEFAULT 0,
  alert_sent_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT ALL ON public.image_ai_daily_usage TO service_role;
ALTER TABLE public.image_ai_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_publication_image_analysis(p_url text, p_owner uuid)
RETURNS TABLE(claimed boolean, reason text, clean boolean, retry_after timestamp with time zone, inconclusive_attempts integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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
     OR r.analysis_lease_until > now()
     OR r.retry_after > now() THEN
    RETURN QUERY SELECT false, r.reason, r.clean, r.retry_after, r.inconclusive_attempts;
    RETURN;
  END IF;
  IF r.retry_after IS NOT NULL AND r.retry_after <= now() AND r.inconclusive_attempts >= 2 THEN
    r.inconclusive_attempts := 0;
  END IF;
  UPDATE public.ml_image_vision_cache
  SET inconclusive_attempts = r.inconclusive_attempts,
      analysis_lease_owner = p_owner,
      analysis_lease_until = now() + interval '45 seconds',
      last_error = NULL
  WHERE url = p_url;
  RETURN QUERY SELECT true, r.reason, r.clean, r.retry_after, r.inconclusive_attempts;
END
$function$;

CREATE OR REPLACE FUNCTION public.finish_publication_image_analysis(
  p_url text,
  p_owner uuid,
  p_reason text DEFAULT NULL,
  p_clean boolean DEFAULT NULL,
  p_provider text DEFAULT NULL,
  p_attempts integer DEFAULT NULL,
  p_retry_after timestamp with time zone DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  IF p_reason IS NOT NULL THEN
    IF NOT coalesce(p_reason ~ '"veredito"\s*:\s*"(aprovada|reprovada)"', false) THEN
      RAISE EXCEPTION 'Only explicit image verdicts can replace the cache reason';
    END IF;
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
    WHERE url = p_url AND analysis_lease_owner = p_owner;
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

CREATE OR REPLACE FUNCTION public.record_publication_image_usage(p_credit_cost numeric, p_direct boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  d date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  previous_credits numeric;
  next_credits numeric;
BEGIN
  IF p_credit_cost IS NULL OR p_credit_cost < 0 OR p_credit_cost > 100 THEN
    RAISE EXCEPTION 'Invalid image usage cost';
  END IF;
  INSERT INTO public.image_ai_daily_usage(usage_date) VALUES (d) ON CONFLICT (usage_date) DO NOTHING;
  SELECT lovable_credits INTO previous_credits FROM public.image_ai_daily_usage WHERE usage_date = d FOR UPDATE;
  next_credits := previous_credits + p_credit_cost;
  UPDATE public.image_ai_daily_usage
  SET lovable_credits = next_credits,
      gateway_calls = gateway_calls + CASE WHEN p_direct THEN 0 ELSE 1 END,
      direct_calls = direct_calls + CASE WHEN p_direct THEN 1 ELSE 0 END,
      alert_sent_at = CASE WHEN alert_sent_at IS NULL AND previous_credits <= 5 AND next_credits > 5 THEN now() ELSE alert_sent_at END,
      updated_at = now()
  WHERE usage_date = d;
  IF previous_credits <= 5 AND next_credits > 5 THEN
    INSERT INTO public.notifications(user_id, type, title, message, action_url, metadata)
    SELECT ur.user_id,
           'ai_photo_daily_cost',
           'Validação de fotos passou de 5 créditos hoje',
           'O uso de IA para validar fotos hoje já soma ' || trim(to_char(next_credits, 'FM999999990.000')) || ' créditos Lovable. A publicação continua funcionando.',
           '/dashboard',
           jsonb_build_object('usage_date', d, 'lovable_credits', next_credits, 'threshold', 5)
    FROM public.user_roles ur
    WHERE ur.role = 'admin'
      AND EXISTS (SELECT 1 FROM public.image_ai_daily_usage u WHERE u.usage_date = d AND u.alert_sent_at IS NOT NULL);
  END IF;
END
$function$;

REVOKE ALL ON FUNCTION public.claim_publication_image_analysis(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finish_publication_image_analysis(text, uuid, text, boolean, text, integer, timestamp with time zone, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_publication_image_usage(numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_publication_image_analysis(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_publication_image_analysis(text, uuid, text, boolean, text, integer, timestamp with time zone, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_publication_image_usage(numeric, boolean) TO service_role;