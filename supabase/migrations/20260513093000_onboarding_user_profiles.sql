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
  add column if not exists weekly_availability text,
  add column if not exists onboarding_step integer not null default 1,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists onboarding_objective text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  add column if not exists weekly_availability text,
  add column if not exists onboarding_step integer not null default 1,
  add column if not exists onboarding_objective text;

create index if not exists idx_user_profiles_onboarding_step
  on public.user_profiles (onboarding_step);

