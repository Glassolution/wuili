## Escopo

Transformar `/docs` (hoje um feed mockado) em feed funcional Velo com posts (só admin), curtidas e comentários (qualquer autenticado). Trocar item "Hype" da sidebar por "Tutorial" e adicionar aba Tutorial dentro de `/docs`. Preservar 100% do design atual (cores, tipografia, escala, espaçamento).

## 1. Banco de dados (migration única)

**Coluna admin em `profiles`:**
```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
```
- Backfill: `UPDATE profiles SET is_admin = true WHERE user_id IN (SELECT user_id FROM user_roles WHERE role='admin')` para preservar admins atuais.
- Function `public.is_admin(uid uuid)` SECURITY DEFINER lendo `profiles.is_admin` (evita recursão RLS).
- Policy de `profiles` para UPDATE: usuário não pode alterar `is_admin` de si mesmo — reforço com trigger `BEFORE UPDATE` que reverte `NEW.is_admin` quando o autor não é admin/service_role.

**Tabelas novas** (todas com GRANT + RLS + policies):

`help_feed_posts` (id, author_id, content, image_url, created_at, updated_at)
- SELECT: `authenticated`
- INSERT/UPDATE/DELETE: `is_admin(auth.uid())`

`help_feed_likes` (post_id, user_id, created_at) — PK composta
- SELECT: `authenticated`
- INSERT/DELETE: `auth.uid() = user_id`

`help_feed_comments` (id, post_id, author_id, content, created_at)
- SELECT: `authenticated`
- INSERT: `auth.uid() = author_id`
- DELETE: `auth.uid() = author_id OR is_admin(auth.uid())`

`help_feed_tutorials` (id, title, body_md, order_index, created_at, updated_at)
- SELECT: `authenticated`
- INSERT/UPDATE/DELETE: `is_admin(auth.uid())`

GRANT SELECT/INSERT/UPDATE/DELETE para `authenticated`; GRANT ALL para `service_role`. Sem grant para `anon`.

Trigger `updated_at` reaproveitado (`public.update_updated_at_column`).

## 2. Storage

Bucket privado `help-feed-media`.

Policies em `storage.objects` (bucket_id = 'help-feed-media'):
- SELECT: `authenticated`
- INSERT/UPDATE/DELETE: `is_admin(auth.uid())`

Frontend valida antes do upload: `image/jpeg|png|webp`, ≤ 8 MB, filename = `${crypto.randomUUID()}.${ext}`. Como bucket é privado, o feed usa `createSignedUrl` (1h) para renderizar.

## 3. Frontend — `src/pages/Docs.tsx`

Preservar 100% do design existente. Substituir apenas os dados e handlers:

- Novo hook `useHelpFeed()`:
  - `posts` (join manual: `help_feed_posts` + `profiles` do autor + contagem likes/comments + `liked_by_me`) — 1 query em `help_feed_posts` + 1 em `profiles` por batch de author_ids + 1 em `help_feed_likes` (contagem via `select('post_id', {count})` agregada client-side) + idem comments. Sem N+1.
  - Realtime opcional: `supabase.channel` em `postgres_changes` de posts/likes/comments para atualizar sem reload.
  - Ações: `toggleLike(postId)`, `addComment(postId, text)`, `createPost({content, file?})`, `deleteComment(id)`.
- Composer (área "Share something..."):
  - Renderizar apenas quando `profile.is_admin === true`. Idem botão "Post" do header.
  - Input file oculto, drop zone reaproveitando o mesmo bloco visual, preview inline, botão remover/trocar imagem, texto obrigatório OU imagem obrigatória, botão desabilitado durante submit.
  - Fluxo: upload → obter path → insert post; se insert falhar, `storage.remove([path])`.
  - Feedback via `toast` já existente (pt-BR).
- Comentários: expandir área abaixo do post ao clicar no ícone; lista + textarea + botão "Enviar". Sanitização básica (`.trim()`, limite 2000 chars post / 500 chars comment).
- Estados loading / vazio / erro dentro do mesmo layout (skeletons discretos que respeitam cores atuais).
- Sidebar: trocar item "Hype" por "Tutorial" (ícone `BookOpen` já importado). Estado local `tab: 'feed' | 'tutorial'` controla o conteúdo do painel central sem tocar em rotas.
- Aba Tutorial: lista `help_feed_tutorials` renderizada com os mesmos tokens visuais (cartões `#19191a` / `#0d0d0e`). Admin ganha botão discreto "Novo tutorial" (modal simples reaproveitando o composer).

## 4. Fora do escopo

- Nenhum arquivo fora de `src/pages/Docs.tsx`, novos hooks em `src/hooks/`, novos componentes locais em `src/components/help/` e migrations é alterado.
- `AdminRoute`, `AuthContext`, `DashboardLayout`, sidebar do dashboard e demais páginas ficam intocados.
- Nenhum mock permanece após integração.

## 5. Validação

- Build (`tsgo`) + Playwright headless em `/docs` para: (a) login como admin → publicar texto e texto+imagem, (b) login como user comum → composer oculto e insert manual bloqueado por RLS, (c) curtir/descurtir, (d) comentar, (e) refresh mantendo dados.

Confirma o plano? Depois da aprovação executo migration + storage + código.