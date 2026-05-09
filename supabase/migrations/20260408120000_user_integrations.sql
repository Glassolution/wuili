-- Tabela para armazenar tokens OAuth de plataformas externas (ML, Shopee, etc.)
create table if not exists user_integrations (
  id          uuid        default gen_random_uuid() primary key,
  user_id     uuid        references auth.users(id) on delete cascade not null,
  platform    text        not null,
  access_token  text,
  refresh_token text,
  ml_user_id  bigint,
  expires_at  timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, platform)
);

-- RLS: cada usuário só lê/edita suas próprias integrações
alter table user_integrations enable row level security;

create policy "Users can view own integrations"
  on user_integrations for select
  using (auth.uid() = user_id);

create policy "Users can insert own integrations"
  on user_integrations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own integrations"
  on user_integrations for update
  using (auth.uid() = user_id);

create policy "Users can delete own integrations"
  on user_integrations for delete
  using (auth.uid() = user_id);
