create or replace function public.touch_support_ticket_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket_id uuid;
begin
  v_ticket_id := coalesce(new.ticket_id, old.ticket_id);

  update public.support_tickets
     set updated_at = now()
   where id = v_ticket_id;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists support_messages_touch_ticket on public.support_messages;
create trigger support_messages_touch_ticket
  after insert or update or delete on public.support_messages
  for each row
  execute function public.touch_support_ticket_after_message();

drop function if exists public.get_support_tickets_admin(text);

create function public.get_support_tickets_admin(p_status text default 'open')
returns table (
  id uuid,
  user_id uuid,
  status text,
  ai_active boolean,
  admin_last_seen_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  user_name text,
  user_email text,
  last_message text,
  last_sender text,
  last_message_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    t.id,
    t.user_id,
    t.status,
    t.ai_active,
    t.admin_last_seen_at,
    t.created_at,
    t.updated_at,
    coalesce(p.full_name, p.display_name, au.email) as user_name,
    au.email as user_email,
    lm.message as last_message,
    lm.sender as last_sender,
    lm.created_at as last_message_at
  from public.support_tickets t
  left join public.profiles p on p.user_id = t.user_id
  left join auth.users au on au.id = t.user_id
  left join lateral (
    select sm.message, sm.sender, sm.created_at
    from public.support_messages sm
    where sm.ticket_id = t.id
      and sm.sender <> 'ai'
    order by sm.created_at desc
    limit 1
  ) lm on true
  where p_status is null or t.status = p_status
  order by coalesce(lm.created_at, t.updated_at, t.created_at) desc;
end;
$$;

grant execute on function public.get_support_tickets_admin(text) to authenticated;
