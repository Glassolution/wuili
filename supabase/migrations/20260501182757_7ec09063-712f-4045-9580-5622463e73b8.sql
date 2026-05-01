CREATE TABLE IF NOT EXISTS public.ml_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  redirect_to TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_oauth_states_user_id ON public.ml_oauth_states(user_id);
CREATE INDEX IF NOT EXISTS idx_ml_oauth_states_expires_at ON public.ml_oauth_states(expires_at);

ALTER TABLE public.ml_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages oauth states"
  ON public.ml_oauth_states
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);