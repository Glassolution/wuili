CREATE TABLE public.user_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo_projeto text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho',
  nome text NOT NULL DEFAULT 'Projeto sem nome',
  preview_url text,
  preview_storage_path text,
  source_kind text,
  source_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_edited_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_projects_tipo_projeto_check
    CHECK (tipo_projeto IN ('loja_completa', 'pagina_venda')),
  CONSTRAINT user_projects_status_check
    CHECK (status IN ('rascunho', 'publicado')),
  CONSTRAINT user_projects_source_kind_check
    CHECK (
      source_kind IS NULL
      OR source_kind IN ('profile_store', 'generated_sales_page')
    )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_projects TO authenticated;
GRANT ALL ON public.user_projects TO service_role;

ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects" ON public.user_projects
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON public.user_projects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.user_projects
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.user_projects
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_projects_user_last_edited
  ON public.user_projects(user_id, last_edited_at DESC);

CREATE UNIQUE INDEX idx_user_projects_source_unique
  ON public.user_projects(source_kind, source_id)
  WHERE source_kind IS NOT NULL AND source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.update_user_projects_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();

  IF NEW.last_edited_at IS NULL OR NEW.last_edited_at = OLD.last_edited_at THEN
    NEW.last_edited_at = NEW.updated_at;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_projects_updated_at
  BEFORE UPDATE ON public.user_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_user_projects_timestamps();

CREATE OR REPLACE FUNCTION public.get_user_projects()
RETURNS SETOF public.user_projects
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_projects
  WHERE user_id = auth.uid()
  ORDER BY last_edited_at DESC, updated_at DESC, created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_user_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_projects() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_projects() TO service_role;

INSERT INTO public.user_projects (
  user_id,
  tipo_projeto,
  status,
  nome,
  preview_url,
  source_kind,
  source_id,
  metadata,
  published_at,
  created_at,
  updated_at,
  last_edited_at
)
SELECT
  user_id,
  'pagina_venda',
  CASE WHEN published THEN 'publicado' ELSE 'rascunho' END,
  COALESCE(product_title, headline, 'Página de venda'),
  hero_image_url,
  'generated_sales_page',
  id,
  jsonb_build_object(
    'catalog_product_id', catalog_product_id,
    'slug', slug,
    'price_brl', price_brl
  ),
  published_at,
  created_at,
  updated_at,
  updated_at
FROM public.generated_sales_pages
ON CONFLICT DO NOTHING;

INSERT INTO public.user_projects (
  user_id,
  tipo_projeto,
  status,
  nome,
  source_kind,
  source_id,
  metadata,
  created_at,
  updated_at,
  last_edited_at
)
SELECT
  user_id,
  'loja_completa',
  CASE WHEN onboarding_completed THEN 'publicado' ELSE 'rascunho' END,
  COALESCE(store_name, loja_nome, display_name, 'Minha loja'),
  'profile_store',
  id,
  jsonb_build_object(
    'store_name', store_name,
    'loja_nome', loja_nome,
    'onboarding_completed', onboarding_completed
  ),
  created_at,
  updated_at,
  updated_at
FROM public.profiles
WHERE store_name IS NOT NULL
   OR loja_nome IS NOT NULL
   OR onboarding_completed = true
ON CONFLICT DO NOTHING;
