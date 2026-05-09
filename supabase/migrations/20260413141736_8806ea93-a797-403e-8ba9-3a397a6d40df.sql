
-- Catalog products table
CREATE TABLE public.catalog_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'cj',
  external_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  images JSONB DEFAULT '[]',
  cost_price DECIMAL(10,2) NOT NULL,
  suggested_price DECIMAL(10,2) NOT NULL,
  margin_percent DECIMAL(5,2) NOT NULL,
  category TEXT,
  supplier_name TEXT,
  supplier_contact TEXT,
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_catalog_products_external_id ON public.catalog_products(external_id);

ALTER TABLE public.catalog_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read catalog"
  ON public.catalog_products
  FOR SELECT
  TO authenticated
  USING (true);

-- CJ token cache table (internal use by edge functions)
CREATE TABLE public.cj_token_cache (
  id INTEGER PRIMARY KEY DEFAULT 1,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.cj_token_cache ENABLE ROW LEVEL SECURITY;

-- Allow edge functions (service role) full access; no anon/authenticated access needed
CREATE POLICY "Service role only" ON public.cj_token_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);
