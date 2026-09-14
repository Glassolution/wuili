
-- 1) Private schema for internal SECURITY DEFINER helpers (not API-exposed)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION private.is_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE user_id = _uid LIMIT 1), false) $$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin(uuid) TO authenticated, service_role;

-- 2) Recreate policies to reference private.* instead of public.*
-- user_roles
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- support_tickets
DROP POLICY IF EXISTS users_own_tickets ON public.support_tickets;
CREATE POLICY users_own_tickets ON public.support_tickets FOR ALL TO authenticated
  USING ((auth.uid() = user_id) OR private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK ((auth.uid() = user_id) OR private.has_role(auth.uid(),'admin'::public.app_role));

-- support_messages
DROP POLICY IF EXISTS users_own_messages ON public.support_messages;
CREATE POLICY users_own_messages ON public.support_messages FOR ALL TO authenticated
  USING ((EXISTS (SELECT 1 FROM public.support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.user_id = auth.uid())) OR private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK ((EXISTS (SELECT 1 FROM public.support_tickets WHERE support_tickets.id = support_messages.ticket_id AND support_tickets.user_id = auth.uid())) OR private.has_role(auth.uid(),'admin'::public.app_role));

-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- subscriptions
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- orders
DROP POLICY IF EXISTS "Admins can view all orders" ON public.orders;
CREATE POLICY "Admins can view all orders" ON public.orders FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- user_integrations
DROP POLICY IF EXISTS "Admins can view all integrations" ON public.user_integrations;
CREATE POLICY "Admins can view all integrations" ON public.user_integrations FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- user_publications
DROP POLICY IF EXISTS "Admins can view all publications" ON public.user_publications;
CREATE POLICY "Admins can view all publications" ON public.user_publications FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- affiliates
DROP POLICY IF EXISTS "Admins view all affiliates" ON public.affiliates;
CREATE POLICY "Admins view all affiliates" ON public.affiliates FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- affiliate_clicks
DROP POLICY IF EXISTS "Admins view all clicks" ON public.affiliate_clicks;
CREATE POLICY "Admins view all clicks" ON public.affiliate_clicks FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- affiliate_conversions
DROP POLICY IF EXISTS "Admins view all conversions" ON public.affiliate_conversions;
CREATE POLICY "Admins view all conversions" ON public.affiliate_conversions FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- affiliate_settings
DROP POLICY IF EXISTS "Admins manage settings" ON public.affiliate_settings;
CREATE POLICY "Admins manage settings" ON public.affiliate_settings FOR ALL TO authenticated
  USING (private.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(),'admin'::public.app_role));

-- user_sessions
DROP POLICY IF EXISTS "own sessions select" ON public.user_sessions;
CREATE POLICY "own sessions select" ON public.user_sessions FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR private.has_role(auth.uid(),'admin'::public.app_role));

-- user_page_views
DROP POLICY IF EXISTS "own page views select" ON public.user_page_views;
CREATE POLICY "own page views select" ON public.user_page_views FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR private.has_role(auth.uid(),'admin'::public.app_role));

-- refund_requests
DROP POLICY IF EXISTS "Admins can view all refund requests" ON public.refund_requests;
CREATE POLICY "Admins can view all refund requests" ON public.refund_requests FOR SELECT TO authenticated USING (private.has_role(auth.uid(),'admin'::public.app_role));

-- help_feed_posts
DROP POLICY IF EXISTS help_posts_insert ON public.help_feed_posts;
DROP POLICY IF EXISTS help_posts_update ON public.help_feed_posts;
DROP POLICY IF EXISTS help_posts_delete ON public.help_feed_posts;
CREATE POLICY help_posts_insert ON public.help_feed_posts FOR INSERT TO authenticated WITH CHECK (private.is_admin(auth.uid()) AND author_id = auth.uid());
CREATE POLICY help_posts_update ON public.help_feed_posts FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY help_posts_delete ON public.help_feed_posts FOR DELETE TO authenticated USING (private.is_admin(auth.uid()));

-- help_feed_comments
DROP POLICY IF EXISTS help_comments_delete ON public.help_feed_comments;
CREATE POLICY help_comments_delete ON public.help_feed_comments FOR DELETE TO authenticated USING (author_id = auth.uid() OR private.is_admin(auth.uid()));

