-- Chat messages table for supplier conversations
create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  supplier_id text not null,          -- e.g. "cj-dropshipping", "alibaba-supply"
  order_id    uuid references public.orders(id) on delete set null,
  sender      text not null check (sender in ('user', 'supplier', 'system')),
  message_text text not null,
  message_type text not null default 'text' check (message_type in ('text', 'image', 'system')),
  image_url   text,
  created_at  timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "users see own messages"
  on public.chat_messages for all
  using (auth.uid() = user_id);

create index idx_chat_messages_user_supplier
  on public.chat_messages (user_id, supplier_id, created_at desc);

-- Supplier registry (derived from orders.supplier field)
-- No separate table needed — suppliers are inferred from orders
