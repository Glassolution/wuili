-- Cota mensal de imagens com IA.
--
-- A tela "Imagens com IA" precisa mostrar quantas imagens restam no mês e o
-- plano gratuito precisa parar em 3. Até aqui a geração não registrava nada,
-- então não havia como contar nem como impedir o excedente.
--
-- Uma linha por imagem gerada com sucesso. O bloqueio é feito na edge function
-- `generate-product-image`, que usa a service role; o cliente só lê o próprio
-- consumo para exibir o contador.

create table if not exists public.ai_image_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- "produto" ou "anuncio": permite separar cota por tipo no futuro sem migrar.
  mode text not null default 'produto',
  created_at timestamptz not null default now()
);

-- A consulta do contador é sempre "deste usuário, a partir do início do mês".
create index if not exists ai_image_generations_user_created_idx
  on public.ai_image_generations (user_id, created_at desc);

alter table public.ai_image_generations enable row level security;

-- O usuário enxerga apenas o próprio consumo.
drop policy if exists "ai_image_generations_select_own" on public.ai_image_generations;
create policy "ai_image_generations_select_own"
  on public.ai_image_generations
  for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update/delete de propósito: só a service role registra
-- consumo. Se o cliente pudesse inserir ou apagar, a cota seria contornável.

-- RLS sozinho não basta: sem GRANT a Data API recusa por permissão antes mesmo
-- de avaliar a policy. O usuário só lê; escrita fica restrita à service role.
grant select on public.ai_image_generations to authenticated;
grant all on public.ai_image_generations to service_role;
