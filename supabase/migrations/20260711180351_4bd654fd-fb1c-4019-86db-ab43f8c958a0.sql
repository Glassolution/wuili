
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
SET is_admin = true
WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.user_id AND r.role = 'admin')
  AND is_admin = false;

CREATE OR REPLACE FUNCTION public.is_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE user_id = _uid LIMIT 1), false)
$$;

CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    IF NOT public.is_admin(auth.uid()) THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_admin_escalation_trg ON public.profiles;
CREATE TRIGGER prevent_self_admin_escalation_trg
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_admin_escalation();

CREATE TABLE public.help_feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_feed_posts TO authenticated;
GRANT ALL ON public.help_feed_posts TO service_role;
ALTER TABLE public.help_feed_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_posts_select" ON public.help_feed_posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "help_posts_insert" ON public.help_feed_posts FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) AND author_id = auth.uid());
CREATE POLICY "help_posts_update" ON public.help_feed_posts FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "help_posts_delete" ON public.help_feed_posts FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER help_posts_updated_at BEFORE UPDATE ON public.help_feed_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX help_posts_created_idx ON public.help_feed_posts (created_at DESC);

CREATE TABLE public.help_feed_likes (
  post_id uuid NOT NULL REFERENCES public.help_feed_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.help_feed_likes TO authenticated;
GRANT ALL ON public.help_feed_likes TO service_role;
ALTER TABLE public.help_feed_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_likes_select" ON public.help_feed_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "help_likes_insert" ON public.help_feed_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "help_likes_delete" ON public.help_feed_likes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX help_likes_post_idx ON public.help_feed_likes (post_id);

CREATE TABLE public.help_feed_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.help_feed_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.help_feed_comments TO authenticated;
GRANT ALL ON public.help_feed_comments TO service_role;
ALTER TABLE public.help_feed_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_comments_select" ON public.help_feed_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "help_comments_insert" ON public.help_feed_comments FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "help_comments_delete" ON public.help_feed_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE INDEX help_comments_post_idx ON public.help_feed_comments (post_id, created_at);

CREATE TABLE public.help_feed_tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body_md text NOT NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_feed_tutorials TO authenticated;
GRANT ALL ON public.help_feed_tutorials TO service_role;
ALTER TABLE public.help_feed_tutorials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "help_tut_select" ON public.help_feed_tutorials FOR SELECT TO authenticated USING (true);
CREATE POLICY "help_tut_insert" ON public.help_feed_tutorials FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "help_tut_update" ON public.help_feed_tutorials FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "help_tut_delete" ON public.help_feed_tutorials FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE TRIGGER help_tut_updated_at BEFORE UPDATE ON public.help_feed_tutorials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "help_media_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'help-feed-media');
CREATE POLICY "help_media_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'help-feed-media' AND public.is_admin(auth.uid()));
CREATE POLICY "help_media_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'help-feed-media' AND public.is_admin(auth.uid()));
CREATE POLICY "help_media_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'help-feed-media' AND public.is_admin(auth.uid()));
