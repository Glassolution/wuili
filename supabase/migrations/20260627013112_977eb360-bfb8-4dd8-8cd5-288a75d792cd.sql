
CREATE TABLE public.atlas_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX atlas_threads_user_updated_idx ON public.atlas_threads(user_id, updated_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atlas_threads TO authenticated;
GRANT ALL ON public.atlas_threads TO service_role;
ALTER TABLE public.atlas_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atlas_threads owner" ON public.atlas_threads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.atlas_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.atlas_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX atlas_messages_thread_idx ON public.atlas_messages(thread_id, created_at ASC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.atlas_messages TO authenticated;
GRANT ALL ON public.atlas_messages TO service_role;
ALTER TABLE public.atlas_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "atlas_messages owner" ON public.atlas_messages FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER atlas_threads_updated_at BEFORE UPDATE ON public.atlas_threads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
