ALTER TABLE public.user_publications
  ADD COLUMN IF NOT EXISTS package_weight_g integer,
  ADD COLUMN IF NOT EXISTS package_dimensions text,
  ADD COLUMN IF NOT EXISTS dimensions_ok boolean,
  ADD COLUMN IF NOT EXISTS dimensions_checked_at timestamptz;

CREATE TABLE IF NOT EXISTS public.ml_dimension_fixes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ml_item_id text NOT NULL,
  publication_id uuid,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  before_dimensions text,
  after_dimensions text,
  weight_g integer,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (ml_item_id)
);

GRANT SELECT ON public.ml_dimension_fixes TO authenticated;
GRANT ALL ON public.ml_dimension_fixes TO service_role;

ALTER TABLE public.ml_dimension_fixes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve suas correcoes de medidas"
ON public.ml_dimension_fixes FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS ml_dimension_fixes_status_idx ON public.ml_dimension_fixes (status, created_at);
CREATE INDEX IF NOT EXISTS user_publications_dimensions_idx ON public.user_publications (dimensions_ok) WHERE status = 'active';