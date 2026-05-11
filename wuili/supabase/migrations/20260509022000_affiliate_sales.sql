-- Affiliate sales / commissions tracking
-- This migration adds:
-- 1) profiles.ref: a stable referral code per user
-- 2) affiliate_sales: rows representing subscriptions/sales attributed to an affiliate (influencer)

-- ─────────────────────────────────────────────────────────────────────────────
-- Profiles: referral ref
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists ref text;

create unique index if not exists profiles_ref_unique
  on public.profiles (ref)
  where ref is not null;

create or replace function public.generate_profile_ref()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate text;
begin
  loop
    candidate := encode(gen_random_bytes(4), 'hex');
    exit when not exists (select 1 from public.profiles p where p.ref = candidate);
  end loop;
  return candidate;
end;
$$;

-- Backfill existing profiles
update public.profiles
set ref = public.generate_profile_ref()
where ref is null;

-- Ensure new users always get a ref
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.profiles (user_id, display_name, ref)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    public.generate_profile_ref()
  );
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Affiliate sales table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.affiliate_sales (
  id uuid primary key default gen_random_uuid(),
  affiliate_user_id uuid not null references auth.users(id) on delete cascade,
  affiliate_ref text not null,
  customer_user_id uuid references auth.users(id) on delete set null,
  customer_name text,
  customer_email text,
  plan text not null default 'mensal',
  plan_price numeric not null default 147.90,
  commission_rate numeric not null default 0.20,
  commission_amount numeric not null default 0,
  commission_status text not null default 'pending' check (commission_status in ('pending', 'paid')),
  mp_payment_id text,
  mp_preference_id text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_affiliate_sales_mp_payment_id
  on public.affiliate_sales (mp_payment_id)
  where mp_payment_id is not null;

create index if not exists idx_affiliate_sales_affiliate_user
  on public.affiliate_sales (affiliate_user_id, created_at desc);

create index if not exists idx_affiliate_sales_affiliate_ref
  on public.affiliate_sales (affiliate_ref);

alter table public.affiliate_sales enable row level security;

-- Affiliate (influencer) sees only their own sales
drop policy if exists "Affiliate can view own sales" on public.affiliate_sales;
create policy "Affiliate can view own sales"
  on public.affiliate_sales
  for select
  to authenticated
  using (auth.uid() = affiliate_user_id);

-- Admin can read everything
drop policy if exists "Admins can view affiliate sales" on public.affiliate_sales;
create policy "Admins can view affiliate sales"
  on public.affiliate_sales
  for select
  to authenticated
  using (public.is_admin());

-- Admin/service role can update payout status
drop policy if exists "Admins can update affiliate sales" on public.affiliate_sales;
create policy "Admins can update affiliate sales"
  on public.affiliate_sales
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Service role manages affiliate sales" on public.affiliate_sales;
create policy "Service role manages affiliate sales"
  on public.affiliate_sales
  for all
  to service_role
  using (true)
  with check (true);
