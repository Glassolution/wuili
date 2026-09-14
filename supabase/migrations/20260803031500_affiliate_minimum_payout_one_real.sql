-- Ajusta o minimo de saque de afiliados para R$ 1,00.

alter table public.affiliate_settings
  alter column minimum_payout set default 1;

insert into public.affiliate_settings (id, commission_rate, minimum_payout)
values (1, 20, 1)
on conflict (id) do update
set minimum_payout = 1,
    updated_at = now();
