create table if not exists public.ml_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ml_oauth_states enable row level security;

drop policy if exists "service role manages ml oauth states" on public.ml_oauth_states;
create policy "service role manages ml oauth states"
  on public.ml_oauth_states
  for all
  to service_role
  using (true)
  with check (true);

create index if not exists idx_ml_oauth_states_user_expires
  on public.ml_oauth_states (user_id, expires_at desc);

create index if not exists idx_ml_oauth_states_unconsumed
  on public.ml_oauth_states (expires_at)
  where consumed_at is null;
