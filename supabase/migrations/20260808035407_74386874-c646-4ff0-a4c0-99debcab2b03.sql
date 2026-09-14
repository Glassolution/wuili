create or replace function public.rpc_admin_accept_affiliate_application(p_affiliate_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated int;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'not_authorized';
  end if;

  update public.affiliates
     set is_active = true
   where upper(trim(code)) = upper(trim(p_affiliate_code));

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.rpc_admin_accept_affiliate_application(text) from public;
grant execute on function public.rpc_admin_accept_affiliate_application(text) to authenticated;
grant execute on function public.rpc_admin_accept_affiliate_application(text) to service_role;