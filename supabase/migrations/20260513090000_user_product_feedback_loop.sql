create table if not exists public.user_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_id text not null,
  event_type text not null check (
    event_type in (
      'product_viewed',
      'product_clicked_buy',
      'product_sold',
      'product_dismissed'
    )
  ),
  product_id text,
  category text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, event_id)
);

create index if not exists idx_user_events_user_created
  on public.user_events (user_id, created_at desc);

create index if not exists idx_user_events_type_product
  on public.user_events (event_type, product_id);

alter table public.profiles
  add column if not exists experience_level text not null default 'beginner'
    check (experience_level in ('beginner', 'intermediate', 'advanced')),
  add column if not exists preferred_categories text[] not null default '{}',
  add column if not exists category_preferences jsonb not null default '{}'::jsonb,
  add column if not exists sales_history jsonb not null default '[]'::jsonb,
  add column if not exists dismissed_products text[] not null default '{}',
  add column if not exists onboarding_completed boolean not null default false;

