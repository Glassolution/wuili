create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text,
  ref text,
  link text,
  commission_rate numeric not null default 0.20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.affiliates
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists code text,
  add column if not exists ref text,
  add column if not exists link text,
  add column if not exists commission_rate numeric not null default 0.20,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.affiliates
set
  code = upper(coalesce(code, ref)),
  ref = upper(coalesce(ref, code)),
  link = coalesce(link, 'https://velods.com.br/ref/' || upper(coalesce(code, ref))),
  commission_rate = 0.20,
  updated_at = now()
where code is not null or ref is not null;

create unique index if not exists affiliates_user_id_unique
  on public.affiliates (user_id);

create unique index if not exists affiliates_code_upper_unique
  on public.affiliates (upper(code))
  where code is not null;

create table if not exists public.affiliate_settings (
  id boolean primary key default true,
  commission_rate numeric not null default 0.20,
  updated_at timestamptz not null default now(),
  constraint affiliate_settings_singleton check (id)
);

alter table public.affiliate_settings
  add column if not exists commission_rate numeric not null default 0.20,
  add column if not exists updated_at timestamptz not null default now();

insert into public.affiliate_settings (id, commission_rate, updated_at)
values (true, 0.20, now())
on conflict (id) do update
set commission_rate = 0.20,
    updated_at = now();

update public.affiliate_settings
set commission_rate = 0.20,
    updated_at = now()
where commission_rate <> 0.20;

alter table public.profiles
  add column if not exists ref text;

alter table public.affiliates enable row level security;
alter table public.affiliate_settings enable row level security;

grant select, insert, update on public.affiliates to authenticated;
grant select on public.affiliate_settings to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliates'
      and policyname = 'Users can read own affiliate link'
  ) then
    create policy "Users can read own affiliate link"
      on public.affiliates for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliates'
      and policyname = 'Users can create own affiliate link'
  ) then
    create policy "Users can create own affiliate link"
      on public.affiliates for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliates'
      and policyname = 'Users can update own affiliate link'
  ) then
    create policy "Users can update own affiliate link"
      on public.affiliates for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_settings'
      and policyname = 'Users can read affiliate settings'
  ) then
    create policy "Users can read affiliate settings"
      on public.affiliate_settings for select
      to authenticated
      using (true);
  end if;
end $$;

