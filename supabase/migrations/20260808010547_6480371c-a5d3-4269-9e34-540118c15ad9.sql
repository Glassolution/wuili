CREATE TABLE public.user_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  price numeric NOT NULL DEFAULT 0,
  cost_price numeric,
  weight numeric,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric,
  category text,
  brand text,
  model text,
  sku text,
  stock_quantity integer NOT NULL DEFAULT 10,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_products TO authenticated;
GRANT ALL ON public.user_products TO service_role;

ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own products"
ON public.user_products FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_user_products_user ON public.user_products (user_id, created_at DESC);

CREATE TRIGGER trg_user_products_updated_at
BEFORE UPDATE ON public.user_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();