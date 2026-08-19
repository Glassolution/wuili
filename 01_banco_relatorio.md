# Relatório — Subagente BANCO (camada de dados/queries)

Data: 2026-08-18
Escopo: `src/hooks`, `src/lib`, `src/integrations/supabase` (chamadas Supabase, hooks de dados, fetch/mutation, tratamento de erro em queries). Nada em `supabase/` (migrations/RLS/edge functions) foi tocado, conforme instrução.

## 1. O que foi investigado

- `src/integrations/supabase/client.ts` (cliente Supabase, modo "desativado" sem env vars, proxy de functions locais, refresh de sessão/JWT expirado) — código bem estruturado, sem achados.
- Todos os hooks de `src/hooks/*.ts` (useFinancialData, useHelpFeed, useSupplierChat, useAiImageQuota, useAccountSuspension, usePlanLimits, useTikTokShop, useActivityTracker, useOnlinePresence, useStartMode, useSupplierEngine, useDashboard).
- `src/lib/*.ts` relacionados a dados (financial.ts, collectionsApi.ts, userProjects.ts, catalogFilters.ts, catalogCategories.ts, notifications.ts, support.ts, storeOverrides.ts, trendingProductMetrics.ts, etc.).
- Rodei `eslint` nas pastas do escopo (sem achados de `no-unused-vars`; só warnings de `@typescript-eslint/no-explicit-any`, que o próprio CLAUDE.md permite com justificativa e já vêm comentados em vários casos — não mexi, seria refactor grande e fora do que foi pedido).
- Rodei `npx vitest run` (suíte inteira) para ter uma baseline.
- Procurei padrões N+1 (loops com `await` de chamada Supabase dentro) e funções/exports não utilizados no restante do `src`.
- Rodei `npm run build` para validar que nada quebrou.

## 2. O que foi corrigido/limpo (executado)

### Removido `src/hooks/useDashboard.ts` (código morto com dados mockados)
- Prova: nenhum import em todo `src` (`grep -rn "hooks/useDashboard" src` e `grep -rln "useDashboard" src` vazios, verificado **antes** de remover).
- O arquivo só exportava hooks (`useLucroTotal`, `useResumoLoja`, `useResumoStatus`, `useResumoCategoria`, `usePedidos`, `useTransacoes`) que devolviam dados hardcoded/zerados — o próprio comentário do arquivo dizia "views not yet created in DB, returning empty/mock data for now". Isso viola a regra do CLAUDE.md "Nunca usar dados mockados na interface", e como não era usado em lugar nenhum, é seguro remover.
- `npm run build` rodou limpo depois da remoção (build completo, sem erros).
- Commit: `93cf94404ed7e36fc23479c41ff3366c0f721f85` — `chore: remove dead useDashboard hooks (unused, mocked data)` (prova: `git log -1 --format=%H` retornou esse hash; `git show --stat` mostra só `src/hooks/useDashboard.ts | 38 -----` deletado).

Só fiz esse commit. Não toquei em `public/.DS_Store` nem em `.playwright-manual-capture.mjs`, que já apareciam modificados/untracked no `git status` antes de eu começar — não são meus, deixei como estavam.

## 3. Achados que precisam da sua aprovação (não executei)

### 3.1. Dois arquivos de teste obsoletos causando 32 falhas na suíte
- `src/lib/financial.bug-condition.test.ts` e `src/lib/financial.preservation.test.ts`.
- São testes exploratórios de uma tarefa antiga de correção de bug (o próprio cabeçalho do primeiro diz literalmente: *"CRITICAL: This test MUST FAIL on unfixed code — failure confirms the bug exists. DO NOT attempt to fix the test or the code when it fails."*). Ele afirma que `financial.ts` e `useFinancialData.ts` **não devem existir** — mas hoje existem e são usados de verdade (`SaldosPage.tsx` importa `useFinancialData`, `getFinancialSummary` etc.). O segundo arquivo (`preservation`) fixava uma "foto" de como `DashboardHomePage`/`SaldosPage`/`ReportsPage` eram *naquele momento* (ex.: espera strings como `RECENT_TRANSACTIONS`, `queryKey dashboard-stats`) — hoje essas páginas foram reescritas de novo (confirmei lendo `ReportsPage.tsx` atual: virou uma página de relatórios de IA via tabela `sales_reports`, sem `mockStats`/`mockOrders`; `DashboardHomePage.tsx` não tem mais `SALES_WEEKLY` nem `mockData`).
- Ou seja: **não é um bug real**, é dívida de teste — os dois arquivos deveriam ter sido apagados quando a correção original foi mesclada, e ficaram esquecidos. Rodei `npx vitest run` e confirmei: 2 arquivos falhando, 32 testes falhando, 106 passando — todos os 32 são desses dois arquivos.
- **Tentei remover** (`git rm` os dois) e a ação foi **bloqueada pelo classificador de permissão do modo automático** ("Blocked by classifier"). Não tentei contornar. Proposta: apagar os dois arquivos de teste. Se preferir, posso reescrevê-los do zero como testes de regressão reais para `financial.ts`/`useFinancialData.ts` (esses sim continuam válidos e têm valor).

### 3.2. Possíveis módulos de dados mortos (não usados em lugar nenhum fora do próprio teste)
Encontrei, via busca de referência em todo `src` (excluindo o próprio arquivo e testes), estes arquivos sem nenhum import de fora:
- `src/lib/coupons.ts`
- `src/lib/aiProductPages.ts`
- `src/lib/trendingProductMetrics.ts` (tem teste próprio `trendingProductMetrics.test.ts`)
- `src/lib/catalogCategories.ts` (tem teste próprio `catalogCategories.test.ts`)
- `src/lib/storeResize.ts` (tem teste próprio `storeResize.test.ts`)
- `src/lib/importedProductsContext.tsx`
- `src/lib/mockData.ts` (dados mockados — se morto, remover também resolve outra violação do CLAUDE.md)
- `src/lib/stripeCheckout.ts`

**Não removi nenhum destes.** Motivo: a maioria foi tocada em 15/08/2026 num commit chamado "Velo v2: restaura a árvore da sessão" — ou seja, parecem parte de uma restauração/retomada de uma branch de trabalho, possivelmente features em andamento (cupons, checkout Stripe, redimensionamento de loja, categorias de catálogo v2) que ainda não foram conectadas à UI, e não código morto de verdade. Como há evidência de outros agentes trabalhando neste mesmo repositório em paralelo agora, e o próprio sistema bloqueou uma remoção de teste por segurança, decidi não arriscar apagar possível trabalho em andamento sem sua confirmação. Recomendo você (ou o agente responsável por essas features) confirmar se algum desses está realmente abandonado antes de remover.

### 3.3. Padrão N+1 em `src/hooks/useSupplierChat.ts` (linha ~72-99)
- `useSupplierThreads` faz **2 queries ao Supabase por fornecedor** (última mensagem + contagem de não lidas) dentro de um `Promise.all(supplierNames.map(async ...))`. Se um usuário tiver muitos fornecedores em `orders.supplier`, isso vira várias chamadas paralelas em vez de 1-2 consultas agregadas.
- Não é grave hoje (na prática cada usuário tem poucos fornecedores — normalmente 1, "C7Drop"), mas é o único N+1 real que encontrei na camada de dados.
- **Não implementei a otimização** porque mudar a forma da query (agregar mensagens/contagens de todos os fornecedores numa única consulta e agrupar no cliente) é uma reescrita que muda a implementação de uma feature de chat com realtime ativo, e eu não tenho como testar contra o Supabase real neste ambiente para garantir que o comportamento fica idêntico. Proposta: se topar, refatoro para buscar `chat_messages` uma vez (com paginação/limite razoável) e agrupar por `supplier_id` no cliente, cortando de `2×N` para 1 query.

## 4. Observação sobre RLS/schema (fora do meu escopo, só sinalizando)
Não encontrei nada na camada cliente que sugira RLS mal configurada (todas as queries que vi filtram por `user_id` do usuário autenticado quando deveriam). Não abri nem editei nada em `supabase/`.

## 5. Resumo de confiança
- Único item que posso afirmar como **concluído e verificado**: remoção de `useDashboard.ts` (build passou, sem referências, commit `93cf94404ed7e36fc23479c41ff3366c0f721f85`).
- Tudo na seção 3 é proposta/observação, não executada — preciso da sua decisão antes de mexer, especialmente porque o item 3.1 já foi bloqueado uma vez pelo sistema e o item 3.2 pode ser trabalho em andamento de outro agente.

---

## 6. Segunda rodada (2026-08-18, modo contínuo)

