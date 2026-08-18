update public.subscriptions
set status = 'cancelled', updated_at = now()
where id = 'dc915b95-ebfd-4c71-b074-194f9d626045';

update public.profiles p
set plano = coalesce((
  select s.plan from public.subscriptions s
  where s.user_id = p.user_id and s.status in ('active','trialing')
  order by s.created_at desc limit 1
), 'gratis')
where p.user_id = 'cb9170fa-eea4-4a6e-85fa-c191d1f5aa8a';