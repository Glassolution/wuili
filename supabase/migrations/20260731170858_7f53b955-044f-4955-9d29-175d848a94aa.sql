CREATE TABLE public.ai_product_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  source_url text,
  language text NOT NULL DEFAULT 'pt-BR',
  image_count smallint CHECK (image_count IS NULL OR (image_count >= 0 AND image_count <= 6)),
  provider text NOT NULL DEFAULT 'pagepilot',
  provider_page_id text,
  status text NOT NULL DEFAULT 'gerando' CHECK (status IN ('gerando','pronto','erro')),
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, DELETE ON public.ai_product_pages TO authenticated;
GRANT ALL ON public.ai_product_pages TO service_role;

ALTER TABLE public.ai_product_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ai pages"
  ON public.ai_product_pages FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ai pages"
  ON public.ai_product_pages FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages ai pages"
  ON public.ai_product_pages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX idx_ai_product_pages_user_created
  ON public.ai_product_pages (user_id, created_at DESC);

CREATE TRIGGER update_ai_product_pages_updated_at
  BEFORE UPDATE ON public.ai_product_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();