Antes de começar confirmei `git log --oneline -6`: meu último commit (`93cf9440`) seguia intacto na árvore; dois outros agentes tinham commitado depois dele (`2cec23a7` remoção de templates de produto mortos, `ce2ba9b3` remoção de `console.log` de debug no fluxo `ml-publish`) — nenhum conflito com o meu trabalho. Não toquei nos itens já travados no portão de aprovação (seção 3 acima): não apaguei os testes obsoletos, não mexi nos módulos possivelmente órfãos, não otimizei o N+1 do `useSupplierChat.ts`.

### 6.1. Investigado nesta rodada
- Todos os `catch` da camada de dados em `src/hooks` e `src/lib` (31 ocorrências), procurando erro engolido sem feedback. A maioria é legítima (parse de `localStorage`, bloqueio de autoplay de áudio pelo navegador, corpo de resposta que pode não ser JSON, tracking de afiliado "fire-and-forget") — não mexi nessas.
- Hooks ainda não revisados a fundo na primeira rodada: `usePlanLimits.ts`, `usePlan.ts`, `useTikTokShop.ts`, `useSupplierEngine.ts`, `useOnlinePresence.ts`, `useStartMode.ts`, `useActivityTracker.ts`.
- Chamadas `.single()` em `src/hooks` e `src/lib` (9 ocorrências) — todas são do padrão `insert().select().single()` com `if (error) throw error` logo depois; nenhum problema encontrado.
- `(supabase as any).supabaseUrl` / `.supabaseKey` usados em `useActivityTracker.ts` para montar a URL do `sendBeacon` — conferi no código-fonte do `@supabase/supabase-js` instalado (`node_modules/@supabase/supabase-js/src/SupabaseClient.ts`, linhas 287-288): são parâmetros `protected` do construtor, ou seja, existem como propriedades reais em runtime apesar do TypeScript marcá-los como protegidos. Não é bug, só um cast válido — não mexi.

### 6.2. Corrigido nesta rodada (executado, com prova)

**Bug 1 — `src/hooks/usePlanLimits.ts`: `try` sem `catch` (promise rejeitada sem tratamento) + erro de `user_integrations` ignorado.**
`fetchUsage` tinha `try { ... } finally { setUsageLoading(false) }` — sem nenhum `catch`. Qualquer falha dentro do bloco (ex.: a query de fallback de `user_publications` lançando por erro de rede) virava uma promise rejeitada sem handler, já que o `useEffect` chama `void fetchUsage()`. Além disso, `integrationsResult.error` nunca era checado — se a query de `user_integrations` falhasse, o usuário aparecia com 0 marketplaces conectados, silenciosamente, sem log nenhum.
Corrigi adicionando `catch` (loga e mantém o `usage` no estado anterior/inicial, sem mudar o caminho de sucesso) e um `console.warn` para o erro de `user_integrations` que antes era descartado.
Prova: `npm run build` passou limpo depois da mudança; commit `eb8f3f8730acc4521056a4637ca24e9bbd764592` (`git log -1 --format=%H` confirma).

**Bug 2 — `src/hooks/usePlan.ts`: erros de `subscriptions` e `profiles` completamente ignorados.**
As duas queries (`supabase.from("subscriptions")...` e `supabase.from("profiles")...`) desestruturavam só `data`, nunca `error`. Se a query de `subscriptions` falhasse (rede instável, por exemplo), o código caía direto no fallback de `profiles` como se o usuário simplesmente não tivesse assinatura ativa — um assinante pago podia aparecer como "gratis" por causa de uma falha transitória, sem nenhum log explicando o motivo. Como esse hook alimenta `usePlanLimits`, `useStartMode` e o gate de várias features pagas, o efeito visível seria "sumiço" temporário de acesso pago sem qualquer pista no console.
Corrigi só adicionando `console.warn` para os dois erros — **não mudei a lógica de resolução do plano** (continuar caindo no fallback em caso de erro é uma decisão de produto que não me cabe mudar sozinho; documentei isso como limitação abaixo).
Prova: `npm run build` passou limpo; commit `2e822f84d35436037189300f5ba53eef2d3ee47f`.

Ambos os commits foram `git add` de um arquivo específico por vez (`usePlanLimits.ts` e depois `usePlan.ts`), nunca `-A`/`.`. Rodei `npx tsc --noEmit -p .` (sem erros) e `npm run build` (sem erros) depois de cada mudança.

### 6.3. Achado novo que precisa da sua aprovação (não executei)

**Duplicação de lógica de "qual é o plano do usuário" entre `usePlan.ts` e `useAiImageQuota.ts`.**
Os dois hooks resolvem o plano do usuário de forma independente e com regras diferentes:
- `usePlan.ts`: busca **todas** as assinaturas com status `active/paid/approved/trialing` e escolhe a de **maior ranking** (business > pro > base/go > gratis).
- `useAiImageQuota.ts`: busca **uma única** assinatura com status `active/authorized/trialing/trial`, ordenada por `updated_at` mais recente (`.order("updated_at", ...).limit(1).maybeSingle()`), e usa `normalizePlanName` de `planLimits.ts` (mapeamento diferente do `NORMALIZE` interno de `usePlan.ts`).
Isso significa que, num caso de borda (ex.: usuário com duas assinaturas — uma Pro mais antiga e uma Base mais recente, ambas "válidas"), o dashboard geral (via `usePlan`) mostraria "Pro" enquanto o contador de cota de imagens de IA (via `useAiImageQuota`) mostraria "Base" — dois lugares da UI discordando sobre o plano do mesmo usuário. O comentário no próprio `useAiImageQuota.ts` diz que quem bloqueia de verdade é a edge function (service role), então não é um risco de segurança, mas é uma inconsistência visual real.
**Não mexi nisso.** Unificar exigiria decidir qual das duas regras de resolução é a "certa" e trocar `useAiImageQuota.ts` para reusar `usePlan()` — uma mudança de comportamento real que prefiro não fazer sem sua confirmação, já que não tenho como validar contra dados reais do Supabase neste ambiente.

### 6.4. Resumo de confiança desta rodada
- 2 commits, ambos com `npm run build` e `npx tsc --noEmit` limpos depois da mudança — não rodei os hooks contra o Supabase real (sem ambiente de dev conectado aqui), então não posso confirmar em runtime que o `console.warn`/`console.error` dispara exatamente como esperado em produção; só posso garantir que o código compila e que a lógica do caminho de sucesso (sem erro) ficou idêntica à anterior.
- 1 achado novo (duplicação `usePlan` vs `useAiImageQuota`) registrado como proposta, não executado.

---

## 7. Nova frente de investigação (2026-08-18) — Importação, filtro de qualidade, preço, segurança do Atlas

Antes de começar: `git log --oneline -5` mostrou `cf8597be` (merge de `origin/main`) no topo, com meus commits das rodadas anteriores (`2e822f84`, `eb8f3f87`) intactos logo abaixo; `git status --short` só tinha os arquivos de sempre que não são meus (`.DS_Store`, `.playwright-manual-capture.mjs`, relatórios de outros subagentes). Árvore limpa e sincronizada, segui em frente.

**Sobre acesso a dados reais:** o `.env` deste projeto só tem a chave `anon`/`publishable` (`VITE_SUPABASE_PUBLISHABLE_KEY`), não uma `service_role`. Usei-a para 2 leituras via `curl` direto no REST do Supabase (só `GET`, nunca escrevi nada) — documentado no item 1. Para várias das perguntas abaixo (contagem exata de produtos com preço divergente, existência real de um cron no `cron.job`, etc.) a resposta definitiva exige acesso que não tenho neste ambiente (`service_role` ou o painel do Supabase); onde isso limitou a certeza da conclusão, deixei isso explícito em vez de inventar um número.

**Nada foi executado nesta seção.** Os 4 pontos abaixo caíram inteiramente no portão de aprovação: os itens 1, 2 e 3 porque toda correção real está em `supabase/` (cron, edge function) — só investiguei/li, não criei nem editei nenhum arquivo em `supabase/`; o item 4 porque a instrução foi explícita (investigação e proposta apenas, sem exceção, nem client-side).

---

### 7.1. Importação diária (C7Drop) — cron não está agendado

**Investigado:** toda a pasta `supabase/migrations/` (todo arquivo que menciona `cron`, case-insensitive) e `supabase/config.toml`, atrás de qualquer `cron.schedule(...)` que chame `scrape-c7drop`. Também conferi se há agendamento fora do Supabase (Vercel cron, GitHub Actions) e o próprio código do `scrape-c7drop` para a lógica de upsert/duplicação.

