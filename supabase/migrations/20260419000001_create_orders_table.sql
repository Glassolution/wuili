-- Orders table: stores orders received on connected platforms
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  external_order_id text,
  platform text not null, -- 'mercadolivre' | 'shopee'
  product_title text not null,
  product_image text,
  buyer_name text,
  sale_price numeric not null,
  cost_price numeric,
  profit numeric,
  status text not null default 'pending', -- 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled'
  tracking_code text,
  ordered_at timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

alter table orders enable row level security;

create policy "users see own orders"
  on orders for all
  using (auth.uid() = user_id);