-- help_feed_tutorials
DROP POLICY IF EXISTS help_tut_insert ON public.help_feed_tutorials;
DROP POLICY IF EXISTS help_tut_update ON public.help_feed_tutorials;
DROP POLICY IF EXISTS help_tut_delete ON public.help_feed_tutorials;
CREATE POLICY help_tut_insert ON public.help_feed_tutorials FOR INSERT TO authenticated WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY help_tut_update ON public.help_feed_tutorials FOR UPDATE TO authenticated USING (private.is_admin(auth.uid())) WITH CHECK (private.is_admin(auth.uid()));
CREATE POLICY help_tut_delete ON public.help_feed_tutorials FOR DELETE TO authenticated USING (private.is_admin(auth.uid()));

-- storage policies for help-feed-media
DROP POLICY IF EXISTS help_media_insert ON storage.objects;
DROP POLICY IF EXISTS help_media_update ON storage.objects;
DROP POLICY IF EXISTS help_media_delete ON storage.objects;
CREATE POLICY help_media_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'help-feed-media' AND private.is_admin(auth.uid()));
CREATE POLICY help_media_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'help-feed-media' AND private.is_admin(auth.uid()));
CREATE POLICY help_media_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'help-feed-media' AND private.is_admin(auth.uid()));

-- 3) Drop old public SECURITY DEFINER helpers
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- 4) Revoke EXECUTE on trigger-only SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_new_order() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_admin_escalation() FROM PUBLIC, anon, authenticated;

-- 5) Fix SUPA_rls_policy_always_true — restrict service-role catchall policies to service_role only
DROP POLICY IF EXISTS "Service role only" ON public.cj_token_cache;
CREATE POLICY "Service role only" ON public.cj_token_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;
CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages refund requests" ON public.refund_requests;
CREATE POLICY "Service role manages refund requests" ON public.refund_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages oauth states" ON public.ml_oauth_states;
CREATE POLICY "Service role manages oauth states" ON public.ml_oauth_states FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages affiliates" ON public.affiliates;
CREATE POLICY "Service role manages affiliates" ON public.affiliates FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages clicks" ON public.affiliate_clicks;
CREATE POLICY "Service role manages clicks" ON public.affiliate_clicks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages conversions" ON public.affiliate_conversions;
CREATE POLICY "Service role manages conversions" ON public.affiliate_conversions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages settings" ON public.affiliate_settings;
CREATE POLICY "Service role manages settings" ON public.affiliate_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Tighten public affiliate click insert with basic validation
DROP POLICY IF EXISTS "Anyone can insert clicks" ON public.affiliate_clicks;
CREATE POLICY "Anyone can insert clicks" ON public.affiliate_clicks FOR INSERT TO anon, authenticated
  WITH CHECK (affiliate_code IS NOT NULL AND length(affiliate_code) BETWEEN 1 AND 64);

-- 6) catalog_products cost/supplier exposure: restrict SELECT to authenticated only,
--    drop the anonymous "public read" policy. Also drop redundant "true" policy and
--    replace with a scoped authenticated policy.
DROP POLICY IF EXISTS "Public can read non-blocked catalog products" ON public.catalog_products;
DROP POLICY IF EXISTS "Authenticated users can read catalog" ON public.catalog_products;
CREATE POLICY "Authenticated can read active catalog" ON public.catalog_products
  FOR SELECT TO authenticated USING (is_blocked = false);
REVOKE SELECT ON public.catalog_products FROM anon;

-- Suppliers & supplier_products also had USING(true) SELECT — keep for authenticated only
DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users can read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated users can read supplier products" ON public.supplier_products;
CREATE POLICY "Authenticated users can read supplier products" ON public.supplier_products FOR SELECT TO authenticated USING (true);

-- 7) Public bucket listing: drop broad SELECT on storage.objects for product-images
--    (files are still reachable via public URL since the bucket is public).
DROP POLICY IF EXISTS "Public read access for product images" ON storage.objects;

-- 8) product-images ownership: restrict INSERT/UPDATE to files under the user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update product images" ON storage.objects;
CREATE POLICY "Users upload own product images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users update own product images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users delete own product images" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