**Prova real:**
- `supabase/config.toml` só tem `project_id = "nqzpoioxvbqavrtphtoa"` — nenhuma seção de agendamento de function ali.
- Busquei `cron.schedule(` em todas as 60+ migrations (`grep -rn "cron.schedule(" -A2 supabase/migrations/*.sql`). Existem exatamente 4 jobs agendados no histórico de migrations: `scrape-b2drop-every-12h` (migration `20260620200907...sql`), `close-stale-support-tickets` (`20260731112500...sql`, reagendado em `20260811194159...sql`), `ml-sync-listings-status-hourly` (`20260810010239...sql`) e `ml-sync-stock-6h` (`20260814220142...sql`). **Nenhum deles chama `scrape-c7drop`.**
- O único cron que já existiu para importar catálogo chamava `scrape-b2drop` (fornecedor **B2Drop**, `SOURCE = "b2drop"` em `supabase/functions/scrape-b2drop/index.ts:13`, scraping de `app.sistemab2drop.com.br` — um fornecedor diferente do C7Drop, não é o mesmo scraper renomeado). Esse job foi **desagendado** na migration `supabase/migrations/20260630043000_disable_legacy_cj_jobs.sql`, que o tratou como parte da limpeza de crons legados da CJ (`cron.unschedule('scrape-b2drop-every-12h')` na mesma lista de `cj-tracking-sync`, `cj-sync`, etc. — apesar do comentário da própria migration dizer "Não altera o scraper C7Drop", o job desativado nunca foi o do C7Drop, foi o do B2Drop).
- `supabase/functions/ml-sync-stock/index.ts:3-5` comenta que o estoque sincronizado "já atualizado pelo scrape-c7drop em catalog_products" — ou seja, o próprio código assume que scrape-c7drop roda periodicamente, mas não há nenhum job que garanta isso.
- `find .github -type f` → vazio (sem GitHub Actions). `vercel.json` não tem `crons`. `grep -rln "scrape-c7drop"` fora de `supabase/functions/scrape-c7drop` só aparece em um comentário do `ml-sync-stock`, nunca numa chamada real.
- Tentei confirmar isso com dados reais: `curl` no REST do Supabase com a chave anon para `catalog_products` devolveu `content-range: */0` (zero linhas, para qualquer `source`). Isso **não** é evidência de tabela vazia — é porque a migration `supabase/migrations/20260712040858_c9836221-667e-41fb-826c-d2556357e6f4.sql` revogou `SELECT` do `anon` nessa tabela por segurança (`REVOKE SELECT ON public.catalog_products FROM anon`, linha 167 — mudança correta e intencional, não é bug). Sem `service_role` ou uma sessão de usuário autenticado, não consigo inspecionar as linhas reais de `catalog_products` a partir daqui.

**Sobre duplicação:** a lógica de upsert em `scrape-c7drop/index.ts:371` usa `.upsert(slice, { onConflict: "source,external_id" })`, que casa com o índice único `catalog_products_source_external_id_key` criado em `20260620200907...sql:9-10`. Pela leitura do código, **não há caminho para duplicar produtos** quando a function roda — cada slug da C7Drop (`external_id = detail.slug`) sempre atualiza a mesma linha. Isso é uma conclusão de leitura de código, não testei rodando a function de verdade.

**Conclusão:** não achei duplicação, mas achei um problema mais sério — **é bem provável que a importação diária simplesmente não esteja rodando há semanas**, porque nenhuma migration jamais agendou `scrape-c7drop`, e o único cron de catálogo que existiu foi desligado em 30/06 (achando que era da CJ). **Ressalva importante:** encontrei neste mesmo repositório pelo menos 2 crons que existem no `cron.job` real do Postgres mas nunca foram criados via migration (`aliexpress-sync-every-6h` e `payments-reconcile-every-5min`, referenciados só em funções que os `ALTER`/consultam status, nunca um `CREATE` — ver `supabase/migrations/20260722222534...sql` e `20260808024255...sql`) — ou seja, é comprovado que este projeto tem histórico de crons criados direto pelo painel do Supabase, fora do controle de versão. Não posso então garantir 100% que não exista um `scrape-c7drop` agendado assim; só posso garantir que não há **nenhuma evidência em código** de que exista.

**Proposta (portão de aprovação — não executei, é mudança em `supabase/`):**
1. Verificar direto no painel do Supabase (Database → Cron Jobs, ou `select * from cron.job` com a service role) se existe algum job ativo chamando `scrape-c7drop` que eu não consegui ver pelas migrations.
2. Se não existir, criar uma migration nova (fora do escopo do que eu posso tocar) agendando algo como:
   ```sql
   SELECT cron.schedule(
     'scrape-c7drop-daily',
     '0 6 * * *',  -- uma vez por dia, ajustável
     $$ SELECT net.http_post(
       url := 'https://nqzpoioxvbqavrtphtoa.supabase.co/functions/v1/scrape-c7drop',
       headers := '{"Content-Type":"application/json","apikey":"<anon key>"}'::jsonb,
       body := '{"trigger":"cron"}'::jsonb
     ); $$
   );
   ```
   (mesmo padrão usado para os outros jobs `ml-sync-*`).

---

### 7.2. Filtro de qualidade antes de publicar no Mercado Livre — existe um caminho real que pula o filtro

**Investigado:** `supabase/functions/_shared/catalog-filters.ts` (filtros compartilhados: `BLOCKLIST` de conteúdo adulto, `isFakeAdProduct`, `hasEnoughImages`), `supabase/functions/scrape-c7drop/index.ts` (onde os filtros são aplicados na importação), `supabase/functions/ml-publish/index.ts` (1808 linhas — a function que efetivamente publica no ML) e os dois lugares do client que chamam `ml-publish`: `src/components/dashboard/ImportProductModal.tsx` e `src/components/dashboard/OwnProductsPanel.tsx`.

**Critérios que existem hoje, e onde:**
- Na **importação** (`scrape-c7drop/index.ts:174-234`, função `buildRowFromDetail`): `isFakeAdProduct` (descarta "Anúncios em Massa"), `isBlocked` (blocklist de termos adultos) + `!hasEnoughImages` → grava a linha com `is_blocked: true` em vez de descartar. `hasEnoughImages` exige no mínimo 3 imagens (`MIN_PRODUCT_IMAGES`, `catalog-filters.ts:180-182`).
- Na **listagem do catálogo** (`supabase/functions/catalog/index.ts:50-52`): a query que serve o catálogo pro frontend filtra `.eq("is_active", true).eq("is_blocked", false).gt("stock_quantity", 0)` — é aqui que os produtos bloqueados/sem estoque somem da vitrine que o usuário navega.
- No **client, ao abrir o modal de publicação** (`ImportProductModal.tsx:377,509,690`): só verifica `stock_quantity > 0` (`hasStock`) antes de deixar avançar/publicar. **Não existe nenhuma verificação de `is_blocked` no client** — e nem poderia: o tipo `CatalogProduct` (`ImportProductModal.tsx:20-37`) nem tem o campo `is_blocked`, porque o produto que chega até aqui já veio pré-filtrado da query do `catalog`.
- No **`ml-publish` (server, quem realmente publica)**: `grep -n "is_blocked|stock_quantity|hasEnoughImages|isBlocked|is_active|isFakeAdProduct|BLOCKLIST"` não deu **nenhum resultado relevante** — zero ocorrências desses critérios. O que `ml-publish` valida (linhas 583-601) é só: `product.title` presente, `product.price > 0`, e no mínimo 3 imagens públicas (`MIN_REQUIRED_IMAGES = 3`, recontando as imagens do payload). O objeto `product` inteiro vem direto do corpo da requisição (`const { product } = body`, linha 584) — **nunca é re-buscado do banco** para conferir `is_blocked`/`is_active`/`stock_quantity` reais de `catalog_products` no momento da publicação.

**O caminho que pula o filtro:** o filtro de bloqueio (blocklist adulto, "anúncio em massa", galeria incompleta) só é aplicado **uma vez, na importação/scrape**, e reforçado **uma vez, na listagem do catálogo** (`is_blocked = false` na query). Ele nunca é reconferido no momento da publicação. Isso é uma janela clássica de TOCTOU (time-of-check/time-of-use): se um produto que o usuário já tinha aberto no modal (ou que ficou em cache do React Query) for marcado `is_blocked = true` por um re-scrape posterior — ex.: uma atualização da `BLOCKLIST`, ou o produto perdeu imagens no fornecedor e caiu abaixo de 3 —, nada no `ml-publish` impede que ele seja publicado mesmo assim, porque o server confia inteiramente nos dados que o client mandou. O mesmo vale para `stock_quantity`: o client só confere uma vez, ao abrir o modal (linha 376-377), com o valor que tinha na hora; se o produto zerar estoque enquanto o modal está aberto, o `ml-publish` também não reconfere.

**Por que não implementei um band-aid no client:** dava para adicionar uma checagem de `is_blocked` no `ImportProductModal.tsx`, mas isso não fecha a brecha de verdade — quem chamar `ml-publish` direto (via `curl`/replay, ignorando o client) continua passando por cima de qualquer checagem que só exista no frontend. A correção correta é uma fonte única de verdade no server, e isso está em `supabase/functions/`, fora do que posso tocar. Adicionar uma checagem client-side redundante também vai contra o reforço de prioridade desta rodada (menos duplicação de lógica em dois lugares).

