
CREATE TABLE public.sales_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  overall_score NUMERIC(3,1) NOT NULL DEFAULT 0,
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  sections JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_reports TO authenticated;
GRANT ALL ON public.sales_reports TO service_role;
ALTER TABLE public.sales_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own reports" ON public.sales_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX sales_reports_user_created_idx ON public.sales_reports(user_id, created_at DESC);
