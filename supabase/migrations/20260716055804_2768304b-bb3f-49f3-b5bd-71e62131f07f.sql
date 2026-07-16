
CREATE TABLE public.seller_mp_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  mp_user_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  public_key TEXT,
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seller_mp_accounts TO authenticated;
GRANT ALL ON public.seller_mp_accounts TO service_role;

ALTER TABLE public.seller_mp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own MP account"
  ON public.seller_mp_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can insert their own MP account"
  ON public.seller_mp_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own MP account"
  ON public.seller_mp_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own MP account"
  ON public.seller_mp_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);

CREATE TRIGGER seller_mp_accounts_updated_at
  BEFORE UPDATE ON public.seller_mp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_seller_mp_accounts_expires ON public.seller_mp_accounts(token_expires_at);
