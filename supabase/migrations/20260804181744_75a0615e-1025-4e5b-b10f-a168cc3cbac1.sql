CREATE TABLE public.ai_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'full',
  image_url TEXT,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_characters TO authenticated;
GRANT ALL ON public.ai_characters TO service_role;

ALTER TABLE public.ai_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own AI characters"
ON public.ai_characters FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ai_characters_user_idx ON public.ai_characters(user_id, created_at DESC);

CREATE TRIGGER update_ai_characters_updated_at
BEFORE UPDATE ON public.ai_characters
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "AI character images are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'ai-characters');

CREATE POLICY "Users upload their own AI character images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'ai-characters' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete their own AI character images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'ai-characters' AND (storage.foldername(name))[1] = auth.uid()::text);