REVOKE ALL ON public.tiktok_shop_accounts FROM anon;
REVOKE ALL ON public.tiktok_shop_publications FROM anon;
REVOKE ALL ON public.tiktok_shop_oauth_states FROM anon;
REVOKE ALL ON public.tiktok_shop_oauth_states FROM authenticated;
GRANT ALL ON public.tiktok_shop_accounts TO service_role;
GRANT ALL ON public.tiktok_shop_publications TO service_role;
GRANT ALL ON public.tiktok_shop_oauth_states TO service_role;