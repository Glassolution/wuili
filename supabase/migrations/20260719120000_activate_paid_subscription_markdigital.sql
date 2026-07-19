-- Ativação manual de assinatura paga (pagamento confirmado no Mercado Pago).
-- Usuário markdigitalbrasil74@gmail.com pagou (aprovado no MP) mas a assinatura
-- ficou presa em 'pending' — provável falha de webhook/polling do Pix.
-- Esta migration localiza a assinatura mais recente, marca como 'active' e
-- alinha profiles.plano. Idempotente: rodar de novo não causa efeito colateral.
do $$
declare
  target_user_id uuid;
  target_sub record;
  now_ts timestamptz := now();
  period_end_ts timestamptz := now() + interval '1 month';
begin
  select id
    into target_user_id
  from auth.users
  where lower(email) = lower('markdigitalbrasil74@gmail.com')
  limit 1;

  if target_user_id is null then
    raise notice 'Usuario markdigitalbrasil74@gmail.com nao encontrado — nada a fazer.';
    return;
  end if;

  -- Assinatura mais recente do usuário (a que o checkout criou para o pagamento)
  select *
    into target_sub
  from public.subscriptions
  where user_id = target_user_id
  order by created_at desc
  limit 1;

  if target_sub.id is null then
    -- Sem linha de assinatura: cria uma ativa. Sem registro de checkout não há
    -- como inferir o plano com segurança, então usa 'base' (menor plano pago).
    raise notice 'Nenhuma assinatura encontrada — criando assinatura ativa base.';
    insert into public.subscriptions (
      user_id, plan, status, payment_method, amount,
      current_period_start, current_period_end, is_trial,
      created_at, updated_at
    )
    values (
      target_user_id, 'base', 'active', 'manual_admin_activation', 39.90,
      now_ts, period_end_ts, false,
      now_ts, now_ts
    );

    update public.profiles
    set plano = 'base', updated_at = now_ts
    where user_id = target_user_id;
  else
    -- Reaproveita o plano que o checkout já registrou (base/pro/business)
    update public.subscriptions
    set
      status = 'active',
      current_period_start = now_ts,
      current_period_end = period_end_ts,
      updated_at = now_ts
    where id = target_sub.id;

    update public.profiles
    set plano = coalesce(nullif(target_sub.plan, ''), 'base'), updated_at = now_ts
    where user_id = target_user_id;

    raise notice 'Assinatura % ativada no plano %.', target_sub.id, target_sub.plan;
  end if;
end $$;
