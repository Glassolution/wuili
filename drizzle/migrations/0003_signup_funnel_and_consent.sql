ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_source text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_source text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_medium text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS utm_campaign text;

ALTER TABLE public.landing_events ADD COLUMN IF NOT EXISTS detail text;

CREATE OR REPLACE FUNCTION public.rpc_signup_track(
  p_event text,
  p_visitor_id text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_detail text DEFAULT NULL,
  p_referrer text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event NOT IN (
    'signup_view','signup_start','signup_submit','signup_success','signup_error',
    'signup_google_click','signup_inapp_browser','login_submit','login_success','login_error'
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
$$;

GRANT EXECUTE ON FUNCTION public.rpc_signup_track(text, text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_signup_funnel(p_days integer DEFAULT 30)
RETURNS TABLE(evento text, detalhe text, total bigint, visitantes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.event, nullif(e.detail, ''), count(*)::bigint, count(DISTINCT e.visitor_id)::bigint
  FROM public.landing_events e
  WHERE public.is_admin(auth.uid())
    AND e.event LIKE ANY (ARRAY['signup%','login%'])
    AND e.created_at >= now() - make_interval(days => greatest(p_days, 1))
  GROUP BY e.event, nullif(e.detail, '')
  ORDER BY 3 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_signup_funnel(integer) TO authenticated;