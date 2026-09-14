CREATE TABLE IF NOT EXISTS public.store_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.user_projects(id) ON DELETE CASCADE,
  product_id uuid,
  author_name text NOT NULL CHECK (char_length(btrim(author_name)) BETWEEN 2 AND 60),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(btrim(comment)) BETWEEN 3 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS store_reviews_project_created_idx
  ON public.store_reviews (project_id, created_at DESC);

GRANT SELECT, INSERT ON public.store_reviews TO anon;
GRANT SELECT, INSERT, DELETE ON public.store_reviews TO authenticated;
GRANT ALL ON public.store_reviews TO service_role;

ALTER TABLE public.store_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_reviews_public_read" ON public.store_reviews;
CREATE POLICY "store_reviews_public_read"
  ON public.store_reviews FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "store_reviews_public_insert" ON public.store_reviews;
CREATE POLICY "store_reviews_public_insert"
  ON public.store_reviews FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "store_reviews_owner_delete" ON public.store_reviews;
CREATE POLICY "store_reviews_owner_delete"
  ON public.store_reviews FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_projects p WHERE p.id = project_id AND p.user_id = auth.uid()));