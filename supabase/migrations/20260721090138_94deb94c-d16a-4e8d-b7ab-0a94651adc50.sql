ALTER TABLE public.catalog_products
  ADD COLUMN IF NOT EXISTS ml_category_id text,
  ADD COLUMN IF NOT EXISTS ml_category_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ml_size_grid_id text;

ALTER TABLE public.catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_ml_category_status_check;
ALTER TABLE public.catalog_products
  ADD CONSTRAINT catalog_products_ml_category_status_check
  CHECK (ml_category_status IN ('pending','auto','needs_manual','manual'));

CREATE INDEX IF NOT EXISTS idx_catalog_products_ml_category_status
  ON public.catalog_products (ml_category_status);

CREATE INDEX IF NOT EXISTS idx_catalog_products_ml_category_id
  ON public.catalog_products (ml_category_id);

-- Telemetry table for post-deploy prediction logging (30d retention)
CREATE TABLE IF NOT EXISTS public.ml_category_prediction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid,
  user_id uuid,
  title_raw text,
  title_normalized text,
  predicted_raw text,
  predicted_normalized text,
  final_category text,
  final_status text,
  requires_size_grid boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ml_category_prediction_log TO authenticated;
GRANT ALL ON public.ml_category_prediction_log TO service_role;

ALTER TABLE public.ml_category_prediction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read prediction log"
  ON public.ml_category_prediction_log
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ml_prediction_log_created
  ON public.ml_category_prediction_log (created_at DESC);

-- View for quick 30d aggregation
CREATE OR REPLACE VIEW public.v_ml_category_predictions_last_30d AS
SELECT
  final_category,
  final_status,
  requires_size_grid,
  count(*) AS occurrences,
  max(created_at) AS last_seen
FROM public.ml_category_prediction_log
WHERE created_at >= now() - interval '30 days'
GROUP BY final_category, final_status, requires_size_grid
ORDER BY occurrences DESC;

GRANT SELECT ON public.v_ml_category_predictions_last_30d TO authenticated;