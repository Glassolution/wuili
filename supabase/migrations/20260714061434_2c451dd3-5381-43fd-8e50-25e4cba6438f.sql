
-- 1) Grant admin role to xavierluisfelipe199@gmail.com
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'xavierluisfelipe199@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Security-definer function: expose only display_name/avatar_url of help_feed_posts authors
CREATE OR REPLACE FUNCTION public.get_help_feed_authors(_author_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.display_name, p.avatar_url
  FROM public.profiles p
  WHERE p.user_id = ANY(_author_ids)
    AND EXISTS (
      SELECT 1 FROM public.help_feed_posts hp WHERE hp.author_id = p.user_id
      UNION ALL
      SELECT 1 FROM public.help_feed_comments hc WHERE hc.author_id = p.user_id
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_help_feed_authors(uuid[]) TO authenticated;
