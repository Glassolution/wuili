-- Lembretes de plano: roda a cada 6 horas e avisa, dentro do app, quem deixou
-- um anúncio pronto e não assinou. O segredo fica em cron_tokens, nunca no SQL.
insert into public.cron_tokens (name, token)
values ('lembrete-planos', encode(gen_random_bytes(24), 'hex'))
on conflict (name) do nothing;

select cron.schedule(
  'lembrete-planos-6h',
  '17 */6 * * *',
  $$
  select net.http_post(
    url := 'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/lembrete-planos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select token from public.cron_tokens where name = 'lembrete-planos')
    ),
    body := '{}'::jsonb
  );
  $$
);