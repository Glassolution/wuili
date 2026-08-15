CREATE TABLE public.ml_publish_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ml_user_id BIGINT,
  http_status INTEGER,
  raw_response JSONB,
  cause JSONB,
  mapped_code TEXT,
  mapped_message TEXT,
  product_title TEXT,
  category_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX ml_publish_errors_user_id_idx ON public.ml_publish_errors (user_id, created_at DESC);
CREATE INDEX ml_publish_errors_code_idx ON public.ml_publish_errors (mapped_code, created_at DESC);

GRANT SELECT ON public.ml_publish_errors TO authenticated;
GRANT ALL ON public.ml_publish_errors TO service_role;

ALTER TABLE public.ml_publish_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own publish errors"
  ON public.ml_publish_errors FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all publish errors"
  ON public.ml_publish_errors FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));