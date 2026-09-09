-- Reforca identidade de usuarios para telas administrativas de reembolso.
-- Alguns perfis antigos ficaram com display_name generico e sem email,
-- fazendo a tela cair para "Usuario" + pedaco do user_id.

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set
  email = coalesce(nullif(p.email, ''), u.email),
  display_name = case
    when nullif(btrim(coalesce(p.display_name, '')), '') is null
      or lower(btrim(p.display_name)) in ('usuario', 'usuário')
    then coalesce(
      nullif(btrim(u.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(u.raw_user_meta_data->>'name'), ''),
      split_part(u.email, '@', 1),
      p.display_name
    )
    else p.display_name
  end
from auth.users u
where p.user_id = u.id
  and (
    p.email is null
    or p.email = ''
    or p.display_name is null
    or p.display_name = ''
    or lower(btrim(p.display_name)) in ('usuario', 'usuário')
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  insert into public.profiles (user_id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (user_id) do update
    set email = excluded.email,
        display_name = case
          when public.profiles.display_name is null
            or public.profiles.display_name = ''
            or lower(btrim(public.profiles.display_name)) in ('usuario', 'usuário')
          then excluded.display_name
          else public.profiles.display_name
        end;
  return new;
end;
$function$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.profiles
  set email = new.email,
      display_name = case
        when display_name is null
          or display_name = ''
          or lower(btrim(display_name)) in ('usuario', 'usuário')
        then coalesce(
          nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
          nullif(btrim(new.raw_user_meta_data->>'name'), ''),
          split_part(new.email, '@', 1),
          display_name
        )
        else display_name
      end
  where user_id = new.id;
  return new;
end;
$$;

drop trigger if exists sync_profile_email_on_auth_update on auth.users;
create trigger sync_profile_email_on_auth_update
after update of email on auth.users
for each row execute function public.sync_profile_email();