**Proposta (portão de aprovação — mudança em `supabase/functions/ml-publish/index.ts`):** logo após validar `product.title`/`product.price` (por volta da linha 583-601), quando o payload trouxer um `catalog_product_id`/`external_id` reconhecível, buscar a linha real em `catalog_products` (`source, external_id`) via o client `service_role` que a function já usa, e recusar a publicação (mesmo padrão de erro 400 já usado ali) se `is_blocked = true`, `is_active = false`, ou `stock_quantity <= 0` — junto de um log claro pra facilitar auditoria futura. Isso fecha a brecha de forma centralizada, sem duplicar a lista de regras no client.

---

### 7.3. Paridade de preço C7Drop — preço fica congelado, sem re-sync

**Investigado:** `scrape-c7drop/index.ts` (como o preço é calculado e gravado), se existe alguma function/cron de re-sync de preço, e o que acontece com o preço já publicado no Mercado Livre depois da publicação inicial.

**Prova real:**
- O preço só é escrito em `catalog_products` dentro de `buildRowFromDetail` (`scrape-c7drop/index.ts:129-138,180,217-219`): `cost_price` vem de `extractDropshippingPrice(detail)` (a variante "Dropshipping" do produto na C7Drop, ou `detail.price` como fallback) e `suggested_price = cost_price * 2`. Isso só acontece quando a function roda no modo `full` (o modo padrão) — o modo `backfill_images` **explicitamente não toca preço** (comentário no topo do arquivo, linhas 20-23: "só atualiza `images`... preservando preço/título/link/estoque/etc").
- Busquei qualquer outro lugar que atualize `cost_price`/`suggested_price`/`price` de `catalog_products` fora do scrape: `grep -rln "price" supabase/functions/ml-sync-*` só achou `ml-sync-orders` (que grava o preço de **pedidos**, não do catálogo) — `ml-sync-stock` (o único cron ativo relacionado a C7Drop hoje, `ml-sync-stock-6h`) só sincroniza estoque, nunca preço (confirmei com `grep -n "price" supabase/functions/ml-sync-stock/index.ts` → vazio). Não existe nenhuma function `*reprice*`/`*price-sync*` no projeto.
- Depois de publicado no Mercado Livre, procurei qualquer chamada de atualização de preço do anúncio (`PUT`/`PATCH` em `api.mercadolibre.com/items/...` alterando `price`) fora da criação inicial em `ml-publish` — não encontrei nenhuma. O preço do anúncio publicado também fica congelado no valor de quando foi publicado, a menos que alguém edite manualmente no Mercado Livre.

**Conclusão — isso está diretamente ligado ao achado do item 7.1:** como não há cron rodando `scrape-c7drop` em modo `full`, o preço de `catalog_products` só é atualizado quando alguém dispara a function manualmente. Ou seja, "o preço desatualiza depois" não é bem a pergunta certa — a pergunta é "quando foi a última vez que alguém rodou isso manualmente", e eu não tenho como saber (precisaria de `service_role` pra consultar `MAX(scraped_at)` em `catalog_products`, que não tenho aqui). **Não consigo quantificar quantos produtos têm preço divergente hoje** — só posso afirmar, pela leitura do código, que não existe nenhum mecanismo automático que mantenha esse preço em dia, nem antes nem depois da publicação.

**Proposta (portão de aprovação — mesma raiz do item 7.1, mudança em `supabase/`):**
1. Resolver o item 7.1 (agendar `scrape-c7drop` em modo `full`) já cobre a maior parte disto — preço de catálogo passaria a se atualizar periodicamente.
2. Adicionalmente, considerar um job (ou reaproveitar `ml-sync-stock-6h`) que, quando o `cost_price` do fornecedor mudar significativamente para produtos já publicados, sinalize ou ajuste o preço do anúncio ativo no Mercado Livre — hoje isso não existe em lugar nenhum, e sem ele um produto pode ficar publicado com preço de custo desatualizado por tempo indefinido (risco de vender no prejuízo se o fornecedor subir o preço, ou de ficar fora de mercado se ele baixar).
3. Antes de desenhar a solução definitiva, recomendo rodar no painel do Supabase: `select count(*), max(scraped_at), min(scraped_at) from catalog_products where source = 'c7drop'` para saber a idade real dos dados hoje.

---

### 7.4. Segurança do Atlas (aquas_conversations / aquas_messages / aquas_actions) — **SOMENTE PROPOSTA, NADA EXECUTADO**

**Reforçando conforme pedido: este item é investigação e proposta apenas. Não toquei em nenhum código, cliente ou servidor, relacionado a isto.**

**Investigado:** todas as ocorrências de `aquas_conversations`/`aquas_messages`/`aquas_actions`/`atlas_threads`/`atlas_messages` em `supabase/functions`, `supabase/migrations` e `src`; as duas edge functions que atendem o assistente (`atlas-chat`, usada pela tela principal `/dashboard/atlas`, e `atlas-search`, usada pelo widget `ProductScoutAI.tsx`); RLS das tabelas envolvidas; e como cada client monta a requisição.

**O que encontrei — dois sistemas diferentes por baixo do nome "Atlas":**
1. **`atlas_threads` / `atlas_messages`** (tabelas reais e atuais, confirmadas em `src/integrations/supabase/types.ts`, regenerado hoje 2026-08-18) — usadas por `AtlasChatContext.tsx`/`AtlasChatPage.tsx`, atendidas pela function **`atlas-chat`** (1918 linhas). RLS correta: `supabase/migrations/20260627013112...sql:13,27` cria as policies `"atlas_threads owner"` e `"atlas_messages owner"`, ambas `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)`. A function **valida autenticação corretamente**: `atlas-chat/index.ts:633-646` lê o header `Authorization`, cria um client Supabase escopado a esse header e chama `supabase.auth.getUser(token)` para obter o `user_id` real — o mesmo padrão correto usado em `ml-publish`. **Não encontrei problema de isolamento aqui.**

2. **`aquas_actions`** (tabela criada em `supabase/migrations/20260704171000_create_aquas_actions.sql`, com RLS `"Users can view/insert/delete own Aquas actions"` corretamente escopada por `auth.uid() = user_id`) — usada pela function **`atlas-search`** (1011 linhas, chamada só por `src/components/dashboard/ProductScoutAI.tsx:452`). Só que `aquas_actions` **não aparece em `src/integrations/supabase/types.ts`** (regenerado hoje, reflete o schema real do projeto) — ou seja, é bem provável que essa tabela nunca tenha sido de fato aplicada no banco de produção, ou tenha sido removida depois. Também não achei `aquas_conversations`/`aquas_messages` em lugar nenhum do código (nem migrations, nem functions, nem types.ts) — a function só referencia um `conversation_id` solto (string vinda do client) que seria a FK pra uma tabela `aquas_conversations` que a própria migration trata como opcional (`if to_regclass('public.aquas_conversations') is not null` — ou seja, o autor da migration já sabia que ela podia não existir).

**O achado sério — `atlas-search` não autentica o chamador:**
`supabase/functions/atlas-search/index.ts` **nunca lê o header `Authorization` e nunca chama `auth.getUser()`** (conferi o arquivo inteiro, 1011 linhas — zero ocorrências). Em vez disso:
- Usa um client Supabase com a **`service_role`** key (`index.ts:569-570`), que ignora RLS por completo.
- Determina de quem são os dados a consultar por `userContext.id`, lido direto do corpo JSON que o client manda (`readUserContext(body?.user_context)`, `index.ts:156-164`), **sem qualquer verificação de que esse id corresponde ao dono do token da requisição**.
- O client normal (`ProductScoutAI.tsx:459-463`) manda `user_context: { id: user?.id, name: userName, email: user?.email }` — o `id` da sessão local, o que funciona no fluxo legítimo. Mas nada no server impede que outra requisição HTTP (via `curl`, com a `anon key` pública — que já está embutida no bundle do client e é conhecida por qualquer um, e passa na verificação de JWT da plataforma Supabase por padrão) mande um `user_context.id` de **qualquer outro usuário**.
- Com um `user_context.id` forjado, a function usa esse valor para:
  - `getUserMlStatus(supabase, userContext.id)` (`index.ts:450-473`) → lê `user_integrations` (`access_token, expires_at, updated_at, created_at, platform`) de **qualquer usuário**, devolvendo se está conectado ao ML e se o token é válido (não devolve o token em si, mas devolve o status).
  - `getUserPublishedProducts(supabase, userContext.id)` (`index.ts:475-491`) → lê até 10 `user_publications` (**`id, title, status, price, published_at, permalink`**) de **qualquer usuário** — isso é um vazamento real de dados de outra conta: título, preço e status dos anúncios mais recentes de outra pessoa.
  - Em modo `"general"` ou `"chat"`, esses dados entram direto no prompt do modelo de IA (`index.ts:686-713`) e voltam na resposta pro chamador — ou seja, um atacante pode literalmente perguntar ao Atlas "qual meu status" fingindo ser outro usuário e receber de volta, em texto, informação real da conta da vítima.
  - `logAction(supabase, userContext.id, ...)` (`index.ts:430-448`) insere em `aquas_actions` com `user_id` arbitrário — mas como visto acima, é bem provável que essa tabela nem exista de verdade hoje, então esse `insert` específico provavelmente já está falhando silenciosamente (`if (error) console.warn(...)`, linha 447) a cada chamada, sem quebrar o resto do fluxo. Isso não muda a gravidade do vazamento de leitura acima, que não depende de `aquas_actions` existir.
