-- Add supplier column to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS supplier text;
