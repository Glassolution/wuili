CREATE OR REPLACE FUNCTION public.get_trending_products(niche text DEFAULT NULL::text, period text DEFAULT 'week'::text, sort_by text DEFAULT 'score'::text, page integer DEFAULT 1, page_size integer DEFAULT 20)
 RETURNS TABLE(id uuid, title text, image text, images jsonb, category text, brand text, suggested_price numeric, cost_price numeric, original_price numeric, margin_percent numeric, rating numeric, orders_count integer, stock_quantity integer, scraped_at timestamp with time zone, demand_score numeric, margin_score numeric, ease_score numeric, viral_score numeric, score numeric, total_count bigint)
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
  v_real_count int;
BEGIN
  v_recency_days := CASE v_period
    WHEN 'today' THEN 1 WHEN 'day' THEN 1
    WHEN 'week' THEN 7 WHEN 'month' THEN 30
    ELSE 7 END;

  SELECT COUNT(*) INTO v_real_count FROM public.trending_products_real
    WHERE match_confidence IN ('alto','medio');

  IF v_real_count > 0 THEN
    RETURN QUERY
    WITH base AS (
      SELECT
        t.id, t.title, t.image, t.images, t.category, t.brand,
        t.sell_price_brl AS suggested_price,
        t.cost_price_brl AS cost_price,
        NULL::numeric   AS original_price,
        t.margin_percent,
        t.rating,
        COALESCE(t.sold_quantity_month_estimate, 0) AS orders_count,
        100::int AS stock_quantity,
        t.updated_at AS scraped_at,
        LEAST(1.0, LN(1 + GREATEST(COALESCE(t.sold_quantity_month_estimate,0),0)::numeric) / LN(1000))::numeric AS demand_n,
        LEAST(1.0, GREATEST(COALESCE(t.margin_percent,0),0)::numeric / 100.0)::numeric AS margin_n,
        LEAST(1.0, GREATEST(COALESCE(t.rating,0),0)::numeric / 5.0)::numeric AS ease_n,
        GREATEST(0.0,
          1.0 - (EXTRACT(EPOCH FROM (now() - COALESCE(t.updated_at, t.created_at))) / (v_recency_days * 86400.0))
        )::numeric AS viral_n
      FROM public.trending_products_real t
      WHERE (niche IS NULL OR niche = '' OR niche = 'todos' OR LOWER(t.category) = LOWER(niche))
        AND t.match_confidence IN ('alto','medio')
    ),
    scored AS (
      SELECT b.*, (b.demand_n*0.40 + b.margin_n*0.25 + b.ease_n*0.20 + b.viral_n*0.15)::numeric AS composite
      FROM base b
    ),
    counted AS ( SELECT s.*, COUNT(*) OVER () AS total FROM scored s )
    SELECT
      c.id, c.title, c.image, c.images, c.category, c.brand,
      c.suggested_price, c.cost_price, c.original_price,
      c.margin_percent, c.rating, c.orders_count, c.stock_quantity, c.scraped_at,
      ROUND(c.demand_n,4), ROUND(c.margin_n,4), ROUND(c.ease_n,4), ROUND(c.viral_n,4),
      ROUND(c.composite,4), c.total
    FROM counted c
    ORDER BY
      CASE WHEN v_sort='demand' THEN c.demand_n END DESC NULLS LAST,
      CASE WHEN v_sort='margin' THEN c.margin_n END DESC NULLS LAST,
      CASE WHEN v_sort='rating' THEN c.ease_n END DESC NULLS LAST,
      CASE WHEN v_sort='recent' THEN c.viral_n END DESC NULLS LAST,
      CASE WHEN v_sort='price_asc' THEN c.suggested_price END ASC NULLS LAST,
      CASE WHEN v_sort='price_desc' THEN c.suggested_price END DESC NULLS LAST,
      CASE WHEN v_sort NOT IN ('demand','margin','rating','recent','price_asc','price_desc')
           THEN c.composite END DESC NULLS LAST,
      c.orders_count DESC NULLS LAST, c.id
    LIMIT v_size OFFSET v_offset;
    RETURN;
  END IF;

  -- Fallback: use catalog_products while trending_products_real is being populated
  RETURN QUERY
  WITH base AS (
    SELECT
      t.id, t.title,
      COALESCE((t.images->>0)::text, '') AS image,
      COALESCE(t.images, '[]'::jsonb) AS images,
      t.category, t.brand,
      t.suggested_price,
      t.cost_price,
      NULLIF(t.original_price, 0) AS original_price,
      t.margin_percent,
      COALESCE(t.rating, 0)::numeric AS rating,
      COALESCE(t.orders_count, 0) AS orders_count,
      COALESCE(t.stock_quantity, 100) AS stock_quantity,
      COALESCE(t.scraped_at, t.updated_at, t.created_at) AS scraped_at,
      LEAST(1.0, LN(1 + GREATEST(COALESCE(t.orders_count,0),0)::numeric) / LN(1000))::numeric AS demand_n,
      LEAST(1.0, GREATEST(COALESCE(t.margin_percent,0),0)::numeric / 100.0)::numeric AS margin_n,
      LEAST(1.0, GREATEST(COALESCE(t.rating,0),0)::numeric / 5.0)::numeric AS ease_n,
      GREATEST(0.0,
        1.0 - (EXTRACT(EPOCH FROM (now() - COALESCE(t.scraped_at, t.updated_at, t.created_at))) / (v_recency_days * 86400.0))
      )::numeric AS viral_n
    FROM public.catalog_products t
    WHERE t.is_blocked = false
      AND t.is_active = true
      AND (niche IS NULL OR niche = '' OR niche = 'todos' OR LOWER(t.category) = LOWER(niche))
  ),
  scored AS (
    SELECT b.*, (b.demand_n*0.40 + b.margin_n*0.25 + b.ease_n*0.20 + b.viral_n*0.15)::numeric AS composite
    FROM base b
  ),
  counted AS ( SELECT s.*, COUNT(*) OVER () AS total FROM scored s )
  SELECT
    c.id, c.title, c.image, c.images, c.category, c.brand,
    c.suggested_price, c.cost_price, c.original_price,
    c.margin_percent, c.rating, c.orders_count, c.stock_quantity, c.scraped_at,
    ROUND(c.demand_n,4), ROUND(c.margin_n,4), ROUND(c.ease_n,4), ROUND(c.viral_n,4),
    ROUND(c.composite,4), c.total
  FROM counted c
  ORDER BY
    CASE WHEN v_sort='demand' THEN c.demand_n END DESC NULLS LAST,
    CASE WHEN v_sort='margin' THEN c.margin_n END DESC NULLS LAST,
    CASE WHEN v_sort='rating' THEN c.ease_n END DESC NULLS LAST,
    CASE WHEN v_sort='recent' THEN c.viral_n END DESC NULLS LAST,
    CASE WHEN v_sort='price_asc' THEN c.suggested_price END ASC NULLS LAST,
    CASE WHEN v_sort='price_desc' THEN c.suggested_price END DESC NULLS LAST,
    CASE WHEN v_sort NOT IN ('demand','margin','rating','recent','price_asc','price_desc')
         THEN c.composite END DESC NULLS LAST,
    c.orders_count DESC NULLS LAST, c.id
  LIMIT v_size OFFSET v_offset;
END;
$function$;