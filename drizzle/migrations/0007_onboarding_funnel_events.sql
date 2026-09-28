CREATE OR REPLACE FUNCTION public.rpc_signup_track(p_event text, p_visitor_id text DEFAULT NULL::text, p_device text DEFAULT NULL::text, p_detail text DEFAULT NULL::text, p_referrer text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF p_event NOT IN (
    'signup_view','signup_start','signup_submit','signup_success','signup_error',
    'signup_google_click','signup_inapp_browser','login_submit','login_success','login_error',
    'onboarding_view','onboarding_start','onboarding_question_view','onboarding_answer',
    'onboarding_skip','onboarding_back','onboarding_complete','onboarding_ml_guide',
    'onboarding_first_product_view'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.landing_events (event, visitor_id, device, referrer, detail)
  VALUES (
    p_event,
    left(coalesce(p_visitor_id, ''), 64),
    left(coalesce(p_device, ''), 20),
    left(coalesce(p_referrer, ''), 300),
    left(coalesce(p_detail, ''), 120)
  );

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rpc_admin_signup_funnel(p_days integer DEFAULT 30)
 RETURNS TABLE(evento text, detalhe text, total bigint, visitantes bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT e.event, nullif(e.detail, ''), count(*)::bigint, count(DISTINCT e.visitor_id)::bigint
  FROM public.landing_events e
  WHERE public.is_admin(auth.uid())
    AND e.event LIKE ANY (ARRAY['signup%','login%','onboarding%'])
    AND e.created_at >= now() - make_interval(days => greatest(p_days, 1))
  GROUP BY e.event, nullif(e.detail, '')
  ORDER BY 3 DESC;
$function$;