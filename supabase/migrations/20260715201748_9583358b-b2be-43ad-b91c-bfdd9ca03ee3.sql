CREATE TABLE IF NOT EXISTS public.aliexpress_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.aliexpress_oauth_states TO service_role;

ALTER TABLE public.aliexpress_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aliexpress_oauth_states_no_client_access"
  ON public.aliexpress_oauth_states
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_aliexpress_oauth_states_user_id
  ON public.aliexpress_oauth_states(user_id);