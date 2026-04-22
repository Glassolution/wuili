CREATE TABLE public.user_publications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ml_item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  status TEXT DEFAULT 'active',
  permalink TEXT,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own publications" ON public.user_publications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own publications" ON public.user_publications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own publications" ON public.user_publications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own publications" ON public.user_publications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_user_publications_updated_at
  BEFORE UPDATE ON public.user_publications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();