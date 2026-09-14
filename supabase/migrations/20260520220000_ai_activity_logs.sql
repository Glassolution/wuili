create table if not exists public.ai_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone not null default now()
);

alter table public.ai_activity_logs enable row level security;

create policy "Users can view own AI activity logs"
  on public.ai_activity_logs
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert own AI activity logs"
  on public.ai_activity_logs
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create index if not exists idx_ai_activity_logs_user_created
  on public.ai_activity_logs (user_id, created_at desc);