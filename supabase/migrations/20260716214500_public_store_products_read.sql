-- Leitura pública dos produtos de uma loja publicada (/loja/:slug).
--
-- Sem isso o visitante deslogado recebe "permission denied for table
-- catalog_products" (o RLS do catálogo só atende usuários autenticados), o
-- template cai nos fallbacks e a loja publicada aparece sem título de produto,
-- sem preço e sem imagem.
--
-- SECURITY DEFINER contorna o RLS, mas a função expõe SOMENTE as colunas que a
-- vitrine precisa. cost_price fica de fora de propósito: é o custo de
-- fornecedor do lojista e não pode vazar para o cliente final/concorrente.
CREATE OR REPLACE FUNCTION public.get_public_store_products(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  title text,
  suggested_price numeric,
  original_price numeric,
  images jsonb,
  category text,
  variants jsonb,
  description text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sem productIds (projetos antigos, anteriores ao wizard): mantém o
  -- comportamento anterior de mostrar os mais vendidos do catálogo.
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN QUERY
      SELECT
        p.id,
        p.title,
        p.suggested_price,
        NULLIF(p.original_price, 0),
        p.images,
        p.category,
        p.variants,
        p.description
      FROM public.catalog_products p
      WHERE p.source = 'c7drop'
        AND p.is_active
        AND NOT p.is_blocked
        AND COALESCE(p.stock_quantity, 0) > 0
      ORDER BY p.orders_count DESC NULLS LAST
      LIMIT 12;
  ELSE
    RETURN QUERY
      SELECT
        p.id,
        p.title,
        p.suggested_price,
        -- original_price tem DEFAULT 0 e só é preenchido quando o fornecedor
        -- pratica desconto real. Normaliza 0 -> NULL para a vitrine omitir o
        -- preço riscado em vez de exibir "de R$ 0,00".
        NULLIF(p.original_price, 0),
        p.images,
        p.category,
        p.variants,
        p.description
      FROM public.catalog_products p
      WHERE p.id = ANY(p_ids)
        AND p.is_active
        AND NOT p.is_blocked
        AND COALESCE(p.stock_quantity, 0) > 0;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_store_products(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store_products(uuid[]) TO anon, authenticated, service_role;
