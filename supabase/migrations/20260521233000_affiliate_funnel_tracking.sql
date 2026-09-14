-- Affiliate funnel tracking (visita -> cadastro -> chegou pagamento -> pagou -> comissão pendente)
-- Preserva a base existente (affiliates + /ref/:code) e adiciona tracking via RPCs.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.affiliate_clicks (
  id             uuid primary key default gen_random_uuid(),
  affiliate_code text not null,
  referrer       text,
  user_agent     text,
  ip_hash        text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_affiliate_clicks_code_created
  on public.affiliate_clicks (affiliate_code, created_at desc);

alter table public.affiliate_clicks enable row level security;

create table if not exists public.affiliate_conversions (
  id                        uuid primary key default gen_random_uuid(),
  affiliate_code            text not null,
  subscriber_user_id        uuid not null references auth.users(id) on delete cascade,
  subscription_id           uuid references public.subscriptions(id) on delete set null,
  status                    text not null default 'signup' check (status in ('signup', 'reached_payment', 'paid')),
  reached_payment_at        timestamptz,
  paid_at                   timestamptz,
  plan_value                numeric not null default 0,
  commission_rate           numeric not null default 0.20,
  commission_value          numeric not null default 0,
  payout_status             text not null default 'pending' check (payout_status in ('pending', 'paid')),
  payout_paid_at            timestamptz,
  created_at                timestamptz not null default now()
);

-- Se a tabela ja existia, garantir colunas novas sem quebrar
alter table public.affiliate_conversions
  add column if not exists reached_payment_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists payout_status text,
  add column if not exists payout_paid_at timestamptz;

create unique index if not exists affiliate_conversions_affiliate_subscriber_unique
  on public.affiliate_conversions (affiliate_code, subscriber_user_id);

create index if not exists idx_affiliate_conversions_code_status
  on public.affiliate_conversions (affiliate_code, status);

alter table public.affiliate_conversions enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  -- affiliate_clicks: qualquer pessoa pode registrar clique/visita (sem dados sensíveis)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_clicks'
      and policyname = 'Anyone can insert affiliate clicks'
  ) then
    create policy "Anyone can insert affiliate clicks"
      on public.affiliate_clicks
      for insert
      to anon, authenticated
      with check (
        exists (
          select 1
          from public.affiliates a
          where upper(a.code) = upper(affiliate_clicks.affiliate_code)
        )
      );
  end if;

  -- Admin pode ler clicks
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_clicks'
      and policyname = 'Admins can read affiliate clicks'
  ) then
    create policy "Admins can read affiliate clicks"
      on public.affiliate_clicks
      for select
      to authenticated
      using (public.is_admin());
  end if;

  -- affiliate_conversions: admin ve tudo
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_conversions'
      and policyname = 'Admins can read affiliate conversions'
  ) then
    create policy "Admins can read affiliate conversions"
      on public.affiliate_conversions
      for select
      to authenticated
      using (public.is_admin());
  end if;

  -- affiliate_conversions: afiliado ve apenas os proprios (por codigo)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_conversions'
      and policyname = 'Affiliate can read own conversions'
  ) then
    create policy "Affiliate can read own conversions"
      on public.affiliate_conversions
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.affiliates a
          where a.user_id = auth.uid()
            and upper(a.code) = upper(affiliate_conversions.affiliate_code)
        )
      );
  end if;

  -- Admin pode atualizar payout_status (pagar comissão)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'affiliate_conversions'
      and policyname = 'Admins can update affiliate conversions payout'
  ) then
    create policy "Admins can update affiliate conversions payout"
      on public.affiliate_conversions
      for update
      to authenticated
      using (public.is_admin())
      with check (public.is_admin());
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs (tracking)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.rpc_record_affiliate_visit(
  p_affiliate_code text,
  p_referrer text default null,
  p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := upper(trim(coalesce(p_affiliate_code, '')));
  if v_code = '' then
    return;
  end if;

  -- valida que o codigo existe para evitar lixo/spam
  if not exists (select 1 from public.affiliates a where upper(a.code) = v_code) then
    return;
  end if;

  insert into public.affiliate_clicks (affiliate_code, referrer, user_agent)
  values (v_code, nullif(trim(p_referrer), ''), nullif(trim(p_user_agent), ''));
end;
$$;

grant execute on function public.rpc_record_affiliate_visit(text, text, text) to anon, authenticated;

create or replace function public.rpc_affiliate_attach_signup(
  p_affiliate_code text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_affiliate_user_id uuid;
  v_rate numeric;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_code := upper(trim(coalesce(p_affiliate_code, '')));
  if v_code = '' then
    return false;
  end if;

  select a.user_id, coalesce(a.commission_rate, s.commission_rate, 0.20)
    into v_affiliate_user_id, v_rate
  from public.affiliates a
  left join lateral (
    select commission_rate
    from public.affiliate_settings
    order by updated_at desc nulls last
    limit 1
  ) s on true
  where upper(a.code) = v_code
  limit 1;

  if v_affiliate_user_id is null then
    return false;
  end if;

  -- bloqueia auto-indicacao
  if v_affiliate_user_id = auth.uid() then
    return false;
  end if;

  insert into public.affiliate_conversions (
    affiliate_code,
    subscriber_user_id,
    status,
    commission_rate,
    commission_value,
    plan_value,
    created_at
  )
  values (v_code, auth.uid(), 'signup', v_rate, 0, 0, now())
  on conflict (affiliate_code, subscriber_user_id) do update
    set status = case
      when affiliate_conversions.status = 'paid' then 'paid'
      when affiliate_conversions.status = 'reached_payment' then 'reached_payment'
      else 'signup'
    end;

  return true;
end;
$$;

grant execute on function public.rpc_affiliate_attach_signup(text) to authenticated;

create or replace function public.rpc_affiliate_mark_reached_payment(
  p_affiliate_code text,
  p_plan_value numeric default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_affiliate_user_id uuid;
  v_rate numeric;
  v_plan_value numeric;
begin
  if auth.uid() is null then
    return false;
  end if;

  v_code := upper(trim(coalesce(p_affiliate_code, '')));
  if v_code = '' then
    return false;
  end if;

  v_plan_value := coalesce(p_plan_value, 0);

  select a.user_id, coalesce(a.commission_rate, s.commission_rate, 0.20)
    into v_affiliate_user_id, v_rate
  from public.affiliates a
  left join lateral (
    select commission_rate
    from public.affiliate_settings
    order by updated_at desc nulls last
    limit 1
  ) s on true
  where upper(a.code) = v_code
  limit 1;

  if v_affiliate_user_id is null then
    return false;
  end if;

  -- bloqueia auto-indicacao
  if v_affiliate_user_id = auth.uid() then
    return false;
  end if;

  insert into public.affiliate_conversions (
    affiliate_code,
    subscriber_user_id,
    status,
    reached_payment_at,
    commission_rate,
    commission_value,
    plan_value,
    created_at
  )
  values (v_code, auth.uid(), 'reached_payment', now(), v_rate, 0, v_plan_value, now())
  on conflict (affiliate_code, subscriber_user_id) do update
    set status = case
      when affiliate_conversions.status = 'paid' then 'paid'
      else 'reached_payment'
    end,
    reached_payment_at = coalesce(affiliate_conversions.reached_payment_at, now()),
    plan_value = greatest(affiliate_conversions.plan_value, excluded.plan_value),
    commission_rate = coalesce(affiliate_conversions.commission_rate, excluded.commission_rate);

  return true;
end;
$$;

grant execute on function public.rpc_affiliate_mark_reached_payment(text, numeric) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs (admin)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.rpc_admin_affiliates_summary()
returns table (
  affiliate_user_id uuid,
  affiliate_name text,
  affiliate_email text,
  code text,
  link text,
  created_at timestamptz,
  clicks bigint,
  signups bigint,
  reached_payment bigint,
  payers bigint,
  commission_pending numeric,
  commission_paid numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.user_id as affiliate_user_id,
    coalesce(p.full_name, p.display_name, p.email, a.user_id::text) as affiliate_name,
    p.email as affiliate_email,
    a.code,
    coalesce(a.link, ('https://velods.com.br/ref/' || a.code)) as link,
    a.created_at,
    coalesce(c.clicks, 0) as clicks,
    coalesce(conv.signups, 0) as signups,
    coalesce(conv.reached_payment, 0) as reached_payment,
    coalesce(conv.payers, 0) as payers,
    coalesce(conv.commission_pending, 0) as commission_pending,
    coalesce(conv.commission_paid, 0) as commission_paid
  from public.affiliates a
  left join public.profiles p
    on p.user_id = a.user_id
  left join (
    select affiliate_code, count(*)::bigint as clicks
    from public.affiliate_clicks
    group by affiliate_code
  ) c on upper(c.affiliate_code) = upper(a.code)
  left join (
    select
      affiliate_code,
      count(distinct subscriber_user_id)::bigint filter (where status in ('signup','reached_payment','paid')) as signups,
      count(distinct subscriber_user_id)::bigint filter (where status in ('reached_payment','paid')) as reached_payment,
      count(distinct subscriber_user_id)::bigint filter (where status = 'paid') as payers,
      sum(commission_value) filter (where status = 'paid' and coalesce(payout_status, 'pending') = 'pending') as commission_pending,
      sum(commission_value) filter (where status = 'paid' and coalesce(payout_status, 'pending') = 'paid') as commission_paid
    from public.affiliate_conversions
    group by affiliate_code
  ) conv on upper(conv.affiliate_code) = upper(a.code)
  where public.is_admin()
  order by a.created_at desc;
$$;

grant execute on function public.rpc_admin_affiliates_summary() to authenticated;

create or replace function public.rpc_admin_affiliate_details(p_affiliate_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_result json;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  v_code := upper(trim(coalesce(p_affiliate_code, '')));
  if v_code = '' then
    return json_build_object('error', 'missing_code');
  end if;

  select json_build_object(
    'affiliate',
    (
      select json_build_object(
        'user_id', a.user_id,
        'code', a.code,
        'link', coalesce(a.link, ('https://velods.com.br/ref/' || a.code)),
        'commission_rate', a.commission_rate,
        'created_at', a.created_at
      )
      from public.affiliates a
      where upper(a.code) = v_code
      limit 1
    ),
    'clicks',
    (
      select coalesce(json_agg(json_build_object(
        'created_at', c.created_at,
        'referrer', c.referrer,
        'user_agent', c.user_agent
      ) order by c.created_at desc), '[]'::json)
      from public.affiliate_clicks c
      where upper(c.affiliate_code) = v_code
      limit 200
    ),
    'conversions',
    (
      select coalesce(json_agg(json_build_object(
        'id', conv.id,
        'subscriber_user_id', conv.subscriber_user_id,
        'subscriber_email', sp.email,
        'subscriber_name', coalesce(sp.full_name, sp.display_name, sp.email),
        'status', conv.status,
        'plan_value', conv.plan_value,
        'commission_rate', conv.commission_rate,
        'commission_value', conv.commission_value,
        'payout_status', coalesce(conv.payout_status, 'pending'),
        'created_at', conv.created_at,
        'reached_payment_at', conv.reached_payment_at,
        'paid_at', conv.paid_at
      ) order by conv.created_at desc), '[]'::json)
      from public.affiliate_conversions conv
      left join public.profiles sp on sp.user_id = conv.subscriber_user_id
      where upper(conv.affiliate_code) = v_code
      limit 200
    )
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.rpc_admin_affiliate_details(text) to authenticated;

