ALTER TABLE public.user_publications ADD COLUMN IF NOT EXISTS family_name text;

CREATE INDEX IF NOT EXISTS idx_user_publications_family
  ON public.user_publications (user_id, family_name)
  WHERE family_name IS NOT NULL;