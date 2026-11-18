-- Feed da comunidade: só posts escritos por admins são visíveis
DROP POLICY IF EXISTS help_posts_select ON public.help_feed_posts;
CREATE POLICY help_posts_select ON public.help_feed_posts
  FOR SELECT TO authenticated
  USING (private.is_admin(author_id));

-- Comentários e curtidas: só de posts visíveis
DROP POLICY IF EXISTS help_comments_select ON public.help_feed_comments;
CREATE POLICY help_comments_select ON public.help_feed_comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.help_feed_posts p
                 WHERE p.id = help_feed_comments.post_id AND private.is_admin(p.author_id)));

DROP POLICY IF EXISTS help_likes_select ON public.help_feed_likes;
CREATE POLICY help_likes_select ON public.help_feed_likes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.help_feed_posts p
                 WHERE p.id = help_feed_likes.post_id AND private.is_admin(p.author_id)));

-- Mídia do feed: só arquivos usados em posts visíveis (admins veem tudo)
DROP POLICY IF EXISTS help_media_read ON storage.objects;
CREATE POLICY help_media_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'help-feed-media'
    AND (
      private.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.help_feed_posts p
                 WHERE p.image_url = storage.objects.name
                   AND private.is_admin(p.author_id))
    )
  );

-- Sugestões: o próprio autor ou assinantes com plano
DROP POLICY IF EXISTS feature_suggestions_select_authenticated ON public.feature_suggestions;
CREATE POLICY feature_suggestions_select_authenticated ON public.feature_suggestions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.user_has_base_plan(auth.uid()));

-- Avaliações de loja: só de lojas publicadas, com dados válidos
DROP POLICY IF EXISTS store_reviews_public_read ON public.store_reviews;
CREATE POLICY store_reviews_public_read ON public.store_reviews
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.user_projects p
                 WHERE p.id = store_reviews.project_id AND p.status = 'publicado'));

DROP POLICY IF EXISTS store_reviews_public_insert ON public.store_reviews;
CREATE POLICY store_reviews_public_insert ON public.store_reviews
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    rating BETWEEN 1 AND 5
    AND char_length(coalesce(author_name, '')) BETWEEN 1 AND 80
    AND char_length(coalesce(comment, '')) <= 2000
    AND EXISTS (SELECT 1 FROM public.user_projects p
                WHERE p.id = store_reviews.project_id AND p.status = 'publicado')
  );