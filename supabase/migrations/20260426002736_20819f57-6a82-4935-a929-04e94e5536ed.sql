ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS ml_order_id text,
  ADD COLUMN IF NOT EXISTS ml_user_id text,
  ADD COLUMN IF NOT EXISTS buyer_email text,
  ADD COLUMN IF NOT EXISTS total_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS orders_ml_order_id_unique ON public.orders (ml_order_id) WHERE ml_order_id IS NOT NULL;