- Essa mesma falta de autenticação faz `atlas-search` responder mesmo sem nenhum usuário logado (`userText` vazio é o único 400 retornado antes de qualquer checagem de identidade) — a única barreira é a verificação de JWT padrão da plataforma Supabase Edge Functions (`verify_jwt`), que aceita a própria `anon key` pública como válida.

**Sobre o outro ponto pedido (validação do que o usuário manda pra IA / manipular a IA pra sair do escopo):** os system prompts (`index.ts:309-314,337-348,691-715,739-757`) já têm instruções razoáveis contra alucinação e vazamento ("Nunca invente...", "Nunca peça senhas ou tokens", "Nunca cite CJ Dropshipping"). A IA não executa nenhuma ação privilegiada de verdade por conta própria — os `actions` que ela retorna (`navigate`/`diagnose`/`publish_start`) são só sugestões de UI pro frontend; a publicação real continua exigindo passar pelo fluxo normal (`ml-publish`, que autentica corretamente). Não achei um caminho onde a IA em si execute algo fora do escopo — o risco concreto e comprovado é o vazamento de dados entre usuários descrito acima, que é um bug de autenticação do endpoint, não da IA em si.

**Proposta (portão de aprovação — mudança em `supabase/functions/atlas-search/index.ts`, NÃO EXECUTADA):**
1. Adicionar exatamente o mesmo padrão já usado em `atlas-chat/index.ts:633-646` e em `ml-publish`: ler `Authorization` do header, criar um client escopado a esse header, chamar `auth.getUser()` e usar **esse** `user_id` (nunca o `userContext.id` vindo do body) em `getUserMlStatus`, `getUserPublishedProducts` e `logAction`. Continuar aceitando `user_context.name`/`email` do body só para personalização de tom (não para autorização).
2. Confirmar no painel do Supabase se `aquas_actions`/`aquas_conversations` realmente existem hoje; se não existirem, decidir se a feature de log/histórico do Aquas deve ser recriada do zero ou se essas referências devem ser removidas (a migration `20260704171000...sql` já lida bem com a ausência de `aquas_conversations`, mas vale confirmar o estado real).
3. Depois de corrigido, testar manualmente que uma chamada com `user_context.id` de outro usuário deixa de devolver dados desse usuário.

### 7.5. Resumo de confiança da seção 7
- Nenhum commit nesta seção — os 4 pontos investigados apontam para mudanças em `supabase/` (cron, edge functions) ou foram explicitamente marcados como "proposta apenas" (item 4).
- Tudo que afirmo como fato vem de leitura direta de código/migrations com citação de arquivo:linha, ou de uma consulta `curl` read-only documentada. Onde a certeza depende de dados que não consigo acessar sem `service_role` (contagem real de produtos, existência de cron fora de migrations, idade real dos dados), deixei isso marcado explicitamente em vez de estimar.

---

## 8. Aprovação concedida — correção aplicada em `atlas-search` + investigação extra de exposição de `user_id` (2026-08-18)

Antes de começar: `git log --oneline -5` mostrava `cf8597be` no topo com meus commits anteriores (`2e822f84`, `eb8f3f87`) intactos; `git status --short` só tinha os arquivos de sempre que não são meus. Árvore limpa, segui em frente.

### 8.1. Tarefa 1 — corrigido: `atlas-search` agora autentica o chamador

**O que mudou** (`supabase/functions/atlas-search/index.ts`): adicionei `authenticateRequest(req)` — mesmo padrão exato já usado em `atlas-chat/index.ts:632-648`: lê o header `Authorization`, cria um client Supabase escopado a esse header com a `SUPABASE_ANON_KEY`, chama `auth.getUser(token)` e devolve o `user_id` real (ou `null`). No topo do handler `serve()`, antes de qualquer outra coisa (inclusive antes de fazer `req.json()` do corpo), chamo essa função e devolvo `401 {"error":"Não autorizado"}` se não houver sessão válida — mesmo formato de erro já usado no resto do projeto. Troquei as **10 ocorrências** de `userContext.id` que alimentavam `getUserMlStatus`, `getUserPublishedProducts` e `logAction` por `authenticatedUserId` (o valor derivado do token, não mais do corpo da requisição). `userContext.name`/`userContext.email` continuam vindo do body sem alteração — são usados só para personalizar o tom da IA (`userContextLine`), nunca para autorização; confirmei isso relendo todos os usos restantes de `userContext` no arquivo depois da mudança.

**Prova real:**
- `deno check supabase/functions/atlas-search/index.ts` (deno disponível em `/opt/homebrew/bin/deno`) → 15 erros, todos `TS2345`/`TS2538` de uma incompatibilidade de generics pré-existente em `SupabaseClient<...>` (nada relacionado à minha mudança). Comparei rodando `deno check` na versão original do arquivo (`git show cf8597be:supabase/functions/atlas-search/index.ts`) — **exatamente os mesmos 15 erros, mesmos códigos, mesmas linhas relativas** (`14 TS2345 + 1 TS2538` nos dois). Ou seja, minha mudança não introduziu nenhum erro novo de tipagem; os 15 já existiam antes.
- `git diff --stat` antes do commit: `1 file changed, 43 insertions(+), 11 deletions(-)`.
- Commit: `b5643859e2f787f32f603025a6e7e55e2a32c5b8` (`git log -1 --format=%H`), mensagem `fix(security): atlas-search now authenticates the caller instead of trusting body`. Só esse arquivo foi staged (`git add supabase/functions/atlas-search/index.ts`), nada mais.
- **Limitação honesta:** não tenho como rodar a function de verdade contra o Supabase real neste ambiente (não tenho `service_role`, nem consigo fazer deploy/invoke autenticado daqui) — não posso confirmar em runtime que uma chamada sem `Authorization` realmente recebe 401 em produção, nem que uma chamada com token válido continua funcionando normalmente. O que posso garantir é: a lógica está no mesmo padrão comprovado que já roda em produção em `atlas-chat` (que usa exatamente essa função `authenticateRequest`, só copiei o padrão), a tipagem não regrediu, e a leitura linha a linha do diff confere com o que foi pedido. Recomendo testar manualmente (chamando a function com e sem token, e com `user_context.id` de outro usuário) antes de considerar 100% validado em produção.
- Não toquei em mais nada em `supabase/` — só este arquivo.

### 8.2. Tarefa 2 — investigação extra: `user_id` de outro usuário É exposto publicamente (achado confirmado, só leitura, não corrigido)

**Investigado:** todo lugar em `src/pages` que serve páginas públicas sem login (`PublicStorePage.tsx`, `PublicStoreCatalogPage(2).tsx`, `PublicStoreAccountPage(2).tsx`, `PublicProductPage(2).tsx`, `PublicStoreTemplateDispatcher.tsx`, `public-sales/salesPageData.ts`), o helper `fetchPublicProject`/`get_public_project` que todas essas páginas usam (`src/lib/userProjects.ts:200-215`), e — por comparação — todas as outras funções `SECURITY DEFINER` do projeto liberadas para `anon` (procurei `grep -rl "SECURITY DEFINER" supabase/migrations/*.sql | xargs grep -l "TO anon"`, 9 migrations no total), pra ver se o mesmo padrão se repete em outro lugar.

