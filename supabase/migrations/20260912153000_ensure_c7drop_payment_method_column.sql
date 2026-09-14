ALTER TABLE public.dropship_orders
  ADD COLUMN IF NOT EXISTS c7drop_payment_method text;

NOTIFY pgrst, 'reload schema';