-- Human support tickets and messages

alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = check_user_id
      and role = 'admin'
  );
$$;

create table if not exists public.support_tickets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  message    text not null check (length(trim(message)) > 0),
  sender     text not null check (sender in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "users and admins can view support tickets" on public.support_tickets;
create policy "users and admins can view support tickets"
  on public.support_tickets
  for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users can create own support tickets" on public.support_tickets;
create policy "users can create own support tickets"
  on public.support_tickets
  for insert
  with check (user_id = auth.uid());

drop policy if exists "admins can update support tickets" on public.support_tickets;
create policy "admins can update support tickets"
  on public.support_tickets
  for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "users and admins can view support messages" on public.support_messages;
create policy "users and admins can view support messages"
  on public.support_messages
  for select
  using (
    public.is_admin()
    or exists (
      select 1
      from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists "users and admins can create support messages" on public.support_messages;
create policy "users and admins can create support messages"
  on public.support_messages
  for insert
  with check (
    (
      sender = 'user'
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

create index if not exists idx_support_tickets_user_status
  on public.support_tickets (user_id, status, updated_at desc);

create index if not exists idx_support_tickets_status_updated
  on public.support_tickets (status, updated_at desc);

create index if not exists idx_support_messages_ticket_created
  on public.support_messages (ticket_id, created_at);

create or replace function public.touch_support_ticket_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_touch_updated_at on public.support_tickets;
create trigger support_tickets_touch_updated_at
  before update on public.support_tickets
  for each row
  execute function public.touch_support_ticket_updated_at();

create or replace function public.touch_support_ticket_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.support_tickets
     set updated_at = now()
   where id = new.ticket_id;
  return new;
end;
$$;

drop trigger if exists support_messages_touch_ticket on public.support_messages;
create trigger support_messages_touch_ticket
  after insert on public.support_messages
  for each row
  execute function public.touch_support_ticket_after_message();

create or replace function public.notify_admins_support_ticket()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, title, message, metadata)
  select
    p.user_id,
    'info',
    'Novo ticket de suporte',
    'Um usuário solicitou suporte humano.',
    jsonb_build_object('ticket_id', new.id, 'user_id', new.user_id)
  from public.profiles p
  where p.role = 'admin';

  return new;
end;
$$;

drop trigger if exists support_ticket_notify_admins on public.support_tickets;
create trigger support_ticket_notify_admins
  after insert on public.support_tickets
  for each row
  execute function public.notify_admins_support_ticket();

create or replace function public.get_support_tickets_admin(p_status text default 'open')
returns table (
  id uuid,
  user_id uuid,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  user_name text,
  user_email text,
  last_message text,
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
    t.created_at,
    t.updated_at,
    coalesce(p.display_name, au.email) as user_name,
    au.email as user_email,
    lm.message as last_message,
    lm.created_at as last_message_at
  from public.support_tickets t
  left join public.profiles p on p.user_id = t.user_id
  left join auth.users au on au.id = t.user_id
  left join lateral (
    select sm.message, sm.created_at
    from public.support_messages sm
    where sm.ticket_id = t.id
    order by sm.created_at desc
    limit 1
  ) lm on true
  where p_status is null or t.status = p_status
  order by t.updated_at desc;
end;
$$;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.get_support_tickets_admin(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'support_tickets'
    ) then
      alter publication supabase_realtime add table public.support_tickets;
    end if;

    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'support_messages'
    ) then
      alter publication supabase_realtime add table public.support_messages;
    end if;
  end if;
end;
$$;
