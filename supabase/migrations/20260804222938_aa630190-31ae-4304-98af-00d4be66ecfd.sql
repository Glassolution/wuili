ALTER TABLE public.tiktok_shop_oauth_states ADD COLUMN IF NOT EXISTS redirect_to text;
ALTER TABLE public.tiktok_shop_accounts ADD COLUMN IF NOT EXISTS currency text;
ALTER TABLE public.tiktok_shop_accounts ADD COLUMN IF NOT EXISTS region text;

REVOKE ALL ON public.tiktok_shop_accounts FROM authenticated;
GRANT SELECT (id, user_id, shop_id, shop_name, status, connected_at, created_at, updated_at, currency, region) ON public.tiktok_shop_accounts TO authenticated;
GRANT DELETE ON public.tiktok_shop_accounts TO authenticated;
GRANT ALL ON public.tiktok_shop_accounts TO service_role;