**Achado: sim, `user_id` vaza.** `supabase/migrations/20260716140000_public_project_read.sql:5-18` define:
```sql
CREATE OR REPLACE FUNCTION public.get_public_project(p_slug text)
RETURNS public.user_projects          -- tipo linha inteira da tabela
...
AS $$
  SELECT p.*                          -- todas as colunas, incluindo user_id
  FROM public.user_projects p
  WHERE p.metadata->>'slug' = p_slug AND p.status = 'publicado' ...
$$;
...
GRANT EXECUTE ON FUNCTION public.get_public_project(text) TO anon, authenticated, service_role;
```
Essa RPC é `SECURITY DEFINER` (contorna o RLS "owner-only" de `user_projects` de propósito, pra servir a loja pública sem login) e devolve `RETURNS public.user_projects` com `SELECT p.*` — **a linha inteira da tabela**, que inclui a coluna `user_id` (confirmado que a tabela tem essa coluna: é ela quem é gravada em `src/lib/userProjects.ts:94`, `user_id: user.id`, e o tipo `UserProject` do client é `Omit<Tables<"user_projects">, "tipo_projeto" | "status">` — não faz `Omit` de `user_id`). Está liberada pra `anon` — ou seja, **qualquer visitante não-logado de qualquer loja publicada da Velo** (`/loja/:slug`) consegue o `user_id` (UUID) do dono da loja, de duas formas:
1. Abrindo o DevTools → aba Network em qualquer `/loja/:slug` publicada — a resposta crua da chamada RPC (que o client dispara via `supabase.rpc("get_public_project", ...)`, `src/lib/userProjects.ts:202`) vem com `user_id` no JSON.
2. Chamando a RPC direto, sem nem visitar o site: `POST https://nqzpoioxvbqavrtphtoa.supabase.co/rest/v1/rpc/get_public_project` com `apikey`/`Authorization` = a chave anon pública (a mesma embutida no bundle do client, em `src/integrations/supabase/client.ts:7`) e `{"p_slug": "<slug-de-qualquer-loja-publicada>"}`.

Confirmei que esse é o helper usado por **todas** as páginas públicas de loja (`grep -rln "fetchPublicProject|get_public_project" src` → `PublicStorePage.tsx`, `PublicStoreCatalogPage.tsx`, `PublicStoreCatalogPage2.tsx`, `PublicStoreAccountPage.tsx`, `PublicStoreAccountPage2.tsx`, `PublicProductPage.tsx`, `PublicProductPage2.tsx`, `PublicStoreTemplateDispatcher.tsx`, `public-sales/salesPageData.ts`) — não é um caso isolado, é o caminho padrão de toda loja publicada.

**Por comparação, o resto do projeto faz certo:** as outras RPCs públicas que achei (`get_public_store_products` — `supabase/migrations/20260716214500_public_store_products_read.sql:18` — e `get_customer_orders` — `20260721144609...sql:2-11`) usam `RETURNS TABLE(...)` com uma lista explícita de colunas (sem `user_id` em nenhuma delas), o padrão certo de "whitelist" em vez de `SELECT *`. `get_public_project` é a única exceção que achei — o autor provavelmente só queria devolver "o projeto inteiro" pra não ter que manter duas listas de campos (o editor logado usa o mesmo tipo `UserProject`), mas isso vazou a coluna errada junto.

**Não tentei confirmar isso com uma chamada `curl` de verdade** porque isso exigiria eu descobrir/adivinhar o slug de uma loja publicada real de um usuário de verdade — o que seria testar contra dado de produção de terceiro sem necessidade, quando a prova pelo código-fonte (definição da function + grant) já é inequívoca e não deixa margem para interpretação (o `RETURNS`/`SELECT *`/`GRANT ... TO anon` estão ali, não há ambiguidade sobre o que a function devolve). Se quiser uma confirmação ao vivo, posso repetir com o slug de uma loja publicada que você indicar.

**Gravidade:** menor que o achado do item 7.4 (não expõe token nem permite ação em nome de outro usuário) mas ainda é uma exposição real de PII (UUID interno de conta) de qualquer lojista da Velo pra qualquer visitante anônimo, sem precisar de conta nem login — e, coincidentemente, é exatamente o tipo de dado (`user_id` de outra pessoa) que o problema do item 7.4 dependia de "adivinhar"; aqui ele não precisa nem adivinhar, está público. Vale como argumento a mais a favor de aprovar aquele fix (já aplicado) e considerar também corrigir esta RPC.

**Não corrigi nada disto** — Tarefa 2 foi só leitura, como pedido, e além disso seria uma segunda mudança em `supabase/` sem aprovação explícita para este arquivo específico.

**Proposta (ainda no portão de aprovação, não executada):** trocar `get_public_project` de `RETURNS public.user_projects` / `SELECT p.*` para `RETURNS TABLE(...)` com uma lista explícita de colunas — as mesmas que `PublicStorePage.tsx` e as outras páginas públicas realmente usam (nome, slug, template, tema, seções, overrides, etc.) — excluindo `user_id` (e qualquer outra coluna sensível que não deveria ser pública, vale conferir a lista completa de `user_projects` antes de decidir o whitelist final).

### 8.3. Resumo de confiança da seção 8
- 1 commit real (`b5643859e2f787f32f603025a6e7e55e2a32c5b8`), validado com `deno check` comparando antes/depois (zero erros novos) e revisão manual linha a linha contra o padrão de `atlas-chat`. Não pude validar em runtime contra o Supabase real — deixei isso explícito acima.
- 1 achado novo confirmado por leitura de código (exposição de `user_id` via `get_public_project`), com proposta registrada, nada executado.

---

## 9. Terceira rodada do modo contínuo (2026-08-19)

Antes de começar: `git log --oneline -8` mostrou `c3ea6a06`/`17a8c335`/`68578cb4`/`259a8584` no topo (a correção de segurança aprovada `b5643859` e os merges/fixes que você fez desde então), `git status --short` só com os arquivos de sempre que não são meus. Árvore limpa e sincronizada. Não toquei em nada da lista travada no portão de aprovação (`00_maestro_relatorio.md`): cron do `scrape-c7drop`, revalidação do `ml-publish`, `get_public_project`, os 2 testes obsoletos, a página órfã com debug, os componentes desconectados, a página de redesign, o N+1 do `useSupplierChat`, pacotes não usados, duplicação `usePlan`/`useAiImageQuota`.

**Áreas novas investigadas nesta rodada:** todos os hooks de `src/hooks` já tinham sido revisados em rodadas anteriores (confirmei relendo a lista — nenhum arquivo novo apareceu). Ampliei para `src/contexts` (nunca revisado antes) e para os arquivos de `src/lib` que ainda não tinham sido lidos por completo:
- `src/contexts/AuthContext.tsx` — tem o comentário `// NÃO MODIFIQUE ESTE ARQUIVO — qualquer alteração quebra a autenticação global` na primeira linha. Só li, não toquei em nada, mesmo achando algo digno de nota: a resolução de `role` (linhas 129-138) consulta `profiles.role` por `user_id`, `profiles.role` por `id` e `user_roles.role` por `user_id`, em paralelo — sugere que a tabela `profiles` teve sua coluna-chave renomeada em algum momento e o código ainda cobre as duas hipóteses. Mesmo padrão de fallback `user_id`/`id` aparece de novo em `src/lib/notifications.ts:117-137` (`saveNotificationPreferences`). Não é um bug, é uma decisão defensiva deliberada — só registrando para contexto, não é algo que eu deva "consolidar" sem entender por que a ambiguidade existe (pode ser um caso real de dado legado).
- `src/contexts/AtlasChatContext.tsx` (728 linhas) — todo o fluxo de `enviar`/`abrirConversa` (grava em `atlas_threads`/`atlas_messages`, chama a function `atlas-chat`) já verifica `error` em cada chamada e propaga via `try/catch` com toast. Não achei erro engolido.
- `src/lib/atlasHistory.ts` — trivial (só chaves de query), nada a revisar.
- `src/components/dashboard/AtlasHistoryMenu.tsx` — a query de lista de conversas e o `deleteMutation` (apaga mensagens antes da thread, evitando depender do `ON DELETE CASCADE`) tratam erro corretamente em cada etapa.
- `src/lib/mercadoLivreOAuth.ts`, `src/lib/mercadopago.ts`, `src/lib/shopifyConnect.ts` — sem chamadas de dados problemáticas (o primeiro trata erro/URL inválida corretamente; os outros dois são constante/parsing puro, sem Supabase).
- `src/lib/notifications.ts` (233 linhas, lido por completo) — bem tratado, com fallback gracioso pra `localStorage` quando a coluna `notification_preferences` não existe ainda.
- `src/lib/support.ts` (298 linhas, lido por completo) — erro tratado em toda chamada. Única observação menor: `createSupportTicket` (linhas 260-297) insere o ticket e depois a primeira mensagem em duas chamadas separadas — se a segunda falhar, sobra um ticket "aberto" sem mensagem nenhuma. É uma falha rara (erro no meio de duas escritas consecutivas) e a exceção ainda propaga corretamente pro chamador tratar; não conta como bug de erro engolido, só registro como observação menor, não fiz nada.
- Rodei `eslint` de novo em `src/hooks src/lib src/contexts` com foco em `no-unused-vars`/`@typescript-eslint/no-unused-vars` → **zero ocorrências**, igual às rodadas anteriores.

### 9.1. Corrigido: `updateProjectMetadata` usava um snapshot de `metadata` potencialmente desatualizado (não relia do banco antes de mesclar)

