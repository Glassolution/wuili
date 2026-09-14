CREATE TABLE public.tiktok_shop_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id text,
  shop_cipher text,
  shop_name text,
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'connected',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_shop_accounts TO authenticated;
GRANT ALL ON public.tiktok_shop_accounts TO service_role;
ALTER TABLE public.tiktok_shop_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tiktok shop account"
ON public.tiktok_shop_accounts FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_tiktok_shop_accounts_updated_at
BEFORE UPDATE ON public.tiktok_shop_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tiktok_shop_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_product_id uuid NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  shop_id text,
  tiktok_product_id text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, catalog_product_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_shop_publications TO authenticated;
GRANT ALL ON public.tiktok_shop_publications TO service_role;
ALTER TABLE public.tiktok_shop_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tiktok publications"
ON public.tiktok_shop_publications FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_tiktok_shop_publications_updated_at
BEFORE UPDATE ON public.tiktok_shop_publications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.tiktok_shop_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.tiktok_shop_oauth_states TO service_role;
ALTER TABLE public.tiktok_shop_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages tiktok oauth states"
ON public.tiktok_shop_oauth_states FOR ALL TO service_role
USING (true) WITH CHECK (true);