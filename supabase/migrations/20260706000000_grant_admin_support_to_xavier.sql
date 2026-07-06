do $$
declare
  target_user_id uuid;
begin
  select id
    into target_user_id
  from auth.users
  where lower(email) = lower('xavierluisfelipe12@gmail.com')
  limit 1;

  if target_user_id is null then
    raise notice 'Usuario xavierluisfelipe12@gmail.com ainda nao existe no auth.users.';
    return;
  end if;

  update public.profiles
  set
    role = 'admin',
    updated_at = now()
  where user_id = target_user_id;

  insert into public.user_roles (user_id, role)
  select target_user_id, 'admin'::public.app_role
  where not exists (
    select 1
    from public.user_roles
    where user_id = target_user_id
      and role = 'admin'
  );
end $$;
