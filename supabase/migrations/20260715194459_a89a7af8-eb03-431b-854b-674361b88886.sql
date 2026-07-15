
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aliexpress_access_token text,
  ADD COLUMN IF NOT EXISTS aliexpress_refresh_token text,
  ADD COLUMN IF NOT EXISTS aliexpress_token_expires_at timestamptz;
