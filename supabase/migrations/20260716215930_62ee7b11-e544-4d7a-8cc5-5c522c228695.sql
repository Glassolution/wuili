CREATE TABLE public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sales_page_id uuid REFERENCES public.generated_sales_pages(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.user_projects(id) ON DELETE SET NULL,
  catalog_product_id uuid REFERENCES public.catalog_products(id) ON DELETE SET NULL,
  product_title text NOT NULL,
  product_image_url text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text,
  buyer_cpf text,
  shipping_address jsonb,
  payment_method text NOT NULL,
  payment_status text NOT NULL DEFAULT 'pending',
  mp_payment_id text,
  mp_external_reference text,
  pix_qr_code text,
  pix_qr_code_base64 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_orders TO authenticated;
GRANT ALL ON public.store_orders TO service_role;

ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads own store orders"
  ON public.store_orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_store_orders_user ON public.store_orders(user_id, created_at DESC);
CREATE INDEX idx_store_orders_ext_ref ON public.store_orders(mp_external_reference);
CREATE INDEX idx_store_orders_mp_payment ON public.store_orders(mp_payment_id);

CREATE TRIGGER trg_store_orders_updated_at
  BEFORE UPDATE ON public.store_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();