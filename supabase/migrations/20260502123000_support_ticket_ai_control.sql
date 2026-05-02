alter table public.support_tickets
  add column if not exists ai_active boolean not null default true,
  add column if not exists admin_last_seen_at timestamptz;

alter table public.support_messages
  drop constraint if exists support_messages_sender_check;

alter table public.support_messages
  add constraint support_messages_sender_check
  check (sender in ('user', 'admin', 'ai'));

drop policy if exists "users can pause ai on own support tickets" on public.support_tickets;
create policy "users can pause ai on own support tickets"
  on public.support_tickets
  for update
  using (user_id = auth.uid() and status = 'open')
  with check (user_id = auth.uid() and status = 'open');

drop policy if exists "users and admins can create support messages" on public.support_messages;
create policy "users and admins can create support messages"
  on public.support_messages
  for insert
  with check (
    (
      sender in ('user', 'ai')
      and user_id = auth.uid()
      and exists (
        select 1
        from public.support_tickets t
        where t.id = support_messages.ticket_id
          and t.user_id = auth.uid()
          and t.status = 'open'
      )
    )
    or (
      sender = 'admin'
      and user_id = auth.uid()
      and public.is_admin()
      and exists (
        select 1
        from public.support_tickets t
        where t.id = support_messages.ticket_id
          and t.status = 'open'
      )
    )
  );

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
    coalesce(p.display_name, au.email) as user_name,
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
    order by sm.created_at desc
    limit 1
  ) lm on true
  where p_status is null or t.status = p_status
  order by t.updated_at desc;
end;
$$;

grant execute on function public.get_support_tickets_admin(text) to authenticated;
