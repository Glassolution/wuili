-- Tabela de páginas de vendas geradas
CREATE TABLE public.generated_sales_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  slug text UNIQUE NOT NULL,
  headline text NOT NULL,
  subheadline text,
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  testimonials jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_text text NOT NULL DEFAULT 'Comprar agora',
  hero_image_url text,
  price_brl numeric(10,2),
  product_title text,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_sales_pages TO authenticated;
GRANT SELECT ON public.generated_sales_pages TO anon;
GRANT ALL ON public.generated_sales_pages TO service_role;

ALTER TABLE public.generated_sales_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_full_access" ON public.generated_sales_pages
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "public_read_published" ON public.generated_sales_pages
  FOR SELECT TO anon
  USING (published = true);

CREATE POLICY "auth_read_published" ON public.generated_sales_pages
  FOR SELECT TO authenticated
  USING (published = true OR user_id = auth.uid());

CREATE INDEX idx_gsp_user ON public.generated_sales_pages(user_id);
CREATE INDEX idx_gsp_slug ON public.generated_sales_pages(slug);

CREATE TRIGGER trg_gsp_updated_at
  BEFORE UPDATE ON public.generated_sales_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Novas colunas em profiles para o fluxo
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_niche text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS full_store_upsell_status text CHECK (full_store_upsell_status IN ('shown','accepted','skipped')),
  ADD COLUMN IF NOT EXISTS tutorial_completed boolean NOT NULL DEFAULT false;