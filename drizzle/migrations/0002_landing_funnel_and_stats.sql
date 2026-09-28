CREATE TABLE IF NOT EXISTS public.landing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  visitor_id text,
  device text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.landing_events TO authenticated;
GRANT ALL ON public.landing_events TO service_role;

ALTER TABLE public.landing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read landing events" ON public.landing_events;
CREATE POLICY "admins read landing events"
ON public.landing_events FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS landing_events_event_created_idx ON public.landing_events (event, created_at DESC);

CREATE OR REPLACE FUNCTION public.rpc_landing_track(p_event text, p_visitor_id text DEFAULT NULL, p_device text DEFAULT NULL, p_referrer text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event NOT IN ('landing_view', 'cta_primary_click', 'how_it_works_click', 'login_link_click') THEN
    RETURN false;
  END IF;

  INSERT INTO public.landing_events (event, visitor_id, device, referrer)
  VALUES (p_event, left(coalesce(p_visitor_id, ''), 64), left(coalesce(p_device, ''), 20), left(coalesce(p_referrer, ''), 300));

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_landing_track(text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_landing_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'assinantes_ativos', (SELECT count(*) FROM public.subscriptions WHERE status = 'active')
  );
$$;

GRANT EXECUTE ON FUNCTION public.rpc_landing_stats() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.rpc_admin_landing_funnel(p_days integer DEFAULT 30)
RETURNS TABLE(evento text, total bigint, visitantes bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.event, count(*)::bigint, count(DISTINCT e.visitor_id)::bigint
  FROM public.landing_events e
  WHERE public.is_admin(auth.uid())
    AND e.created_at >= now() - make_interval(days => greatest(p_days, 1))
  GROUP BY e.event
  ORDER BY 2 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_admin_landing_funnel(integer) TO authenticated;