**O problema:** em `src/lib/userProjects.ts`, `saveProjectDraft` (usada pelo autosave do editor de loja) já fazia o padrão certo — relê `metadata` do banco, mescla o `patch` por cima, só então grava. Mas `updateProjectMetadata` (usada por `StoreAdminModal.tsx` e `ProjectSettingsOverlay.tsx`, os modais de "configurações da loja"/"admin") fazia `{ ...readMetadata(project), ...patch }` **sem reler nada** — `project` é o snapshot que o componente React já tinha em memória, possivelmente antigo. Como o editor de canvas autosalva mudanças de `metadata` em segundo plano via `saveProjectDraft` enquanto esses modais podem estar abertos por cima, um save feito pelo modal sobrescrevia silenciosamente qualquer coisa que o autosave tivesse gravado nesse meio-tempo (perda de dado tipo "last write wins", sem erro nenhum pra avisar).

**A correção:** fiz `updateProjectMetadata` seguir exatamente o mesmo padrão de `saveProjectDraft` — relê `metadata` fresco do banco (`select("metadata").eq("id", project.id).maybeSingle()`), mescla o `patch` por cima dessa leitura fresca (não do `project` em memória), só então grava. Comportamento idêntico ao anterior no caminho comum (quando o snapshot já estava atualizado); só muda o caso de borda da leitura desatualizada.

**Prova real:**
- `npx tsc --noEmit -p .` → sem saída, sem erros.
- `npm run build` → `✓ built in 6.12s`, sem erros.
- `npx vitest run` → `12 passed | 2 failed` nos arquivos (os mesmos 2 testes obsoletos já travados no portão, `financial.bug-condition.test.ts`/`financial.preservation.test.ts`), `106 passed | 32 failed` nos testes — **exatamente os mesmos números de antes da mudança** (rodei a suíte inteira antes e depois, comparei), confirmando que nada mais quebrou.
- Não existe um arquivo de teste dedicado a `userProjects.ts` (`find src -iname "userProjects*.test.*"` → vazio) — não criei um, ficaria fora do escopo "não mudar comportamento/página" desta rodada; se quiser, posso propor isso numa próxima.
- Commit: `9fbc298bba6784c63bab347cabbc9f47cfaaaf06` (`git log -1 --format=%H`), mensagem `fix: updateProjectMetadata re-reads metadata from DB instead of stale prop`. Só `src/lib/userProjects.ts` foi staged (`git add src/lib/userProjects.ts`).
- **Limitação honesta:** não tenho como reproduzir a condição de corrida de verdade neste ambiente (precisaria de duas abas/duas gravações concorrentes contra o Supabase real). A prova que tenho é de leitura de código (o padrão inconsistente entre as duas funções, hoje unificado) e de que a mudança não regride nada (build/tsc/testes limpos) — não uma reprodução do bug em si.

### 9.2. Resumo de confiança da seção 9
- 1 commit real, com prova de build/tsc/testes antes-e-depois.
- Resto da rodada: investigação extensa em `src/contexts` e nos arquivos de `src/lib` ainda não lidos por completo — nada mais de novo e seguro para corrigir apareceu. Registrei as observações menores (padrão `user_id`/`id` em `profiles`, não-atomicidade em `createSupportTicket`) só como contexto, sem propor ação — não são bugs confirmados, são pontos que exigiriam mais contexto de produto/schema pra decidir se valem mexer.

---

## 10. Quarta rodada do modo contínuo (2026-08-19)

Antes de começar: `git log --oneline -10` mostrou `4fb56af3` no topo (3ª rodada do Visual, já validada e no ar) com meus commits anteriores intactos logo abaixo; `git status --short` só com os arquivos de sempre que não são meus (`.DS_Store`, `.playwright-manual-capture.mjs`, relatórios de outros subagentes). Árvore limpa e sincronizada. Não toquei em nada da lista travada no portão de aprovação.

**Escopo desta rodada, conforme pedido:** procurar o MESMO padrão de condição de corrida já corrigido (mesclar sobre snapshot em memória em vez de reler do banco) em outros lugares que gravam metadata/settings, além de hooks/lib ainda não revisados e tratamento de erro fraco.

### 10.1. Corrigido: `publishProject` tinha o mesmo bug de "última gravação vence" que `updateProjectMetadata`

**Investigado:** busquei em todo `src/lib`/`src/hooks`/`src/contexts`/`src/components` por qualquer escrita que mescla um objeto `metadata`/`settings` em cima de uma variável em memória (`{ ...algumaCoisaEmMemoria, ...patch }`) antes de gravar no Supabase — o mesmo formato do bug já corrigido na rodada passada. `user_projects.metadata` é o único campo `jsonb` do projeto com esse padrão de "ler, mesclar, gravar" na base de código (não existe nenhum outro campo `settings` do tipo).

**O que achei:** `publishProject` (`src/lib/userProjects.ts:137`, chamada só por `GeneratedStoreEditorPage.tsx:1853` no botão "Publicar") fazia `{ ...readMetadata(project), ...metadataPatch }` — `project` é o `currentProject` do estado React do editor, o mesmo componente onde o autosave (`saveProjectDraft`, já corrigido) grava em segundo plano e onde edições de um colaborador chegam via broadcast em tempo real (comentário do próprio arquivo, linha ~108: "a sincronização em tempo real usa esse campo... aplica no canvas"). Ou seja, é literalmente o mesmo cenário já identificado para `updateProjectMetadata`: se o autosave (ou a edição de um colaborador aplicada via realtime) gravar no banco entre o carregamento do estado local e o clique em "Publicar", o publish sobrescrevia esse dado mais recente com o snapshot antigo que o React ainda tinha em memória — silenciosamente, sem erro nenhum.

**Correção:** apliquei o mesmo padrão já usado em `saveProjectDraft`/`updateProjectMetadata` — `publishProject` agora relê `metadata` fresco do banco (`select("metadata").eq("id", project.id).maybeSingle()`) antes de mesclar o `metadataPatch` por cima, em vez de partir do `project` em memória. Comportamento idêntico no caminho comum (quando o snapshot já estava atualizado); só muda o caso de borda da leitura desatualizada.

**Prova real:**
- `npx tsc --noEmit -p .` → sem saída, sem erros.
- `npm run build` → build limpo, sem erros novos.
- `npx vitest run` → `106 passed | 32 failed` — exatamente os mesmos números de antes (os 32 são os 2 arquivos de teste obsoletos já travados no portão), rodei antes e depois pra confirmar que nada mais quebrou.
- Commit: `54be6bf6` (`fix: publishProject re-lê metadata do banco em vez de snapshot em memória`). Só `git add src/lib/userProjects.ts` foi staged.
- **Limitação honesta:** mesma de antes — não tenho como reproduzir a condição de corrida de verdade neste ambiente (exigiria duas gravações concorrentes contra o Supabase real). A prova é de leitura de código (o padrão agora idêntico entre as três funções que escrevem `metadata`) e de que build/tsc/testes ficam idênticos ao antes.

### 10.2. Restante da rodada: nenhum achado novo

Completei a leitura de todos os arquivos de `src/lib`/`src/hooks`/`src/contexts` que tocam Supabase e ainda não tinham sido lidos por completo em rodadas anteriores: `affiliateFunnel.ts`, `aiPageGeneration.ts`, `atlasRouteTags.ts`, `planLimits.ts`, `perfilDoQuiz.ts`, `supportEmail.ts`, `storeReviews.ts`, `validapayCheckout.ts`, `onboardingAnalytics.ts`, `profileContext.tsx`. Todos tratam erro corretamente (`try/catch` com log, ou propagam a exceção pro chamador tratar) e não achei nenhum outro caso do padrão de condição de corrida procurado. Confirmei também que `aiPageGeneration.ts` (motor real de geração de página com IA, usado por 4 páginas) é um arquivo diferente do `aiProductPages.ts` já sinalizado como possivelmente morto no item 3.2/#13 do portão — não são a mesma coisa, e essa distinção não muda nada da proposta já registrada.

Rodei `eslint` em `src/lib src/hooks src/contexts` de novo: mesmos 28 erros de sempre (todos `@typescript-eslint/no-explicit-any` pré-existentes, mais 1 `no-control-regex` em `atlasRouteTags.ts` que é intencional — usa ` ` como sentinela documentado no próprio comentário do arquivo, não é bug), zero `no-unused-vars` novo.

### 10.3. Resumo de confiança da seção 10
- 1 commit real (`54be6bf6`), mesma condição de corrida do item 9.1 encontrada num segundo lugar e corrigida com o mesmo padrão já validado, com prova de build/tsc/testes antes-e-depois.
- Cobertura completa: todo arquivo de `src/lib`/`src/hooks`/`src/contexts` que toca Supabase já foi lido em alguma das 4 rodadas — não sobrou área nova de dados para investigar nessas pastas. Uma próxima rodada precisaria ampliar o escopo (ex.: chamadas Supabase diretas em `src/components`/`src/pages`, fora da regra original de "camada de dados") se quiser continuar achando algo novo por aqui.

