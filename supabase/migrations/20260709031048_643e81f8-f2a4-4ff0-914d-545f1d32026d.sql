
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id, last_seen_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions insert" ON public.user_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions update" ON public.user_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own sessions select" ON public.user_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.user_page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  path TEXT NOT NULL,
  title TEXT,
  product_id TEXT,
  product_title TEXT,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_page_views_user ON public.user_page_views(user_id, viewed_at DESC);
CREATE INDEX idx_user_page_views_product ON public.user_page_views(user_id, product_id) WHERE product_id IS NOT NULL;
GRANT SELECT, INSERT ON public.user_page_views TO authenticated;
GRANT ALL ON public.user_page_views TO service_role;
ALTER TABLE public.user_page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own page views insert" ON public.user_page_views FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own page views select" ON public.user_page_views FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
