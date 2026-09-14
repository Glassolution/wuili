ALTER TABLE public.ml_category_prediction_log
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS low_confidence boolean NOT NULL DEFAULT false;