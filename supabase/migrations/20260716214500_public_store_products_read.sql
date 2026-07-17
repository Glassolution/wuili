-- Endurece a get_public_store_products criada em 20260716211656.
--
-- A versão anterior expunha, para QUALQUER visitante anônimo, as colunas
-- source, external_id, supplier_name e product_url. Isso entrega ao cliente
-- final (e ao concorrente) de qual fornecedor o lojista compra e o link direto
-- para o produto na loja dele — o cliente compra na origem e o lojista perde a
-- venda. Para dropshipping esse vazamento é tão grave quanto expor o custo.
--
-- Também faltava o filtro de estoque: produtos com stock_quantity = 0 eram
-- exibidos na loja publicada, contrariando a regra do projeto de nunca mostrar
-- produto sem estoque.
--
-- DROP explícito antes do CREATE: a assinatura muda (menos colunas no RETURNS
-- TABLE) e CREATE OR REPLACE não consegue alterar o tipo de retorno.
DROP FUNCTION IF EXISTS public.get_public_store_products(uuid[]);

CREATE FUNCTION public.get_public_store_products(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  images jsonb,
  suggested_price numeric,
  original_price numeric,
  category text,
  variants jsonb,
  brand text,
  model text,
  rating numeric,
  reviews_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sem productIds (projetos anteriores ao wizard): mantém o comportamento
  -- histórico de mostrar os mais vendidos do catálogo.
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN QUERY
      SELECT
        cp.id, cp.title, cp.description, cp.images, cp.suggested_price,
        NULLIF(cp.original_price, 0), cp.category, cp.variants,
        cp.brand, cp.model, cp.rating, cp.reviews_count
      FROM public.catalog_products cp
      WHERE cp.source = 'c7drop'
        AND cp.is_active
        AND NOT cp.is_blocked
        AND COALESCE(cp.stock_quantity, 0) > 0
      ORDER BY cp.orders_count DESC NULLS LAST
      LIMIT 12;
  ELSE
    RETURN QUERY
      SELECT
        cp.id, cp.title, cp.description, cp.images, cp.suggested_price,
        -- original_price tem DEFAULT 0; normaliza para NULL e a vitrine omite o
        -- preço riscado em vez de exibir "de R$ 0,00".
        NULLIF(cp.original_price, 0), cp.category, cp.variants,
        cp.brand, cp.model, cp.rating, cp.reviews_count
      FROM public.catalog_products cp
      WHERE cp.id = ANY(p_ids)
        AND cp.is_active
        AND NOT cp.is_blocked
        AND COALESCE(cp.stock_quantity, 0) > 0;
  END IF;
END;
$$;

-- Funções nascem com EXECUTE para PUBLIC; revoga antes de conceder aos papéis.
REVOKE ALL ON FUNCTION public.get_public_store_products(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store_products(uuid[]) TO anon, authenticated, service_role;
