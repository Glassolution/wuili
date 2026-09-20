ALTER TABLE public.ml_dimension_fixes
  ADD COLUMN IF NOT EXISTS paused_by_velo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS ml_dimension_fixes_next_attempt_idx
  ON public.ml_dimension_fixes (status, next_attempt_at);