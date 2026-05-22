-- Compat: garantir colunas esperadas em affiliate_conversions (sem quebrar o painel)
-- Motivo: ambientes antigos podem ter affiliate_conversions sem payout_status/paid_at/payment_id/plan_name.

alter table public.affiliate_conversions
  add column if not exists payout_status text,
  add column if not exists plan_name text,
  add column if not exists payment_id text,
  add column if not exists paid_at timestamptz;

-- Default + constraint (aplica só se a coluna existir; e não assume que já tem default)
do $$
begin
  -- payout_status default/constraint
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'affiliate_conversions'
      and column_name = 'payout_status'
  ) then
    -- backfill
    execute $$update public.affiliate_conversions set payout_status = 'pending' where payout_status is null$$;
    -- default
    begin
      execute $$alter table public.affiliate_conversions alter column payout_status set default 'pending'$$;
    exception when others then
      -- ignore
    end;
    -- constraint (idempotente)
    if not exists (
      select 1
      from pg_constraint
      where conname = 'affiliate_conversions_payout_status_check'
    ) then
      execute $c$
        alter table public.affiliate_conversions
          add constraint affiliate_conversions_payout_status_check
          check (payout_status in ('pending','paid'))
      $c$;
    end if;
  end if;
end $$;

