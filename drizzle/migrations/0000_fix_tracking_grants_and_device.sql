-- Restore Data API access for tracking tables (inserts were silently failing)
GRANT SELECT, INSERT ON public.user_page_views TO authenticated;
GRANT ALL ON public.user_page_views TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;

ALTER TABLE public.user_page_views ADD COLUMN IF NOT EXISTS device text;
ALTER TABLE public.user_page_views ADD COLUMN IF NOT EXISTS referrer text;
ALTER TABLE public.user_page_views ADD COLUMN IF NOT EXISTS session_id uuid;

ALTER TABLE public.user_sessions ADD COLUMN IF NOT EXISTS device text;

CREATE INDEX IF NOT EXISTS idx_user_page_views_viewed_at ON public.user_page_views (viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_page_views_session ON public.user_page_views (session_id, viewed_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON public.user_sessions (started_at DESC);