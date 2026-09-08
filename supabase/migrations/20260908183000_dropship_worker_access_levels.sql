ALTER TABLE public.dropship_worker_settings
  ADD COLUMN IF NOT EXISTS access_levels text[] NOT NULL DEFAULT ARRAY['gratis', 'base', 'pro', 'business', 'admin'];

UPDATE public.dropship_worker_settings
SET access_levels = CASE
  WHEN audience = 'admin' THEN ARRAY['admin']
  ELSE ARRAY['gratis', 'base', 'pro', 'business', 'admin']
END
WHERE access_levels = ARRAY['gratis', 'base', 'pro', 'business', 'admin']
   OR access_levels IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dropship_worker_settings_access_levels_valid'
      AND conrelid = 'public.dropship_worker_settings'::regclass
  ) THEN
    ALTER TABLE public.dropship_worker_settings
      ADD CONSTRAINT dropship_worker_settings_access_levels_valid
      CHECK (access_levels <@ ARRAY['gratis', 'base', 'pro', 'business', 'admin']::text[]);
  END IF;
END $$;
