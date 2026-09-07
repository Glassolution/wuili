DROP INDEX IF EXISTS public.dropship_orders_ml_order_id_key;
ALTER TABLE public.dropship_orders
  ADD CONSTRAINT dropship_orders_ml_order_id_key UNIQUE (ml_order_id);