
CREATE OR REPLACE FUNCTION public.get_trending_products(
  niche text DEFAULT NULL,
  period text DEFAULT 'week',
  sort_by text DEFAULT 'score',
  page int DEFAULT 1,
  page_size int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  title text,
  image text,
  images jsonb,
  category text,
  brand text,
  suggested_price numeric,
  cost_price numeric,
  original_price numeric,
  margin_percent numeric,
  rating numeric,
  orders_count integer,
  stock_quantity integer,
  scraped_at timestamptz,
  demand_score numeric,
  margin_score numeric,
  ease_score numeric,
  viral_score numeric,
  score numeric,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page int := GREATEST(COALESCE(page, 1), 1);
  v_size int := LEAST(GREATEST(COALESCE(page_size, 20), 1), 100);
  v_offset int := (v_page - 1) * v_size;
  v_period text := LOWER(COALESCE(period, 'week'));
  v_sort text := LOWER(COALESCE(sort_by, 'score'));
  v_recency_days int;
BEGIN
  v_recency_days := CASE v_period
    WHEN 'today' THEN 1
    WHEN 'day' THEN 1
    WHEN 'week' THEN 7
    WHEN 'month' THEN 30
    ELSE 7
  END;

  RETURN QUERY
  WITH base AS (
    SELECT
      cp.id, cp.title,
      COALESCE((cp.images->>0), NULL) AS image,
      cp.images, cp.category, cp.brand,
      cp.suggested_price, cp.cost_price, cp.original_price,
      cp.margin_percent, cp.rating, cp.orders_count, cp.stock_quantity,
      cp.scraped_at,
      -- Normalized components (0..1-ish)
      LEAST(1.0, LN(1 + GREATEST(COALESCE(cp.orders_count, 0), 0)::numeric) / LN(1000))::numeric AS demand_n,
      LEAST(1.0, GREATEST(COALESCE(cp.margin_percent, 0), 0)::numeric / 100.0)::numeric AS margin_n,
      LEAST(1.0, GREATEST(COALESCE(cp.rating, 0), 0)::numeric / 5.0)::numeric AS ease_n,
      -- Viralization: recency boost within the period window (uses scraped_at as freshness proxy;
      -- catalog_products has no per-day sales, so this is a static-score approximation).
      GREATEST(
        0.0,
        1.0 - (EXTRACT(EPOCH FROM (now() - COALESCE(cp.scraped_at, cp.updated_at, cp.created_at))) / (v_recency_days * 86400.0))
      )::numeric AS viral_n
    FROM public.catalog_products cp
    WHERE cp.is_active = true
      AND cp.is_blocked = false
      AND COALESCE(cp.stock_quantity, 0) > 0
      AND (niche IS NULL OR niche = '' OR niche = 'todos' OR LOWER(cp.category) = LOWER(niche))
  ),
  scored AS (
    SELECT
      b.*,
      (b.demand_n * 0.40 + b.margin_n * 0.25 + b.ease_n * 0.20 + b.viral_n * 0.15)::numeric AS composite
    FROM base b
  ),
  counted AS (
    SELECT s.*, COUNT(*) OVER () AS total FROM scored s
  )
  SELECT
    c.id, c.title, c.image, c.images, c.category, c.brand,
    c.suggested_price, c.cost_price, c.original_price,
    c.margin_percent, c.rating, c.orders_count, c.stock_quantity, c.scraped_at,
    ROUND(c.demand_n, 4) AS demand_score,
    ROUND(c.margin_n, 4) AS margin_score,
    ROUND(c.ease_n,   4) AS ease_score,
    ROUND(c.viral_n,  4) AS viral_score,
    ROUND(c.composite,4) AS score,
    c.total AS total_count
  FROM counted c
  ORDER BY
    CASE WHEN v_sort = 'demand'     THEN c.demand_n     END DESC NULLS LAST,
    CASE WHEN v_sort = 'margin'     THEN c.margin_n     END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating'     THEN c.ease_n       END DESC NULLS LAST,
    CASE WHEN v_sort = 'recent'     THEN c.viral_n      END DESC NULLS LAST,
    CASE WHEN v_sort = 'price_asc'  THEN c.suggested_price END ASC  NULLS LAST,
    CASE WHEN v_sort = 'price_desc' THEN c.suggested_price END DESC NULLS LAST,
    CASE WHEN v_sort NOT IN ('demand','margin','rating','recent','price_asc','price_desc')
         THEN c.composite END DESC NULLS LAST,
    c.orders_count DESC NULLS LAST,
    c.id
  LIMIT v_size OFFSET v_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_trending_products(text, text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trending_products(text, text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_trending_products(text, text, text, int, int) TO service_role;
