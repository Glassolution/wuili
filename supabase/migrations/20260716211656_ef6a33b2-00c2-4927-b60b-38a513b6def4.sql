CREATE OR REPLACE FUNCTION public.get_public_store_products(p_ids uuid[])
RETURNS TABLE(
  id uuid,
  source text,
  external_id text,
  title text,
  description text,
  images jsonb,
  suggested_price numeric,
  original_price numeric,
  category text,
  supplier_name text,
  stock_quantity integer,
  is_active boolean,
  is_blocked boolean,
  product_url text,
  brand text,
  model text,
  weight numeric,
  variants jsonb,
  rating numeric,
  orders_count integer,
  reviews_count integer,
  scraped_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cp.id,
    cp.source,
    cp.external_id,
    cp.title,
    cp.description,
    cp.images,
    cp.suggested_price,
    cp.original_price,
    cp.category,
    cp.supplier_name,
    cp.stock_quantity,
    cp.is_active,
    cp.is_blocked,
    cp.product_url,
    cp.brand,
    cp.model,
    cp.weight,
    cp.variants,
    cp.rating,
    cp.orders_count,
    cp.reviews_count,
    cp.scraped_at,
    cp.created_at,
    cp.updated_at
  FROM public.catalog_products cp
  WHERE cp.id = ANY(p_ids)
    AND cp.is_active = true
    AND cp.is_blocked = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_store_products(uuid[]) TO anon, authenticated, service_role;