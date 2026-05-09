
-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'custom',
  api_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read suppliers"
ON public.suppliers FOR SELECT
TO authenticated
USING (true);

-- Create supplier_products table
CREATE TABLE public.supplier_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.catalog_products(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  external_id TEXT NOT NULL,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  shipping_cost NUMERIC NOT NULL DEFAULT 0,
  shipping_days INTEGER NOT NULL DEFAULT 15,
  stock_status TEXT NOT NULL DEFAULT 'available',
  rating NUMERIC DEFAULT 0,
  raw_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(product_id, supplier_id)
);

ALTER TABLE public.supplier_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read supplier products"
ON public.supplier_products FOR SELECT
TO authenticated
USING (true);

-- Index for fast lookups
CREATE INDEX idx_supplier_products_product ON public.supplier_products(product_id);
CREATE INDEX idx_supplier_products_supplier ON public.supplier_products(supplier_id);

-- Auto-update timestamps
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_supplier_products_updated_at
BEFORE UPDATE ON public.supplier_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial suppliers
INSERT INTO public.suppliers (name, type, is_active) VALUES
  ('CJ Dropshipping', 'cj', true),
  ('Zendrop', 'zendrop', false);
