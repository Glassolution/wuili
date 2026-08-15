CREATE TABLE public.atlas_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  origem text NOT NULL CHECK (origem IN ('guia','modelo')),
  model text,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  message_chars integer NOT NULL DEFAULT 0,
  step integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_atlas_usage_logs_origem_created ON public.atlas_usage_logs (origem, created_at DESC);
CREATE INDEX idx_atlas_usage_logs_user ON public.atlas_usage_logs (user_id);

GRANT SELECT ON public.atlas_usage_logs TO authenticated;
GRANT ALL ON public.atlas_usage_logs TO service_role;

ALTER TABLE public.atlas_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own atlas usage"
ON public.atlas_usage_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all atlas usage"
ON public.atlas_usage_logs FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()));