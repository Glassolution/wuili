CREATE OR REPLACE FUNCTION public.get_trending_products(
  niche text DEFAULT NULL,
  period text DEFAULT 'week',
  sort_by text DEFAULT 'score',
  page integer DEFAULT 1,
  page_size integer DEFAULT 20
)
RETURNS TABLE(
  id uuid, title text, image text, images jsonb, category text, brand text,
  suggested_price numeric, cost_price numeric, original_price numeric,
  margin_percent numeric, rating numeric, orders_count integer, stock_quantity integer,
  scraped_at timestamptz,
  demand_score numeric, margin_score numeric, ease_score numeric, viral_score numeric,
  score numeric,
  velo_orders_count integer, velo_units_sold integer, velo_revenue numeric,
  velo_publications_count integer, velo_recent_orders integer,
  external_sales integer,
  total_count bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_page int := GREATEST(COALESCE(page, 1), 1);
  v_size int := LEAST(GREATEST(COALESCE(page_size, 20), 1), 100);
  v_offset int := (v_page - 1) * v_size;
  v_period text := LOWER(COALESCE(period, 'week'));
  v_sort text := LOWER(COALESCE(sort_by, 'score'));
  v_recency_days int;
BEGIN
  v_recency_days := CASE v_period
    WHEN 'today' THEN 1 WHEN 'day' THEN 1
    WHEN 'week' THEN 7 WHEN 'month' THEN 30
    ELSE 7 END;

  RETURN QUERY
  WITH internal AS (
    SELECT
      o.catalog_product_id AS pid,
      COUNT(*)::int AS orders_cnt,
      COALESCE(SUM(GREATEST(o.quantity, 1)), 0)::int AS units,
      COALESCE(SUM(COALESCE(o.sale_price, 0) * GREATEST(o.quantity, 1)), 0)::numeric AS revenue,
      COUNT(*) FILTER (WHERE COALESCE(o.ordered_at, o.created_at) > now() - make_interval(days => 30))::int AS recent_cnt
    FROM public.orders o
    WHERE o.catalog_product_id IS NOT NULL
      AND LOWER(COALESCE(o.status, '')) NOT IN ('cancelled', 'canceled', 'refunded', 'chargeback')
    GROUP BY o.catalog_product_id
  ),
  pubs AS (
    SELECT
      up.catalog_product_id::uuid AS pid,
      COUNT(DISTINCT up.user_id)::int AS pub_cnt
    FROM public.user_publications up
    WHERE up.catalog_product_id ~ '^[0-9a-fA-F-]{36}$'
    GROUP BY up.catalog_product_id::uuid
  ),
  ext AS (
    SELECT
      LOWER(BTRIM(t.title)) AS key_title,
      MAX(COALESCE(t.sold_quantity_month_estimate, 0))::int AS ext_sales
    FROM public.trending_products_real t
    WHERE t.match_confidence IN ('alto', 'medio')
    GROUP BY LOWER(BTRIM(t.title))
  ),
  base AS (
    SELECT
      c.id, c.title,
      COALESCE((c.images->>0)::text, '') AS image,
      COALESCE(c.images, '[]'::jsonb) AS images,
      c.category, c.brand,
      c.suggested_price,
      c.cost_price,
      NULLIF(c.original_price, 0) AS original_price,
      c.margin_percent,
      COALESCE(c.rating, 0)::numeric AS rating,
      COALESCE(c.stock_quantity, 100) AS stock_quantity,
      COALESCE(c.scraped_at, c.updated_at, c.created_at) AS scraped_at,
      COALESCE(i.orders_cnt, 0) AS v_orders,
      COALESCE(i.units, 0) AS v_units,
      COALESCE(i.revenue, 0)::numeric AS v_revenue,
      COALESCE(i.recent_cnt, 0) AS v_recent,
      COALESCE(p.pub_cnt, 0) AS v_pubs,
      COALESCE(e.ext_sales, COALESCE(c.orders_count, 0)) AS ext_sales
    FROM public.catalog_products c
    LEFT JOIN internal i ON i.pid = c.id
    LEFT JOIN pubs p ON p.pid = c.id
    LEFT JOIN ext e ON e.key_title = LOWER(BTRIM(c.title))
    WHERE c.is_blocked = false
      AND c.is_active = true
      AND COALESCE(c.stock_quantity, 100) > 0
      AND (niche IS NULL OR niche = '' OR niche = 'todos' OR LOWER(c.category) = LOWER(niche))
  ),
  scored AS (
    SELECT
      b.*,
      LEAST(1.0, LN(1 + b.v_units::numeric) / LN(50))::numeric AS velo_demand_n,
      LEAST(1.0, LN(1 + b.v_pubs::numeric) / LN(25))::numeric AS velo_adoption_n,
      LEAST(1.0, LN(1 + GREATEST(b.ext_sales, 0)::numeric) / LN(1000))::numeric AS ext_n,
      LEAST(1.0, GREATEST(COALESCE(b.margin_percent, 0), 0)::numeric / 100.0)::numeric AS margin_n,
      LEAST(1.0, GREATEST(b.rating, 0) / 5.0)::numeric AS ease_n,
      GREATEST(0.0,
        1.0 - (EXTRACT(EPOCH FROM (now() - b.scraped_at)) / (v_recency_days * 86400.0))
      )::numeric AS viral_n
    FROM base b
  ),
  composed AS (
    SELECT
      s.*,
      (s.velo_demand_n * 0.45
        + s.velo_adoption_n * 0.15
        + s.ext_n * 0.15
        + s.margin_n * 0.15
        + s.ease_n * 0.10)::numeric AS composite,
      (CASE WHEN s.v_units > 0 THEN s.v_units ELSE s.ext_sales END)::int AS total_sales
    FROM scored s
  ),
  counted AS (SELECT c.*, COUNT(*) OVER () AS total FROM composed c)
  SELECT
    c.id, c.title, c.image, c.images, c.category, c.brand,
    c.suggested_price, c.cost_price, c.original_price,
    c.margin_percent, c.rating,
    c.total_sales AS orders_count,
    c.stock_quantity, c.scraped_at,
    ROUND(GREATEST(c.velo_demand_n, c.ext_n * 0.5), 4),
    ROUND(c.margin_n, 4), ROUND(c.ease_n, 4), ROUND(c.viral_n, 4),
    ROUND(c.composite, 4),
    c.v_orders::int, c.v_units::int, ROUND(c.v_revenue, 2), c.v_pubs::int, c.v_recent::int,
    c.ext_sales::int,
    c.total
  FROM counted c
  ORDER BY
    CASE WHEN v_sort = 'demand' THEN c.total_sales END DESC NULLS LAST,
    CASE WHEN v_sort = 'demand' THEN c.v_units END DESC NULLS LAST,
    CASE WHEN v_sort = 'margin' THEN c.margin_n END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating' THEN c.ease_n END DESC NULLS LAST,
    CASE WHEN v_sort = 'recent' THEN c.viral_n END DESC NULLS LAST,
    CASE WHEN v_sort = 'price_asc' THEN c.suggested_price END ASC NULLS LAST,
    CASE WHEN v_sort = 'price_desc' THEN c.suggested_price END DESC NULLS LAST,
    CASE WHEN v_sort NOT IN ('demand','margin','rating','recent','price_asc','price_desc')
         THEN c.composite END DESC NULLS LAST,
    c.v_units DESC NULLS LAST, c.ext_sales DESC NULLS LAST, c.id
  LIMIT v_size OFFSET v_offset;
END;
$function$;