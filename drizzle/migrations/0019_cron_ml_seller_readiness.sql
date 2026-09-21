-- Verificação diária (em blocos) da aptidão real de vendedor no Mercado Livre
-- de quem pagou e ainda não publicou. Segredo fica em cron_tokens.
insert into public.cron_tokens (name, token)
values ('ml-seller-readiness-refresh', encode(gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

select cron.schedule(
  'ml-seller-readiness-4h',
  '23 */4 * * *',
  $$
  select net.http_post(
    url := 'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/ml-seller-readiness-refresh?limit=250',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select token from public.cron_tokens where name = 'ml-seller-readiness-refresh')
    ),
    body := '{}'::jsonb
  );
  $$
);