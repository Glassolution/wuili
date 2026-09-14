create table if not exists public.ai_image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  mode text not null default 'produto',
  created_at timestamptz not null default now()
);

create index if not exists ai_image_generations_user_created_idx
  on public.ai_image_generations (user_id, created_at desc);

grant select on public.ai_image_generations to authenticated;
grant all on public.ai_image_generations to service_role;

alter table public.ai_image_generations enable row level security;

drop policy if exists "ai_image_generations_select_own" on public.ai_image_generations;
create policy "ai_image_generations_select_own"
  on public.ai_image_generations
  for select
  to authenticated
  using (auth.uid() = user_id);