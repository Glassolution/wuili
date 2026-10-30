ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS ml_nickname text,
  ADD COLUMN IF NOT EXISTS ml_nickname_updated_at timestamptz;
COMMENT ON COLUMN public.user_integrations.ml_nickname IS 'Apelido da conta do Mercado Livre conectada (GET /users/me), salvo na conexão para não chamar o ML a cada abertura da tela.';