CREATE TABLE IF NOT EXISTS public.tiktok_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  event_id text NOT NULL UNIQUE,
  user_id uuid,
  subscription_id uuid,
  value numeric,
  currency text,
  payload jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  test_mode boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tiktok_events_status_idx ON public.tiktok_events(status, created_at);
GRANT SELECT ON public.tiktok_events TO authenticated;
GRANT ALL ON public.tiktok_events TO service_role;
ALTER TABLE public.tiktok_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem eventos TikTok" ON public.tiktok_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_admin = true));