create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key,
  weekly_availability text,
  onboarding_step integer not null default 1,
  onboarding_completed boolean not null default false,
  onboarding_objective text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists category text,
  add column if not exists marketplace text,
  add column if not exists referral_source text,
  add column if not exists onboarding_step integer not null default 1,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists payment_status text not null default 'not_started',
  add column if not exists lead_origin text,
  add column if not exists user_status text not null default 'lead',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.user_profiles
set id = gen_random_uuid()
where id is null;

create unique index if not exists idx_user_profiles_user_id_unique on public.user_profiles(user_id);

create table if not exists public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_name text not null,
  event_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_profiles_user_id on public.user_profiles(user_id);
create index if not exists idx_user_profiles_category on public.user_profiles(category);
create index if not exists idx_user_profiles_marketplace on public.user_profiles(marketplace);
create index if not exists idx_user_profiles_referral_source on public.user_profiles(referral_source);
create index if not exists idx_user_profiles_payment_status on public.user_profiles(payment_status);
create index if not exists idx_user_profiles_created_at on public.user_profiles(created_at);

create index if not exists idx_onboarding_events_user_id on public.onboarding_events(user_id);
create index if not exists idx_onboarding_events_event_name on public.onboarding_events(event_name);
create index if not exists idx_onboarding_events_created_at on public.onboarding_events(created_at);

alter table public.user_profiles enable row level security;
alter table public.onboarding_events enable row level security;

drop policy if exists "Users can read own onboarding profile" on public.user_profiles;
create policy "Users can read own onboarding profile"
  on public.user_profiles
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own onboarding profile" on public.user_profiles;
create policy "Users can insert own onboarding profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own onboarding profile" on public.user_profiles;
create policy "Users can update own onboarding profile"
  on public.user_profiles
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins can read onboarding profiles" on public.user_profiles;
create policy "Admins can read onboarding profiles"
  on public.user_profiles
  for select
  using (
    exists (
      select 1
      from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
    )
  );

drop policy if exists "Users can read own onboarding events" on public.onboarding_events;
create policy "Users can read own onboarding events"
  on public.onboarding_events
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own onboarding events" on public.onboarding_events;
create policy "Users can insert own onboarding events"
  on public.onboarding_events
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can read onboarding events" on public.onboarding_events;
create policy "Admins can read onboarding events"
  on public.onboarding_events
  for select
  using (
    exists (
      select 1
      from public.user_roles
      where user_roles.user_id = auth.uid()
        and user_roles.role = 'admin'
    )
  );