---

## 11. Quinta rodada do modo contínuo (2026-08-19)

Antes de começar: `git log --oneline -10` mostrou `7e3b9a69` no topo (4ª rodada do Visual, já validada e no ar) com meus commits anteriores intactos logo abaixo; `git status --short` só com os arquivos de sempre que não são meus (`.DS_Store`, `.playwright-manual-capture.mjs`, relatórios de outros subagentes). Árvore limpa e sincronizada. Não toquei em nada da lista travada no portão de aprovação (`00_maestro_relatorio.md`, 19 itens) — inclusive `useStartMode.ts` (item #17), que o Visual já documentou e deixei intocado como instruído.

**Escopo desta rodada:** já que a camada de apoio (`hooks`/`lib`/`contexts`) foi coberta por completo nas 4 rodadas anteriores, ampliei para chamadas Supabase feitas **direto dentro de `components`/`pages`** que o Visual ainda não tinha olhado — ele já tinha varrido `.update(` na 4ª rodada dele; eu cobri `.select(`, `.insert(`, `.delete(`, `.rpc(` nas mesmas pastas (68 arquivos com alguma chamada Supabase direta; levantei especificamente os que usam `insert`/`delete`/`rpc` fora de `.update(`, cerca de 45 ocorrências) e também varri `catch` vazio de novo (nenhum encontrado — já limpo pelas rodadas anteriores).

### 11.1. Achado novo: botão "Simular Venda", em produção, grava pedidos 100% inventados na tabela real `orders` — sem gate nenhum, alimenta as telas financeiras reais

**Onde:** `src/pages/dashboard/ProdutosMLPage.tsx`, rota ativa `/dashboard/produtos-ml` (`src/App.tsx:295`), acessível a qualquer usuário logado (não é tela de admin, não tem `AdminRoute`).

**O que encontrei:** a função `handleSimulateSale` (`ProdutosMLPage.tsx:306-407`) monta um array `testOrders` com **4 pedidos totalmente fabricados** — nome de comprador, e-mail, telefone, endereço completo, cidade/estado/CEP, todos inventados na hora ("Wade Warren", "wade.warren@gmail.com", "Avenida Paulista 1000" etc., valores repetidos e datas relativas a `Date.now()`) — e grava isso direto na tabela real `orders` com `supabase.from("orders").insert(testOrders)` (`:402`), usando o `user_id` da sessão logada de verdade. Não é dado mostrado só na tela (que já seria proibido pelo `CLAUDE.md` seção 8, "nunca usar dados mockados na interface") — é **persistido de verdade no banco de produção**, indistinguível de um pedido real depois de gravado.

O botão que dispara isso (`"Simular Venda"`, `:498-509`) fica **sempre visível na barra de ações do topo da página**, ao lado de "Sincronizar" e "Exportar" — sem nenhum gate de admin, sem flag de ambiente (`import.meta.env.DEV` ou equivalente), sem confirmação. Tem uma segunda cópia do mesmo botão (`"Simular Primeiro Pedido"`, `:672-679`) no estado vazio da lista, para quando o usuário ainda não tem nenhum pedido.

**Por que isso é grave, não só "feio":**
- `git log -S "Simular Venda"` mostra que entrou junto do commit `05ed7060` ("feat: implement real-time order synchronization from Mercado Livre and premium sales dashboard") — parece uma ferramenta de demonstração deixada para popular a tela vazia durante o desenvolvimento, nunca removida nem escondida atrás de um gate antes de ir pro ar.
- Não há constraint de unicidade em `external_order_id` (`grep` em todas as migrations não achou nada) — cada clique **insere mais 4 linhas fabricadas** (mesmos `external_order_id` de sempre, mas `id` novo a cada vez), sem limite.
- A tabela `orders` não é usada só nesta página: `grep -rln '\.from("orders")'` encontrou também `TransacoesPage.tsx`, `PagamentosPage.tsx`, `ResultsPage.tsx` e `useFinancialData.ts` — ou seja, **qualquer usuário que clique nesse botão passa a ver "vendas" e receita fictícias nas telas financeiras de verdade** (extrato, pagamentos, resultados), sem nenhuma forma óbvia de diferenciar do que é real depois.
- Viola diretamente a regra do `CLAUDE.md` seção 8: "Nunca usar dados mockados na interface — sempre dados reais do Supabase". Aqui o dado mockado não fica só na interface — vira dado real gravado no banco.

**Por que não corrigi direto:** remover o botão muda o que aparece numa tela ativa (mesma categoria de "mudança visível" dos outros itens já no portão de aprovação, como o #17/#18) — e também não sei se foi deixado de propósito como ferramenta de demonstração para onboarding/vendas (ex.: mostrar pro usuário como a tela fica com dados) e por isso preferi não presumir. Fica registrado como proposta:

**Proposta pronta, não executada:** remover `handleSimulateSale` e os dois botões que a chamam (`:498-509` e `:672-679`) de `ProdutosMLPage.tsx`. Se a intenção for manter uma forma de "ver a tela com dados de exemplo" para fins de demonstração, a alternativa mais segura seria trocar por um preview 100% no front-end (sem gravar nada no Supabase) — mas isso já seria uma feature nova, não uma remoção simples, então deixo a decisão com você.

### 11.2. Resto da varredura: nenhum outro achado novo

Cobri as chamadas `.rpc(`/`.insert(`/`.delete(` restantes em `components`/`pages` (excluindo o que já está na lista de aprovação ou já investigado em rodadas anteriores):
- `AtlasChatPage.tsx` (rota real `/dashboard/atlas`, `:283-284` em `App.tsx`) — descobri que essa página tem sua **própria** lógica de criar thread/inserir mensagem (`:167-176`, `:213-222`, `:244-254`), separada da lógica de `AtlasChatContext.tsx` (`enviar`/`abrirConversa`) já revisada na 3ª rodada — ou seja, existem hoje **dois caminhos diferentes** que fazem basicamente a mesma coisa (`AtlasChatContext` só é usado por esta página para `useAtlasNavegacao`, não para enviar mensagem). Toda chamada aqui trata erro corretamente (`throw`/`toast`). Não é o mesmo tipo de bug que estou procurando, mas é duplicação real de lógica — deixo registrado como observação, não como item novo de aprovação (seria mudança maior, de arquitetura, não um bug pontual).
- `SupportTab.tsx` (`createTicket`, `:251-292`) — mesmo padrão não-atômico já registrado como observação menor na 3ª rodada para `support.ts` (`lib`): insere o ticket e a primeira mensagem em duas chamadas separadas; erro na segunda deixa um ticket sem mensagem. Mesma categoria já dispensada antes (raro, não é erro engolido, propaga certinho) — não repito como item novo.
- `AdminAffiliateApplicationsPanel.tsx`, `AdminWithdrawalsPanel.tsx`, `AdminCommissionsPage.tsx`, `AdminSalesPage.tsx`, `ChatFornecedoresPage.tsx` (RPCs de admin) — todos checam `error` e mostram/logam; nenhum tem o padrão de snapshot-vs-releitura porque nenhum lê-modifica-grava um objeto composto, só chamam RPCs que fazem a lógica no servidor.
- `NotificacoesPopover.tsx`, `OwnProductsPanel.tsx`, `MercadoPagoIntegrationCard.tsx`, `PlatformIntegrationModal.tsx`, `AtlasHistoryMenu.tsx` (deletes simples por `id`) — todos com filtro de linha única, sem risco de condição de corrida.
- Rodei `grep` dedicado por `catch` vazio (`catch (...) {}`, sem log/toast) em `src/components`/`src/pages` de novo — **zero ocorrências**, confirma que as rodadas anteriores já limparam isso.

Nenhuma outra ocorrência de dado mockado/hardcoded sendo gravado no banco (busquei por `simular|simulat|mock|fake|dummy` combinado com `insert`/`supabase` em `components`/`pages` — só apareceram os 2 arquivos de teste automatizado, que mockam o client corretamente para testes, sem relação com o achado acima).

### 11.3. Resumo de confiança da seção 11
- Nenhum commit de código nesta rodada — o único achado novo (11.1) é uma mudança visível (remove um botão de uma tela ativa) e grava fora do escopo de execução autônoma combinado, então virou proposta no portão de aprovação em vez de execução direta.
- Cobertura: todas as chamadas Supabase diretas em `components`/`pages` fora de `.update(` (já coberto pelo Visual) foram revisadas nesta rodada — `.select(`/`.insert(`/`.delete(`/`.rpc(`. Tudo que afirmo vem de leitura direta do código com arquivo:linha, do `git log -S` para a origem do botão, e de um `grep` real confirmando ausência de constraint de unicidade e de outras ocorrências do mesmo padrão.
