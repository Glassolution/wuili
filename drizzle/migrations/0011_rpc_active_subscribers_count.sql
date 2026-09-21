-- Prova social honesta: expõe apenas a contagem de assinaturas ativas,
-- sem revelar nenhum dado de assinante.
create or replace function public.rpc_active_subscribers_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.subscriptions where status = 'active'
$$;

grant execute on function public.rpc_active_subscribers_count() to anon, authenticated;
