-- A Velo remunera o afiliado uma única vez: 30% sobre a primeira venda
-- de cada cliente indicado. Conversões históricas mantêm a taxa registrada.

alter table public.affiliates
  alter column commission_rate set default 0.30;

alter table public.affiliate_settings
  alter column commission_rate set default 0.30;

update public.affiliates
set commission_rate = 0.30,
    updated_at = now()
where commission_rate is distinct from 0.30;

insert into public.affiliate_settings (id, commission_rate, updated_at)
values (true, 0.30, now())
on conflict (id) do update
set commission_rate = excluded.commission_rate,
    updated_at = excluded.updated_at;
