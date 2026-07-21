-- Tempo real em user_projects: permite que o dono veja as edições dos
-- colaboradores (e vice-versa) aparecerem ao vivo na lista de projetos.
-- O RLS já existente (dono + membro ativo) controla quem recebe cada linha;
-- aqui apenas habilitamos a publicação de realtime.

-- replica identity full garante que os payloads de UPDATE/DELETE tragam a linha
-- completa (necessário para atualizar o card sem refetch e para o RLS avaliar).
alter table public.user_projects replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_projects'
  ) then
    alter publication supabase_realtime add table public.user_projects;
  end if;
end $$;
