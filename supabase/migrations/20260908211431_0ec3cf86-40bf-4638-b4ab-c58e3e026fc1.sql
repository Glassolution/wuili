ALTER TABLE public.dropship_worker_settings
  ADD COLUMN IF NOT EXISTS access_levels text[] NOT NULL DEFAULT ARRAY['gratis','base','pro','business','admin']::text[];

ALTER TABLE public.dropship_worker_settings
  DROP CONSTRAINT IF EXISTS dropship_worker_settings_access_levels_valid;

ALTER TABLE public.dropship_worker_settings
  ADD CONSTRAINT dropship_worker_settings_access_levels_valid
  CHECK (access_levels <@ ARRAY['gratis','base','pro','business','admin']::text[]);

UPDATE public.dropship_worker_settings
  SET access_levels = ARRAY['gratis','base','pro','business','admin']::text[]
  WHERE access_levels IS NULL OR array_length(access_levels, 1) IS NULL;