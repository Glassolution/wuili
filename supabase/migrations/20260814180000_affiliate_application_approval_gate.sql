-- Portão de entrada do programa de afiliados.
--
-- O painel de afiliado e a criação de links só ficam disponíveis depois que o
-- candidato envia o cadastro (`affiliate_applications`) e o admin aprova
-- (`affiliates.is_active`). Tudo aqui é idempotente porque o banco de produção
-- já pode ter parte destes objetos.

-- ---------------------------------------------------------------------------
-- Cadastro enviado pelo candidato
-- ---------------------------------------------------------------------------
create table if not exists public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  affiliate_code text,
  full_name text,
  email text,
  phone text,
  cpf text,
  socials jsonb not null default '[]'::jsonb,
  audience_range text,
  content_niche text,
  pix_keys jsonb not null default '[]'::jsonb,
  promotion_plan text,
  agreed_terms boolean not null default false,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.affiliate_applications
  add column if not exists status text not null default 'pending';

alter table public.affiliate_applications
  drop constraint if exists affiliate_applications_status_check;

alter table public.affiliate_applications
  add constraint affiliate_applications_status_check
  check (status in ('pending', 'approved', 'rejected'));

create index if not exists idx_affiliate_applications_code
  on public.affiliate_applications (upper(affiliate_code));

alter table public.affiliate_applications enable row level security;

grant select, insert, update on public.affiliate_applications to authenticated;
grant all on public.affiliate_applications to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_applications'
      and policyname = 'Users view own affiliate application'
  ) then
    create policy "Users view own affiliate application"
      on public.affiliate_applications for select
      to authenticated
      using (auth.uid() = user_id or public.is_admin(auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_applications'
      and policyname = 'Users insert own affiliate application'
  ) then
    create policy "Users insert own affiliate application"
      on public.affiliate_applications for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_applications'
      and policyname = 'Users update own affiliate application'
  ) then
    create policy "Users update own affiliate application"
      on public.affiliate_applications for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Aprovação: só admin liga o is_active
-- ---------------------------------------------------------------------------
-- A policy "Users can update own affiliate link" deixa o próprio afiliado dar
-- UPDATE na sua linha. Sem este trigger qualquer um se auto-aprovaria e a
-- aprovação pelo admin viraria enfeite.
alter table public.affiliates
  add column if not exists is_active boolean not null default false;

create or replace function public.affiliates_admin_only_activation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;

  if tg_op = 'INSERT' and not public.is_admin(auth.uid()) then
    new.is_active := false;
    return new;
  end if;

  if tg_op = 'UPDATE'
    and new.is_active is distinct from old.is_active
    and not public.is_admin(auth.uid()) then
    raise exception 'affiliate_activation_admin_only';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_affiliates_admin_only_activation on public.affiliates;
create trigger trg_affiliates_admin_only_activation
before insert or update on public.affiliates
for each row
execute function public.affiliates_admin_only_activation();
