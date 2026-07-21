
ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS ml_category_id text,
  ADD COLUMN IF NOT EXISTS ml_size_grid_id text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ml_category_status') THEN
    CREATE TYPE public.ml_category_status AS ENUM ('pending','auto','needs_manual','manual');
  END IF;
END $$;

ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS ml_category_status public.ml_category_status NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS catalog_products_ml_category_status_idx
  ON public.catalog_products(ml_category_status)
  WHERE ml_category_status = 'needs_manual';

CREATE TABLE IF NOT EXISTS public.ml_category_prediction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid,
  user_id uuid,
  title_raw text NOT NULL,
  title_normalized text,
  predicted_raw text,
  predicted_normalized text,
  final_category text,
  final_status public.ml_category_status NOT NULL,
  requires_size_grid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ml_category_prediction_log TO authenticated;
GRANT ALL ON public.ml_category_prediction_log TO service_role;

ALTER TABLE public.ml_category_prediction_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver todo o log" ON public.ml_category_prediction_log;
CREATE POLICY "Admins podem ver todo o log"
  ON public.ml_category_prediction_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Usuário vê seu próprio log" ON public.ml_category_prediction_log;
CREATE POLICY "Usuário vê seu próprio log"
  ON public.ml_category_prediction_log
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP VIEW IF EXISTS public.v_ml_category_predictions_last_30d;
CREATE VIEW public.v_ml_category_predictions_last_30d AS
SELECT
  date_trunc('day', created_at) AS day,
  final_status,
  requires_size_grid,
  count(*) AS total
FROM public.ml_category_prediction_log
WHERE created_at >= now() - interval '30 days'
GROUP BY 1,2,3
ORDER BY 1 DESC;

GRANT SELECT ON public.v_ml_category_predictions_last_30d TO authenticated;
