CREATE OR REPLACE FUNCTION public.rpc_landing_track(
  p_event text,
  p_visitor_id text DEFAULT NULL,
  p_device text DEFAULT NULL,
  p_referrer text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event NOT IN (
    'landing_view',
    'cta_offer_click',
    'cta_header_login_click',
    'cta_hero_signup_click',
    'cta_how_it_works_click',
    'cta_sticky_signup_click',
    'cta_steps_signup_click',
    'cta_profit_signup_click',
    'cta_final_signup_click',
    'cta_primary_click',
    'how_it_works_click',
    'login_link_click'
  ) THEN
    RETURN false;
  END IF;

  INSERT INTO public.landing_events (event, visitor_id, device, referrer)
  VALUES (
    p_event,
    left(coalesce(p_visitor_id, ''), 64),
    left(coalesce(p_device, ''), 20),
    left(coalesce(p_referrer, ''), 300)
  );

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_landing_track(text, text, text, text) TO anon, authenticated;