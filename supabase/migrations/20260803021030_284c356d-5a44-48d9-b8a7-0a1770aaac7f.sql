CREATE OR REPLACE FUNCTION public.rpc_affiliate_subscriber_names()
RETURNS TABLE(subscriber_user_id uuid, display_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.user_id, p.display_name, p.email
  FROM public.affiliate_conversions ac
  JOIN public.affiliates a
    ON upper(a.code) = upper(ac.affiliate_code)
  JOIN public.profiles p
    ON p.user_id = ac.subscriber_user_id
  WHERE a.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.rpc_affiliate_subscriber_names() TO authenticated;