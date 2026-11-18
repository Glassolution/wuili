ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS meta_fbclid text,
  ADD COLUMN IF NOT EXISTS meta_fbc text,
  ADD COLUMN IF NOT EXISTS meta_fbp text,
  ADD COLUMN IF NOT EXISTS meta_click_captured_at timestamptz;

CREATE TABLE IF NOT EXISTS public.meta_capi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_id text NOT NULL UNIQUE,
  user_id uuid,
  subscription_id uuid,
  value numeric,
  currency text,
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','sent','failed','test')),
  test_event_code text,
  response_status integer,
  response_body text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
GRANT SELECT ON public.meta_capi_events TO authenticated;
GRANT ALL ON public.meta_capi_events TO service_role;
ALTER TABLE public.meta_capi_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem eventos Meta" ON public.meta_capi_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));