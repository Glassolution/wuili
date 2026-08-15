CREATE TABLE IF NOT EXISTS public.feature_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 140),
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 1200),
  category text NOT NULL DEFAULT 'geral' CHECK (
    category IN ('geral', 'catalogo', 'paginas_ia', 'integracoes', 'atlas', 'checkout', 'templates')
  ),
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'approved', 'ongoing', 'completed', 'rejected')
  ),
  votes_count integer NOT NULL DEFAULT 0 CHECK (votes_count >= 0),
  comments_count integer NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_suggestions_status_created_idx
  ON public.feature_suggestions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS feature_suggestions_user_created_idx
  ON public.feature_suggestions (user_id, created_at DESC);

ALTER TABLE public.feature_suggestions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_has_base_plan(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.subscriptions s
      WHERE s.user_id = check_user_id
        AND lower(coalesce(s.plan, 'gratis')) IN ('base', 'plus', 'pro', 'business')
        AND lower(coalesce(s.status, '')) IN ('active', 'paid', 'approved', 'trialing')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = check_user_id
        AND lower(coalesce(p.plano, 'gratis')) IN ('base', 'plus', 'pro', 'business')
    );
$$;

DROP POLICY IF EXISTS "feature_suggestions_select_authenticated" ON public.feature_suggestions;
CREATE POLICY "feature_suggestions_select_authenticated"
  ON public.feature_suggestions
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "feature_suggestions_insert_minimum_base" ON public.feature_suggestions;
CREATE POLICY "feature_suggestions_insert_minimum_base"
  ON public.feature_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.user_has_base_plan(auth.uid())
  );

DROP POLICY IF EXISTS "feature_suggestions_update_own_pending" ON public.feature_suggestions;
CREATE POLICY "feature_suggestions_update_own_pending"
  ON public.feature_suggestions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
