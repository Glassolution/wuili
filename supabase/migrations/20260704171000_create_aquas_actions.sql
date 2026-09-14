create table if not exists public.aquas_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid null,
  user_id uuid not null references auth.users(id) on delete cascade,
  action_type text not null check (
    action_type in (
      'navigate',
      'diagnose',
      'publish_start',
      'publish_complete',
      'product_search'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

do $$
begin
  if to_regclass('public.aquas_conversations') is not null
    and not exists (
      select 1
      from pg_constraint
      where conname = 'aquas_actions_conversation_id_fkey'
        and conrelid = 'public.aquas_actions'::regclass
    )
  then
    alter table public.aquas_actions
      add constraint aquas_actions_conversation_id_fkey
      foreign key (conversation_id)
      references public.aquas_conversations(id)
      on delete cascade;
  end if;
end $$;

create index if not exists idx_aquas_actions_user_id_created_at
  on public.aquas_actions (user_id, created_at desc);

create index if not exists idx_aquas_actions_conversation_id
  on public.aquas_actions (conversation_id)
  where conversation_id is not null;

create index if not exists idx_aquas_actions_action_type
  on public.aquas_actions (action_type);

alter table public.aquas_actions enable row level security;

drop policy if exists "Users can view own Aquas actions" on public.aquas_actions;
create policy "Users can view own Aquas actions"
  on public.aquas_actions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own Aquas actions" on public.aquas_actions;
create policy "Users can insert own Aquas actions"
  on public.aquas_actions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own Aquas actions" on public.aquas_actions;
create policy "Users can delete own Aquas actions"
  on public.aquas_actions
  for delete
  to authenticated
  using (auth.uid() = user_id);
