
-- =========================================================
-- Trending Products (real data pipeline: ML + AliExpress)
-- =========================================================

CREATE TABLE IF NOT EXISTS public.trending_products_real (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_item_id text UNIQUE NOT NULL,
  ml_permalink text,
  ali_product_id text,
  ali_url text,
  title text NOT NULL,
  image text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text,
  brand text,
  sell_price_brl numeric(12,2),
  ali_cost_usd numeric(12,2),
  cost_price_brl numeric(12,2),
  margin_percent numeric(6,2),
  markup numeric(8,3),
  sold_quantity_total integer DEFAULT 0,
  sold_quantity_month_estimate integer,
  rating numeric(3,2),
  match_confidence text CHECK (match_confidence IN ('alto','medio','baixo')),
  collected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tpr_category ON public.trending_products_real (category);
CREATE INDEX IF NOT EXISTS idx_tpr_sold_total ON public.trending_products_real (sold_quantity_total DESC);
CREATE INDEX IF NOT EXISTS idx_tpr_updated ON public.trending_products_real (updated_at DESC);

GRANT SELECT ON public.trending_products_real TO authenticated;
GRANT ALL ON public.trending_products_real TO service_role;
ALTER TABLE public.trending_products_real ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read trending_products_real"
  ON public.trending_products_real FOR SELECT
  TO authenticated USING (true);

-- staging: low-confidence matches for audit
CREATE TABLE IF NOT EXISTS public.trending_products_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ml_item_id text NOT NULL,
  ml_permalink text,
  ali_product_id text,
  ali_url text,
  title text NOT NULL,
  image text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  category text,
  brand text,
  sell_price_brl numeric(12,2),
  ali_cost_usd numeric(12,2),
  cost_price_brl numeric(12,2),
  margin_percent numeric(6,2),
  markup numeric(8,3),
  sold_quantity_total integer DEFAULT 0,
  rating numeric(3,2),
  match_confidence text,
  similarity_score numeric(5,4),
  reason text,
  collected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.trending_products_staging TO service_role;
ALTER TABLE public.trending_products_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read trending_products_staging"
  ON public.trending_products_staging FOR SELECT
  TO authenticated USING (public.is_admin(auth.uid()));

-- history: daily snapshots
CREATE TABLE IF NOT EXISTS public.trending_products_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trending_product_id uuid NOT NULL REFERENCES public.trending_products_real(id) ON DELETE CASCADE,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  sell_price_brl numeric(12,2),
  sold_quantity_total integer,
  margin_percent numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trending_product_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_tph_product_date
  ON public.trending_products_history (trending_product_id, snapshot_date DESC);

GRANT SELECT ON public.trending_products_history TO authenticated;
GRANT ALL ON public.trending_products_history TO service_role;
ALTER TABLE public.trending_products_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read trending_products_history"
  ON public.trending_products_history FOR SELECT
  TO authenticated USING (true);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_tpr_updated_at ON public.trending_products_real;
CREATE TRIGGER trg_tpr_updated_at
  BEFORE UPDATE ON public.trending_products_real
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Replace get_trending_products to read from the new table
-- Keeps EXACT same signature and return columns.
-- =========================================================
DROP FUNCTION IF EXISTS public.get_trending_products(text, text, text, integer, integer);

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
  margin_percent numeric, rating numeric, orders_count integer,
  stock_quantity integer, scraped_at timestamptz,
  demand_score numeric, margin_score numeric, ease_score numeric,
  viral_score numeric, score numeric, total_count bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
    WHEN 'today' THEN 1 WHEN 'day' THEN 1
    WHEN 'week' THEN 7 WHEN 'month' THEN 30
    ELSE 7 END;

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
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_products(text, text, text, integer, integer)
  TO anon, authenticated, service_role;

-- =========================================================
-- History RPC for future real chart
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_trending_product_history(
  product_id uuid, days integer DEFAULT 30
)
RETURNS TABLE(
  snapshot_date date,
  sell_price_brl numeric,
  sold_quantity_total integer,
  margin_percent numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT h.snapshot_date, h.sell_price_brl, h.sold_quantity_total, h.margin_percent
  FROM public.trending_products_history h
  WHERE h.trending_product_id = product_id
    AND h.snapshot_date >= (CURRENT_DATE - GREATEST(COALESCE(days,30),1))
  ORDER BY h.snapshot_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_trending_product_history(uuid, integer)
  TO authenticated, service_role;
