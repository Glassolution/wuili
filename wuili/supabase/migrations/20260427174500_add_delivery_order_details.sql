alter table public.orders
  add column if not exists buyer_email text,
  add column if not exists cj_product_url text,
  add column if not exists cj_product_id text;
