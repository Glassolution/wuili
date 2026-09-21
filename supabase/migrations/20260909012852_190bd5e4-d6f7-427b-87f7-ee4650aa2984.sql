CREATE TABLE IF NOT EXISTS public.c7drop_user_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'not_connected',
  email text,
  password_ciphertext text,
  password_iv text,
  password_tag text,
  first_name text,
  last_name text,
  phone text,
  document text,
  signup_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT c7drop_user_accounts_status_check CHECK (
    status IN ('not_connected', 'connected', 'signup_requested', 'manual_action_required', 'invalid_credentials')
  )
);

CREATE INDEX IF NOT EXISTS c7drop_user_accounts_status_idx
  ON public.c7drop_user_accounts (status, updated_at DESC);

GRANT ALL ON public.c7drop_user_accounts TO service_role;

ALTER TABLE public.c7drop_user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages C7Drop user accounts" ON public.c7drop_user_accounts;
CREATE POLICY "Service role manages C7Drop user accounts"
  ON public.c7drop_user_accounts FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS c7drop_user_accounts_set_updated_at ON public.c7drop_user_accounts;
CREATE TRIGGER c7drop_user_accounts_set_updated_at
  BEFORE UPDATE ON public.c7drop_user_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.c7drop_user_accounts IS
  'Credenciais do fornecedor por usuario. Senhas ficam criptografadas e acessiveis somente via Edge Function/worker.';