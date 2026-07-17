
-- Fase 1: unificação de páginas de vendas legadas → user_projects.metadata.copy

-- 1) Backfill: cria user_projects para páginas legadas sem par.
INSERT INTO public.user_projects (
  user_id, tipo_projeto, status, nome, source_kind, source_id, metadata,
  published_at, created_at, updated_at, last_edited_at
)
SELECT
  g.user_id,
  'pagina_venda',
  CASE WHEN g.published THEN 'publicado' ELSE 'rascunho' END,
  COALESCE(NULLIF(g.product_title, ''), NULLIF(g.headline, ''), 'Página de venda'),
  'generated_sales_page',
  g.id,
  jsonb_build_object(
    'template', 'produto-1',
    'slug', g.slug,
    'productIds',
      CASE WHEN g.catalog_product_id IS NOT NULL
           THEN jsonb_build_array(g.catalog_product_id::text)
           ELSE '[]'::jsonb END,
    'catalog_product_id', g.catalog_product_id,
    'price_brl', g.price_brl,
    'visibility', 'publico',
    'storeName', COALESCE(NULLIF(g.store_name, ''), NULLIF(g.product_title, '')),
    'logoImage', g.store_logo_url,
    'copy', jsonb_build_object(
      'headline', g.headline,
      'subheadline', g.subheadline,
      'benefits', COALESCE(g.benefits, '[]'::jsonb),
      'testimonials', COALESCE(g.testimonials, '[]'::jsonb),
      'cta_text', g.cta_text,
      'hero_image_url', g.hero_image_url,
      'price_brl', g.price_brl,
      'product_title', g.product_title,
      'store_name', g.store_name,
      'store_logo_url', g.store_logo_url,
      'store_description', g.store_description
    )
  ),
  g.published_at,
  g.created_at,
  g.updated_at,
  g.updated_at
FROM public.generated_sales_pages g
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_projects up
  WHERE up.source_kind = 'generated_sales_page'
    AND up.source_id = g.id
);

-- 2) Para pares que já existiam (backfill original semeou só slug/preço/produto),
--    garante que metadata.copy também esteja preenchido.
UPDATE public.user_projects up
SET metadata = COALESCE(up.metadata, '{}'::jsonb)
    || jsonb_build_object(
         'copy', jsonb_build_object(
           'headline', g.headline,
           'subheadline', g.subheadline,
           'benefits', COALESCE(g.benefits, '[]'::jsonb),
           'testimonials', COALESCE(g.testimonials, '[]'::jsonb),
           'cta_text', g.cta_text,
           'hero_image_url', g.hero_image_url,
           'price_brl', g.price_brl,
           'product_title', g.product_title,
           'store_name', g.store_name,
           'store_logo_url', g.store_logo_url,
           'store_description', g.store_description
         )
       ),
    updated_at = now()
FROM public.generated_sales_pages g
WHERE up.source_kind = 'generated_sales_page'
  AND up.source_id = g.id
  AND NOT (COALESCE(up.metadata, '{}'::jsonb) ? 'copy');

-- 3) Deprecação da tabela legada (soft — não deletar).
COMMENT ON TABLE public.generated_sales_pages IS
  'DEPRECATED (Fase 1 unification, 2026-07-17). Não escrever nesta tabela. Fonte de verdade: public.user_projects com source_kind=''generated_sales_page''; campos de copy vivem em metadata.copy. Leituras históricas continuam funcionando; tabela mantida intacta por segurança.';

-- 4) Decisão explícita sobre FK polimórfico.
COMMENT ON COLUMN public.user_projects.source_id IS
  'Referência polimórfica: aponta para generated_sales_pages.id quando source_kind=''generated_sales_page'' ou para profiles.id quando source_kind=''profile_store''. Sem FK dura porque o alvo depende de source_kind (Postgres não suporta FK condicional). Unicidade garantida por idx_user_projects_source_unique(source_kind, source_id).';
