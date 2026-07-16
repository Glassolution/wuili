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

REVOKE ALL ON FUNCTION public.get_public_store_products(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_store_products(uuid[]) TO anon, authenticated, service_role;