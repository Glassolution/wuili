alter table public.orders
  add column if not exists buyer_number text,
  add column if not exists buyer_neighborhood text;