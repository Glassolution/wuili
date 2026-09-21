CREATE TABLE public.mobile_home_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id text NOT NULL,
  event_name text NOT NULL,
  detail text,
  product_id text,
  elapsed_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT, SELECT ON public.mobile_home_events TO authenticated;
GRANT ALL ON public.mobile_home_events TO service_role;

ALTER TABLE public.mobile_home_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own mobile home events"
ON public.mobile_home_events
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own mobile home events"
ON public.mobile_home_events
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX mobile_home_events_user_created_idx
ON public.mobile_home_events (user_id, created_at DESC);

CREATE INDEX mobile_home_events_name_created_idx
ON public.mobile_home_events (event_name, created_at DESC);

CREATE OR REPLACE FUNCTION public.mobile_catalog_popularity()
RETURNS TABLE(product_id text, publication_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT up.catalog_product_id::text AS product_id, count(*)::bigint AS publication_count
  FROM public.user_publications up
  WHERE up.catalog_product_id IS NOT NULL
  GROUP BY up.catalog_product_id::text
$$;

REVOKE ALL ON FUNCTION public.mobile_catalog_popularity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mobile_catalog_popularity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_catalog_popularity() TO service_role;