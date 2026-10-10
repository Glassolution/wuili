DROP POLICY IF EXISTS "Authenticated users can read worker settings" ON public.dropship_worker_settings;
CREATE POLICY "Admins can read worker settings" ON public.dropship_worker_settings
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_bot_purchase_settings()
RETURNS TABLE(enabled boolean, audience text, access_levels text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.enabled, s.audience, s.access_levels
  FROM public.dropship_worker_settings s
  WHERE s.id = true AND auth.uid() IS NOT NULL
$$;
REVOKE ALL ON FUNCTION public.get_bot_purchase_settings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bot_purchase_settings() TO authenticated;