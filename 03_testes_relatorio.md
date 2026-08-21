# Relatório — Subagente TESTES (validação pós BANCO + VISUAL)

Data: 2026-08-18
Escopo: validar, não corrigir. Confirmar que os commits de hoje de BANCO (`93cf9440`) e VISUAL (`2cec23a7`, `ce2ba9b3`) não quebraram nada. Nenhum arquivo foi tocado, nenhum commit foi feito por mim.

## 1. Commits verificados (`git log --oneline -6`)

```
ce2ba9b3 chore: remove leftover debug console.log from ml-publish flow        (VISUAL)
2cec23a7 chore: remove dead product page templates (unused, superseded...)    (VISUAL)
93cf9440 chore: remove dead useDashboard hooks (unused, mocked data)          (BANCO)
9aaf5857 Restaurou checkout ValtadePay
8f97a455 Changes
22e19b79 Changes
```

Ambos os relatórios (`01_banco_relatorio.md`, `02_visual_relatorio.md`) trazem prova real (hash de commit citado, comando + output, `git show --stat`) — nenhum item marcado como "concluído" ficou sem evidência checável.

## 2. Comandos rodados e resultado real (HEAD = `ce2ba9b3`)

### `npx tsc --noEmit -p tsconfig.app.json`
```
exit:0
```
Sem erros de tipo.

### `npm run build`
```
✓ 3391 modules transformed.
...
✓ built in 6.16s
exit:0
```
Build de produção completo, sem erros. Só warnings pré-existentes de Tailwind (`duration-[120ms]` etc., não relacionados às mudanças de hoje) e o aviso padrão de chunk >500kB (`vendor-CQtBBgul.js`, 561kB) — não é regressão, já existia antes.

### `npx vitest run`
```
Test Files  2 failed | 12 passed (14)
     Tests  32 failed | 106 passed (138)
```
Bate exatamente com o que os dois relatórios descreveram.

**Confirmação de que são pré-existentes (não pedi para confiar no relato, testei eu mesmo):** criei um `git worktree` isolado no commit `93cf9440^` (`9aaf5857`, o estado do repo *antes* de qualquer mudança de BANCO ou VISUAL hoje) e rodei `npx vitest run` lá:
```
Test Files  2 failed | 12 passed (14)
     Tests  32 failed | 106 passed (138)
```
Resultado idêntico, mesmos 2 arquivos (`src/lib/financial.bug-condition.test.ts`, `src/lib/financial.preservation.test.ts`). **Confirmado: as 32 falhas já existiam antes dos commits de hoje, não foram introduzidas por BANCO nem VISUAL.** Worktree removido depois (`git worktree remove --force`), repo principal conferido de volta ao estado original.

### `npx eslint . --ext .ts,.tsx --max-warnings 9999`
```
✖ 334 problems (265 errors, 69 warnings)
```
Bate com o número citado no relatório do VISUAL (334). Toda a lista de erros é `@typescript-eslint/no-explicit-any` / `no-useless-escape` / `prefer-const` dentro de `supabase/functions/*` (Deno, fora do escopo de frontend) e configs (`vite.config.ts`, `tailwind.config.ts`) — nenhum erro em arquivo tocado hoje (`ImportProductModal.tsx`, os 5 templates removidos, `useDashboard.ts`) e nenhum import quebrado apontado pelo eslint ou pelo `tsc`.

### `git status` (estado final)
```
 M public/.DS_Store
?? .playwright-manual-capture.mjs
?? 01_banco_relatorio.md
?? 02_visual_relatorio.md
```
Limpo no sentido que importa: nenhuma mudança minha, nenhum arquivo de código não commitado. `public/.DS_Store` e `.playwright-manual-capture.mjs` já estavam assim antes de eu começar (o próprio BANCO já sinalizou isso) — não são meus e não mexi.

## 3. Prova real vs. "não verificado" nos relatórios dos outros agentes

- **BANCO (`01_banco_relatorio.md`):** prova real. Cita hash de commit (`93cf94404ed7e36fc23479c41ff3366c0f721f85`), confirma com `git show --stat`, roda `npm run build` antes de declarar sucesso. Itens não executados (seção 3) estão claramente marcados como proposta, não como feito.
- **VISUAL (`02_visual_relatorio.md`):** prova real. Cita os dois hashes de commit, mostra trecho de `git diff`/código (`productTemplateRegistry.ts`) como prova de que os templates removidos eram mortos, roda `tsc`/`build`/`vitest` antes e depois de cada remoção e usa `git stash`/`stash pop` para isolar se as falhas de teste eram pré-existentes. Propostas não executadas (seção 3.1–3.5) estão claramente separadas do que foi de fato feito.

Nenhum dos dois relatórios afirma algo como "concluído" sem evidência checável.

## 4. Regressões ou problemas encontrados

**Nenhum.** As mudanças de hoje (remoção de `useDashboard.ts` morto, 5 templates de produto mortos, 2 `console.log` de debug em `ImportProductModal.tsx`) não quebraram build, tipos, nem introduziram falha nova de teste. As 32 falhas de teste são de dívida técnica anterior (testes obsoletos de uma correção de bug antiga), confirmadas pré-existentes por teste direto no commit anterior.

Não verifiquei texto/copy sobre fulfillment automático da Velo nesta rodada — o escopo desta validação, conforme instruído, foi correr build/lint/testes e conferir integridade das mudanças de BANCO e VISUAL, não auditoria de copy.

## 5. Veredito

**As mudanças de hoje são seguras.** Build, type-check e lint passam limpos para o código tocado; a suíte de testes tem exatamente o mesmo resultado (32 falhas pré-existentes, não relacionadas) antes e depois dos 3 commits de hoje. Nada meu foi commitado — só validação.

---

## 6. Validação da correção de segurança em `atlas-search` (commit `b5643859`)

Escopo: validar, sem corrigir nada. Nenhum arquivo editado, nenhum commit feito por mim nesta rodada.

### 6.1. `git log --oneline -5` / `git status --short`

```
b5643859 fix(security): atlas-search now authenticates the caller instead of trusting body
cf8597be Merge remote-tracking branch 'origin/main'
2e822f84 fix: log ignored Supabase errors in usePlan
eb8f3f87 fix: catch errors in usePlanLimits usage fetch, log ignored ones
ce2ba9b3 chore: remove leftover debug console.log from ml-publish flow
```
`git status --short` só trazia os arquivos de sempre que não são meus (`.DS_Store`, `.playwright-manual-capture.mjs`, relatórios `00`–`02`). Árvore limpa, confirmado.

### 6.2. `deno check` antes vs. depois

Rodei eu mesmo, não confiei só no relato do Banco:

```
$ /opt/homebrew/bin/deno check supabase/functions/atlas-search/index.ts   # HEAD (b5643859)
Found 15 errors.

$ git show cf8597be:supabase/functions/atlas-search/index.ts > /tmp/atlas-search-before.ts
$ /opt/homebrew/bin/deno check /tmp/atlas-search-before.ts               # antes da correção
Found 15 errors.
```
Os 15 erros são idênticos em código e padrão nos dois (`14× TS2345` de incompatibilidade de generics em `SupabaseClient<...>` + `1× TS2538`), só deslocados em número de linha (o arquivo novo tem +32 linhas líquidas por causa da função `authenticateRequest`). **Nenhum erro novo de tipo foi introduzido.** Confirmado o que o Banco relatou. Arquivo temporário removido depois.

### 6.3. Revisão do diff (`git show b5643859`)

Diff completo lido linha a linha. Confirmações:

- **`grep -n "userContext.id" supabase/functions/atlas-search/index.ts`** → nenhum resultado (exit 1, vazio). Nenhuma chamada sensível ainda usa o id não verificado.
- **`grep -n "authenticatedUserId"`** → aparece nas 11 chamadas sensíveis: `logAction` (navigate, diagnose, publish_start, product_search), `getUserMlStatus` (×4 call sites), `getUserPublishedProducts` (×2), `getRecentErrors` (×1). Todas usam o valor derivado do token, nenhuma usa dado do body.
  - **Nota menor (não é falha de segurança):** a seção 8.1 do relatório do Banco diz "troquei as 10 ocorrências" — contando o diff, são **11** substituições de `userContext.id` → `authenticatedUserId` (a 11ª é a de `getRecentErrors` dentro do bloco de diagnóstico, linha 629). É só uma imprecisão de contagem no texto do relatório; a substituição em si está completa e correta (confirmado pelo grep acima, que é a prova que importa).
- **Ordem de execução:** `authenticateRequest(req)` é chamado logo no topo do `try`, e o `return 401` acontece **antes** de `const body = await req.json()` — ou seja, antes de qualquer leitura de dado sensível ou até mesmo de parsing do corpo. Confirmado lendo o diff (linhas 575-580 do arquivo novo).
- **Funções auxiliares (`getUserMlStatus`, `getUserPublishedProducts`, `logAction`)** — li o corpo das três (linhas 453-514): todas filtram corretamente por `.eq("user_id", userId)` (ou usam o `userId` para `insert`), usando o parâmetro que agora recebe `authenticatedUserId`. Não há nenhum outro caminho no arquivo que leia um identificador de usuário do body (`grep` por `body?.` além de `user_context`/`query`/`history`/`current_product_id`/`force_mode`/`conversation_id`/`exclude_ids` não retornou nada).
- `userContext.name`/`userContext.email` continuam vindo do body sem alteração, e um `grep` confirma que só são usados em `userContextLine` (personalização de tom da IA), nunca em query/insert — bate com o que o relatório afirma.

### 6.4. `npx tsc --noEmit -p tsconfig.app.json` / `npm run build`

```
tsc: exit:0
build: ✓ built in 6.18s, exit:0
```
Nada no frontend quebrou — esperado, já que a mudança é isolada a um arquivo Deno em `supabase/functions/`.

### 6.5. `npx vitest run`

```
Test Files  2 failed | 12 passed (14)
     Tests  32 failed | 106 passed (138)
```
Idêntico ao baseline de sempre (mesmas 32 falhas pré-existentes de `financial.bug-condition.test.ts`/`financial.preservation.test.ts`, já confirmadas não relacionadas em rodada anterior). Nada novo quebrou.

### 6.6. `git status` final

```
 M public/.DS_Store
?? .playwright-manual-capture.mjs
?? 00_maestro_relatorio.md
?? 01_banco_relatorio.md
?? 02_visual_relatorio.md
?? 03_testes_relatorio.md
```
Nenhuma mudança de código não commitada por mim — só os arquivos de sempre e relatórios (texto, não código). Não commitei nada.

### 6.7. Veredito

**Segura para deploy em produção.** A correção fecha exatamente a brecha descrita (nenhuma chamada sensível remanescente usa `userContext.id`; todas usam o `user_id` derivado do token real via `auth.getUser()`; o 401 é retornado antes de qualquer leitura de dado); não introduz erro de tipo novo (`deno check` idêntico antes/depois); não quebra o frontend (`tsc`/`build` limpos); não altera o resultado da suíte de testes. Única ressalva, não bloqueante: a contagem "10 ocorrências" no relatório do Banco (seção 8.1) deveria ser 11 — imprecisão de texto, não de código. Como o próprio Banco já registrou, ainda falta validação em runtime contra o Supabase real (chamar a function com/sem token, e com `user_context.id` de outro usuário) antes de considerar 100% fechado em produção — isso está fora do que dá para verificar por leitura de código e testes estáticos neste ambiente.

---

## 7. Validação da 2ª rodada de refactor do Visual (commits `d69254e0`, `d34f2172`)

Escopo: validar, sem corrigir nada. Nenhum arquivo editado, nenhum commit feito por mim nesta rodada.

### 7.1. `git log --oneline -5` / `git status --short`

```
d34f2172 refactor: extract GeneratedStoreEditorPage's types/constants/helpers
d69254e0 refactor: extract DashboardSidebar inline styles into own module
051687c0 Merge remote-tracking branch 'origin/main'
b5643859 fix(security): atlas-search now authenticates the caller instead of trusting body
be2a2cd4 Corrigiu erro de reembolso
```
Os dois commits do Visual estão no topo, em cima do merge (`051687c0`) que já incluía a correção de segurança validada na seção 6. `git status --short` só trazia os arquivos de sempre (`.DS_Store`, `.playwright-manual-capture.mjs`, relatórios `00`–`03`). Árvore limpa, confirmado.

### 7.2. `npx tsc --noEmit -p tsconfig.app.json` / `npm run build`

```
tsc: exit:0
build: ✓ built in 6.75s, exit:0 (mesmos warnings pré-existentes de chunk >500kB e Tailwind duration-[...])
```

**Comparação real de tamanho de chunk (não confiei só na alegação do Visual — refiz eu mesmo com um `git worktree` isolado no commit anterior, `051687c0`, e rodei `npm run build` lá também):**

| Chunk | Antes (`051687c0`) | Depois (`d34f2172`, HEAD) |
|---|---|---|
| `GeneratedStoreEditorPage-*.js` | 184.42 kB / gzip 45.78 kB | 184.42 kB / gzip 45.78 kB |
| `DashboardLayout-*.js` (contém `DashboardSidebar`, que é importado estaticamente, não tem chunk próprio) | 125.30 kB / gzip 35.19 kB | 125.30 kB / gzip 35.17 kB |

Tamanho raw idêntico nos dois; a diferença de 0.02 kB no gzip do `DashboardLayout` é ruído de compressão (hash de conteúdo/nome de variável mudou, bytes finais não), não uma regressão de tamanho real. **Confirma a alegação do Visual: bundle final equivalente.** Nota: `DashboardSidebar.tsx` não vira chunk separado porque é importado estaticamente em `DashboardLayout.tsx` (linha 4) — por isso a comparação correta é no chunk pai, não num `DashboardSidebar-*.js` que não existe. Worktree removido depois (`git worktree remove --force`).

### 7.3. `npx vitest run`

```
Test Files  2 failed | 12 passed (14)
     Tests  32 failed | 106 passed (138)
```
Idêntico ao baseline de sempre. Nada novo quebrou.

### 7.4. Revisão dos dois arquivos novos

- **`DashboardSidebar.styles.ts`** (586 linhas): só um objeto `styles` de `CSSProperties` estáticos (dimensões, cores, paddings fixos), sem nenhuma referência a props/state/hooks. Bate com a extração descrita.
- **`GeneratedStoreEditorPage.helpers.tsx`** (294 linhas): li o arquivo inteiro. É só: tipos (`FlowState`, `CatalogItem`, `ContextControls`, etc.), constantes (`LOJA_TEMPLATE`, `catalogTaxonomy`, `iconPickerOptions`, presets de botão/texto) e funções puras sem closure sobre estado do componente (`getAllImages`, `formatBRL`, `hslToHex`, `colorToHex`, `getCategoryIcon`, `renderIconMarkup`, `fetchEditorCollectionProducts` — essa última monta uma query Supabase parametrizada por `userId` recebido como argumento, não lê nenhum estado de componente). Nenhum `useState`/`useEffect`/hook React, nenhuma lógica condicional nova. Confirmei também via `git show d34f2172 --stat`: 294 inserções no arquivo novo vs. 251 deleções no arquivo principal — consistente com relocação de bloco (a diferença de ~40 linhas é o próprio bloco de imports que o novo arquivo precisa declarar por conta própria).
- Bate com a descrição do Visual: extração pura, sem lógica nova, sem mudança de comportamento.

### 7.5. `git status` final

```
 M public/.DS_Store
?? .playwright-manual-capture.mjs
?? 00_maestro_relatorio.md
?? 01_banco_relatorio.md
?? 02_visual_relatorio.md
?? 03_testes_relatorio.md
```
Nenhuma mudança de código não commitada por mim. Não commitei nada.

### 7.6. Veredito

**Segura para deploy em produção.** Os dois commits são extração pura (tipos/constantes/estilos estáticos), sem lógica nova e sem closure sobre estado — confirmado por leitura direta dos dois arquivos novos. `tsc`/`build`/`vitest` limpos e idênticos ao baseline. A alegação de "tamanho de chunk idêntico" foi verificada com uma comparação real (build antes/depois em worktree isolado), não só aceita do relatório — e bateu exatamente (`GeneratedStoreEditorPage` idêntico byte a byte, `DashboardLayout` com diferença de gzip desprezível). Nenhum problema encontrado.

---

## 8. Validação da 3ª rodada do Banco — fix em `updateProjectMetadata` (commit `9fbc298b`)

Escopo: validar, sem corrigir nada. Nenhum arquivo editado, nenhum commit feito por mim nesta rodada.

### 8.1. `git log --oneline -5` / `git status --short`

```
9fbc298b fix: updateProjectMetadata re-reads metadata from DB instead of stale prop
c3ea6a06 fix: remove duplicate mlOauthRetorno import from merge
17a8c335 Merge remote-tracking branch 'origin/main'
68578cb4 fix: add missing mlOauthRetorno import in DashboardLayout
259a8584 Merge remote-tracking branch 'origin/main'
```
`9fbc298b` no topo, como esperado. `git status --short` só com os arquivos de sempre (`.DS_Store`, `.playwright-manual-capture.mjs`, relatórios `00`–`03`). Árvore limpa.

### 8.2. Revisão do diff (`git show 9fbc298b`)

Diff de uma função só (`updateProjectMetadata`, `src/lib/userProjects.ts`), lido linha a linha:

- Antes: `const nextMetadata = { ...readMetadata(project), ...patch } as Json;` — mesclava direto sobre o `project` em memória (prop/snapshot do componente React), sem reler nada.
- Depois: faz `select("metadata").eq("id", project.id).maybeSingle()` primeiro (com `if (readError) throw readError`), monta `base` a partir do resultado fresco (`{}` como fallback se `current.metadata` não for objeto), e só então `{ ...base, ...patch }`. O resto da função (o `update(...).eq(...).select("*").maybeSingle()` que grava e retorna) **não mudou** — confirmado no diff, que só toca as linhas de cálculo de `nextMetadata`.
- **Comparei com `saveProjectDraft` (linhas 115-125 do arquivo atual), que já fazia esse padrão antes:** o bloco de leitura+merge novo em `updateProjectMetadata` (linhas 499-509) é **idêntico** ao de `saveProjectDraft`, char por char (mesma query, mesma checagem de tipo, mesmo fallback `{}`). Não é lógica inventada — é a mesma receita já usada e validada em produção por outra função do mesmo arquivo.
- **Caminho feliz preservado:** quando o `metadata` no banco já bate com o que o componente tinha em memória (o caso comum, sem edição concorrente), o resultado de `{ ...base, ...patch }` é idêntico ao `{ ...readMetadata(project), ...patch }` de antes — só muda o caso de borda (dado desatualizado em memória), exatamente como a mensagem do commit descreve.
- Conferi os dois chamadores (`grep -rln "updateProjectMetadata" src/` → `StoreAdminModal.tsx`, `ProjectSettingsOverlay.tsx`): ambos já fazem `const updated = await updateProjectMetadata(project, patch)` dentro de `try/catch` e usam o `updated` retornado (não o `project` antigo) — nenhum ajuste necessário nos chamadores, a assinatura e o contrato da função não mudaram.

### 8.3. `npx tsc --noEmit -p tsconfig.app.json` / `npm run build`

```
tsc: exit:0
build: ✓ built in 6.01s, exit:0 (mesmos warnings pré-existentes)
```

### 8.4. `npx vitest run`

```
Test Files  2 failed | 12 passed (14)
     Tests  32 failed | 106 passed (138)
```
Idêntico ao baseline de sempre. Não existe teste dedicado a `userProjects.ts` (o próprio Banco já registrou isso) — a validação aqui é por leitura de código + build/tsc, não por teste automatizado desta função específica.

### 8.5. `git status` final

```
 M public/.DS_Store
?? .playwright-manual-capture.mjs
?? 00_maestro_relatorio.md
?? 01_banco_relatorio.md
?? 02_visual_relatorio.md
?? 03_testes_relatorio.md
```
Nenhuma mudança de código não commitada por mim.

### 8.6. Veredito

**Segura para deploy em produção.** A correção é mínima e cirúrgica (só a linha de cálculo de `nextMetadata`), reutiliza um padrão de leitura+merge já existente e comprovado no mesmo arquivo (`saveProjectDraft`) em vez de inventar lógica nova, preserva o caminho feliz (nenhuma mudança de comportamento quando não há edição concorrente) e não quebra `tsc`/`build`/`vitest`. Os dois chamadores continuam compatíveis sem qualquer ajuste. Única ressalva, já registrada pelo próprio Banco e não bloqueante: a condição de corrida que motivou o fix não foi (nem poderia ser, neste ambiente) reproduzida de verdade contra o Supabase real — a prova é de leitura de código e ausência de regressão, não de reprodução do bug original.

## 9. Validação da 3ª rodada do Visual — 5 commits de limpeza de código morto (2026-08-19)

Sessão limpa (sem contexto de conversas anteriores). Escopo: revalidar os 5 commits que o Visual descreveu na seção "3ª rodada" de `02_visual_relatorio.md` — todos remoção de dead code/imports não usados, sem mudança de comportamento pretendida.

### 9.1. `git log` / `git status` iniciais

```
4fb56af3 docs: log Visual's 3rd continuous-mode round in 02_visual_relatorio.md
087bb692 chore: remove unused imports from AdminUserDetailModal
ff812fef chore: remove dead CJ-Dropshipping leftover fields and unused imports from ProdutosMLPage
8f0e7b8f chore: remove dead message-actions helpers and unused imports from DashboardHomePage
dd49603d chore: remove unused thumbnail asset imports from AICharacterCreator
5d12e796 chore: remove dead store-onboarding block and unused locals from DashboardLayout
5a672a68 fix(copy): landing page CTA no longer says "gratuitamente"
```
`git status --short`: só `public/.DS_Store` modificado e os `.md`/script não rastreados de sempre (nenhum meu, nenhum do Visual). Os 5 commits confirmados no topo, em cima do estado inicial declarado (`5a672a68`).

### 9.2. Releitura de todos os 5 diffs (`git show <hash>`)

**`5d12e796` (DashboardLayout.tsx) — o mais substancial, revisado com atenção extra:**
Confirmei por `grep`, para cada um dos identificadores removidos (`hasCompletedStoreOnboarding`, `markStoreOnboardingCompleted`, `readUserStores`, `saveUserStores`, `STORES_CHANGED_EVENT`, `VeloStore`, `useStartMode`, os ícones lucide órfãos, `MobileVeloMark`, `canAccessCommissions`, `persistCompletedStore`, e o trio de estado `stores`/`storesHydrated`/`shouldAutoShowStoreOnboarding`), **zero ocorrências restantes** no arquivo. A duplicata de `isModelsRoute` também confere: sobrou só a cópia real, usada em `MobileDashboardChrome` (linha 348, lida na 411); a cópia dentro de `DashboardLayoutInner` (que nunca era lida) foi a removida. O fluxo novo de onboarding em modal (`showOnboarding`, `OnboardingModal`, `shouldShowOnboarding`, `markOnboardingSeen`) segue intacto e não foi tocado pelo commit. `FirstStoreOnboarding.tsx` em si não foi alterado (`git diff` vazio), e `getActiveStore` — o outro export do mesmo módulo que o Visual disse continuar em uso — de fato aparece ativo em `ImportProductModal.tsx`, `TrendingProductsPage.tsx` e `CatalogoProductDetailPage.tsx`.
Uma observação menor, não bloqueante: o relatório do Visual descreve o `isStartMode` que permaneceu em `DashboardLayoutInner` (linha 533) como "computado, de verdade" — na prática ele também é um `const isStartMode = false;` hardcoded, idêntico em forma ao que foi removido de `MobileDashboardChrome`. Isso não é um erro do commit (a variável é genuinamente lida em ~10 lugares abaixo, então estava certo não remover), só uma imprecisão de descrição no relatório do Visual — registro para não confundir uma futura rodada.

**`dd49603d` (AICharacterCreator.tsx):** os 20 imports de thumbnail (`model297t..model304t`, `ugc307t..ugc311t`, `ugcBlondet`, `ugcBrunettet`, `ugcM318t..ugcM323t`) têm zero ocorrências restantes no arquivo. Confirmado que o grid usa o segundo conjunto (`card_u1..card_um6`), que não foi tocado.

**`8f0e7b8f` (DashboardHomePage.tsx):** `getMessageActions`, `formatMargin`, `formatPrice`, `AtlasFunctionResponse` e os imports (`AtlasHistoryMenu`, `AtlasMessageText`, `atlasThreadsQueryKey`, ícones lucide) — todos com zero ocorrências restantes. `normalizeAtlasActions`/`isAtlasAction`, que o Visual registrou como "meio soltos mas não tocados", seguem presentes e intactos, como prometido.

**`ff812fef` (ProdutosMLPage.tsx) — atenção especial pedida:** confirmei que `ShoppingBag` está de volta no import (linha 17) e genuinamente usado na linha 663 (`<ShoppingBag size={28} .../>`) — o commit final está correto, sem `Cannot find name`. `cjVariantId`/`cjProductId`/`cjProductUrl` (as variáveis locais) e `queryClient`/`useQueryClient`/`MoreHorizontal`/`ArrowUpRight`/`ExternalLink`/`CheckCircle` têm zero ocorrências restantes. Observação à parte, **não relacionada a este commit** (pré-existente, não tocada por ele): o `type` do pedido no topo do arquivo ainda declara `cj_order_id`/`cj_product_url`/`cj_product_id` (linhas 53-55) como campos do objeto, mas nenhum deles é populado em lugar nenhum do arquivo — são campos de tipo mortos que `tsc --noUnusedLocals` não pega (não é uma variável local, é uma propriedade de tipo nunca atribuída). Não é regressão do commit, só uma sobra que passou batido; fica registrado como ponto de partida pra uma próxima rodada do Visual, não bloqueia o deploy.

**`087bb692` (AdminUserDetailModal.tsx):** `useMemo`, `cn`, `ArrowUpRight`, `ExternalLink` — zero ocorrências restantes. `useEffect`/`useRef`/`useState` (o `useState` continua importado via outro caminho, conferido no diff) seguem em uso.

Em nenhum dos 5 commits encontrei remoção de lógica ativa por engano.

### 9.3. Build / typecheck / testes

```
npx tsc --noEmit -p tsconfig.app.json   → exit 0, sem erros
npm run build                            → exit 0, mesmos warnings pré-existentes de chunk grande, nada novo
npx vitest run                           → Test Files 2 failed | 12 passed (14) — Tests 32 failed | 106 passed (138)
```
Idêntico ao baseline de sempre (mesmo `32 failed | 106 passed` já documentado nas seções 2 e 7 acima).

### 9.4. `git status` final

```
 M public/.DS_Store
?? .playwright-manual-capture.mjs
?? 00_maestro_relatorio.md
?? 01_banco_relatorio.md
?? 03_testes_relatorio.md
```
Nenhuma mudança de código não commitada por mim.

### 9.5. Veredito

**Segura para deploy em produção**, os 5 commits inclusos. Todas as remoções são de fato código/imports mortos — validado tanto pela ferramenta (`tsc --noUnusedLocals`, conforme o próprio Visual já tinha rodado) quanto por releitura manual de cada diff e grep de zero-uso neste round. O commit mais delicado (`5d12e796`, bloco de onboarding de loja morto em `DashboardLayout.tsx`) foi conferido com cuidado extra: os 4 identificadores centrais (efeitos + estado + `persistCompletedStore`) não têm nenhuma leitura remanescente no arquivo, e o fluxo de onboarding novo (modal) que os substituiu está intacto e não foi tocado. O commit `ff812fef`, que o próprio Visual registrou ter corrigido um erro de `ShoppingBag` removido por engano antes de commitar, está correto no estado final — `ShoppingBag` importado e usado, `tsc`/`build` limpos. Nenhuma lógica ativa foi tocada por engano em nenhum dos 5 commits. Única ressalva não bloqueante: um pequeno campo de tipo morto pré-existente em `ProdutosMLPage.tsx` (não populado, não relacionado a este commit) e uma imprecisão descritiva (não funcional) no relatório do Visual sobre o `isStartMode` remanescente em `DashboardLayout.tsx` — ambos registrados acima para uma próxima rodada, nenhum dos dois impede o deploy.

## 10. Validação da 4ª rodada do Banco — `publishProject` relê metadata do banco (commit `54be6bf6`)

Sessão limpa (sem contexto de conversas anteriores). Escopo: revalidar o commit descrito na seção 10 de `01_banco_relatorio.md` — mesmo bug de condição de corrida "última gravação vence" já corrigido em `updateProjectMetadata` (commit `9fbc298b`, validado na seção 8 acima), agora corrigido também em `publishProject`.

### 10.1. `git log` / `git status` iniciais

```
54be6bf6 fix: publishProject re-lê metadata do banco em vez de snapshot em memória
4fb56af3 docs: log Visual's 3rd continuous-mode round in 02_visual_relatorio.md
087bb692 chore: remove unused imports from AdminUserDetailModal
ff812fef chore: remove dead CJ-Dropshipping leftover fields and unused imports from ProdutosMLPage
8f0e7b8f chore: remove dead message-actions helpers and unused imports from DashboardHomePage
```
`git status --short`: só `public/.DS_Store` modificado e os `.md`/script não rastreados de sempre (nenhum meu, nenhum do Banco). Commit no topo, árvore limpa.

### 10.2. `git show 54be6bf6` — mesmo padrão já validado

O diff em `src/lib/userProjects.ts` substitui `const metadata = { ...readMetadata(project), ...metadataPatch };` por: um `select("metadata").eq("id", project.id).maybeSingle()` fresco no Supabase, checagem de `readError` (lança se falhar), um guard de tipo (`typeof === "object" && !Array.isArray`) para extrair `freshBase`, e só então `{ ...freshBase, ...metadataPatch }`.

Comparei lado a lado com `updateProjectMetadata` (linhas 143-153 do arquivo atual) e `saveProjectDraft` (linhas 115-125): **estrutura idêntica nos três** — mesma query, mesmo guard de tipo, mesmo formato de merge. Também comparei com `readMetadata()` (linha 481-485), o helper que a versão antiga usava: faz exatamente o mesmo guard (`!metadata || typeof !== "object" || Array.isArray → {}`). Ou seja, no caminho feliz (nenhuma gravação concorrente entre o carregamento do estado e o clique em "Publicar"), `current.metadata` lido do banco é idêntico ao `project.metadata` já em memória — `freshBase` computa o mesmo valor que `readMetadata(project)` computava antes, então `metadata` resultante é bit-a-bit igual à versão antiga. O comportamento só diverge no caso de borda (leitura desatualizada), exatamente como o commit descreve. Resto da função (`slug`, `ensureUniqueSlug`, o `update` final com `status: "publicado"`/`published_at`) não foi tocado.

Único chamador confirmado, `GeneratedStoreEditorPage.tsx:1853`, não precisou de ajuste — a assinatura da função (`project`, `metadataPatch`) não mudou.

### 10.3. Build / typecheck / testes

```
npx tsc --noEmit -p tsconfig.app.json   → exit 0, sem erros
npm run build                            → exit 0, mesmos warnings pré-existentes de chunk grande, nada novo
npx vitest run                           → Test Files 2 failed | 12 passed (14) — Tests 32 failed | 106 passed (138)
```
Idêntico ao baseline de sempre (mesmo `32 failed | 106 passed` das seções 2, 7 e 9 acima).

### 10.4. `git status` final

```
 M public/.DS_Store
?? .playwright-manual-capture.mjs
?? 00_maestro_relatorio.md
?? 01_banco_relatorio.md
?? 03_testes_relatorio.md
```
Nenhuma mudança de código não commitada por mim.

### 10.5. Veredito

**Segura para deploy em produção.** O commit `54be6bf6` aplica exatamente o mesmo padrão já validado na seção 8 (`updateProjectMetadata`) e presente em `saveProjectDraft`: reler `metadata` fresco do banco antes de mesclar, em vez de partir do snapshot em memória do componente React. Confirmado por comparação estrutural das três funções que o formato é idêntico, e por análise do guard de tipo que o caminho feliz (sem gravação concorrente) produz resultado bit-a-bit igual ao comportamento anterior — só o caso de borda de leitura desatualizada muda, que é exatamente o bug que está sendo corrigido. `tsc`/`build`/`vitest` limpos, mesma baseline de sempre, `git status` limpo. Mesma ressalva honesta já registrada pelo Banco e aceita na rodada anterior: a condição de corrida em si não foi (nem poderia ser, neste ambiente) reproduzida contra o Supabase real — a prova é de leitura de código e paridade estrutural com o padrão já em produção, não de reprodução do bug original.

---

## 11. Validação da 4ª rodada do Visual (2026-08-19)

Escopo: 8 commits do Visual, do topo de `54be6bf6` até `e08aa37f`. Nada corrigido por mim — só validação.

### 11.1. Commits (`git log --oneline -10`) / `git status --short`

```
e08aa37f fix: log autosave failures in GeneratedStoreEditorPage instead of swallowing them
45b6e165 chore: remove unused Lucide icon imports from help/guides
237987af chore: remove unused SupplierProduct type import and loop index in SupplierCompareModal
a3f551e4 chore: remove dead SkeletonCard component and allLoaded local from ProductImagesDownload
96997666 chore: remove unused imports and queryClient from CatalogPage
f1818e5b perf: remove unused per-supplier message count query in useSupplierChat
f7733a03 fix: log realtime refetch failures in StoreProjectsPage instead of swallowing them
636fc153 chore: remove unused toast import and isFreePlan local from StoreProjectsPage
54be6bf6 fix: publishProject re-lê metadata do banco em vez de snapshot em memória
```
Os 8 commits confirmados no topo, na ordem esperada, em cima de `54be6bf6`. `git status --short` só mostra `02_visual_relatorio.md` modificado (relatório da própria rodada), `.DS_Store`, e os `.md` de relatório não rastreados — mesma assinatura de "árvore limpa" das rodadas anteriores.

### 11.2. Releitura de cada diff (`git show <hash>`)

Todos os 6 commits de remoção de código morto (`636fc153`, `96997666`, `a3f551e4`, `237987af`, `45b6e165`, e a metade "remove query" de `f1818e5b`) foram conferidos linha a linha, e depois grepados no arquivo inteiro pra confirmar zero uso restante:

- `toast`/`isFreePlan` (`StoreProjectsPage.tsx`) — sem ocorrências restantes.
- `count`/`useState`/`useCallback` (`useSupplierChat.ts`) — sem ocorrências restantes.
- `supabase`/`Plug`/`SlidersHorizontal`/`queryClient` (`CatalogPage.tsx`) — sem ocorrências restantes (`supabaseUrl`, que é outro símbolo, continua em uso normalmente).
- `SkeletonCard`/`allLoaded` (`ProductImagesDownload.tsx`) — sem ocorrências restantes.
- `SupplierProduct` (`SupplierCompareModal.tsx`) — sem ocorrências restantes; o índice `i` do loop também não é mais usado no JSX (`key={sp.id}` já cobria a key).
- `ShieldCheck`/`Store`/`ImageIcon`/`Zap` (`help/guides.ts`) — sem ocorrências restantes.

Os dois commits de log-de-erro (`e08aa37f`, `f7733a03`) só trocam `.catch(() => {})` / `catch(() => { /* autosave silencioso */ })` por `catch((error) => { console.error(...) })` — nenhuma outra linha tocada, nenhum toast/estado novo, nenhuma mudança de UI. Confirmado que o caminho feliz (save/refetch sem erro) é idêntico a antes: o `console.error` só executa dentro do `catch`, que só dispara em falha.

### 11.3. `f1818e5b` (`useSupplierChat.ts`) em detalhe

A query removida era um `select("id", { count: "exact", head: true })` em `chat_messages`, cujo único resultado desestruturado (`count`) não aparecia em nenhuma outra linha do arquivo — confirmado por grep, zero ocorrências de `count` fora do próprio bloco removido. `unread` (linha 90 do arquivo atual) continua exatamente como antes da mudança: `unread: 0, // simplified — no read tracking yet` — hardcoded, não derivado da query removida. Ou seja, a query nunca alimentava `unread` nem nenhum outro campo do retorno; era puro round-trip descartado. Nada que dependia dela quebrou porque nada dependia dela.

### 11.4. Build / typecheck / testes

```
npx tsc --noEmit -p tsconfig.app.json   → exit 0, sem erros
npm run build                            → exit 0, mesmos warnings pré-existentes de chunk grande, nada novo
npx vitest run                           → Test Files 2 failed | 12 passed (14) — Tests 32 failed | 106 passed (138)
```
Mesma baseline de sempre (idêntico às seções 2, 7, 9 e 10.3 acima) — nenhuma falha nova, nenhuma correção nova.

### 11.5. `git status` final

```
 M 02_visual_relatorio.md
 M public/.DS_Store
?? .playwright-manual-capture.mjs
?? 00_maestro_relatorio.md
?? 01_banco_relatorio.md
?? 03_testes_relatorio.md
```
Nenhuma mudança de código não commitada por mim — só relatórios e `.DS_Store`.

### 11.6. Veredito

**Segura para deploy em produção.** Todas as 6 remoções de código morto foram confirmadas sem uso restante em nenhum outro ponto dos respectivos arquivos. Os 2 commits de log-de-erro só adicionam `console.error` dentro de `catch`s que antes eram vazios/silenciosos — zero mudança no caminho feliz, zero UI nova. Em `f1818e5b`, `unread` continua vindo do mesmo hardcode `0` de antes, não da query removida — nada quebrou. `tsc`/`build` limpos, `vitest` na mesma baseline de `32 failed | 106 passed`, `git status` limpo (exceto relatórios/`.DS_Store`, padrão já estabelecido).

---

## 12. Validação da 6ª rodada do Banco (2026-08-19) — commit `6599f50a`

Escopo: 1 commit do Banco, sobre correção de RPC de afiliado e remoção de 3 queries mortas em `profiles.select("role")`. Não toquei nos ~36 arquivos `D` travados em `src/components/ui/` (item #21, do Visual) — não fazem parte desta tarefa e permaneceram intocados do início ao fim.

### 12.1. `git log --oneline -5` / `git status --short`

```
cb0d36cc docs: log Banco's 6th continuous-mode round in 01_banco_relatorio.md
6599f50a fix: correct admin role/affiliate RPC calls and drop dead any-casts
e362c4db docs: log Visual's 5th continuous-mode round in 02_visual_relatorio.md
dd4a7d15 docs: log Banco's 5th continuous-mode round in 01_banco_relatorio.md
7e3b9a69 docs: log Visual's 4th continuous-mode round in 02_visual_relatorio.md
```
`6599f50a` confirmado presente (não no topo absoluto — `cb0d36cc`, o commit de log do próprio relatório do Banco, ficou por cima dele, o que é esperado). `git status --short` mostra exatamente os ~36 `D ` esperados em `src/components/ui/` (travados, não tocados), `.DS_Store`, e os `.md` de relatório — nada de código fora do que o commit já trouxe.

### 12.2. Releitura do diff completo (`git show 6599f50a`)

Três arquivos tocados, confirmado item a item:
- **`AdminCommissionsPage.tsx`**: troca `p_affiliate_code: selectedCode` por `p_query: selectedCode ?? ""` na chamada de `rpc_admin_affiliate_details`; remove `as any` de 12 chamadas `supabase.from(...)`/`.rpc(...)` cujas tabelas já são tipadas. Nenhuma lógica de negócio tocada — só nome do parâmetro e casts.
- **`DashboardSidebar.tsx`**: remove 2 chamadas `(supabase as any).from("profiles").select("role")` (uma por `user_id`, outra por `id`) de dentro do `Promise.allSettled` de `resolveAdminRole`; remove 1 chamada equivalente em `resolveAffiliateApplication`... não, essa segunda função só perdeu os `as any`/eslint-disable de `affiliate_applications`/`affiliates`, sem remover query nenhuma ali. Confirmado no diff: a única remoção de query nessa função foi as 2 de `profiles.select("role")` em `resolveAdminRole`.
- **`DashboardLayout.tsx`**: remove 1 chamada `(supabase as any).from("profiles").select("role").eq("user_id", ...)` de dentro do `Promise.allSettled` de `resolveRole`, e o bloco `if (profileByUserId.status === "fulfilled" ...)` que só existia para consumir aquele resultado.

Total: 3 queries `profiles.select("role")` removidas (2 em `DashboardSidebar.tsx`, 1 em `DashboardLayout.tsx`), como o relatório descreve.

### 12.3. `profiles` não tem coluna `role`

Conferido em `src/integrations/supabase/types.ts:1696-1726` (bloco `profiles: { Row: {...} }`): lista completa de colunas inclui `is_admin: boolean` mas nenhuma `role`. Confirma que as 3 queries removidas de fato apontavam para uma coluna inexistente — toda query dessas sempre falhava no Postgres/PostgREST, e como estava dentro de `Promise.allSettled`, virava `status: "rejected"` silenciosamente, sem log, sem nunca contribuir com nenhum candidato de role.

### 12.4. Outras fontes de verificação de admin continuam intactas

- **`DashboardSidebar.tsx` (`resolveAdminRole`, linhas ~481-522 do arquivo atual)**: `hasAdminRole` continua calculado por `role === "admin" || metadataRole === "admin" || isAdminEmail(user.email)` antes mesmo da parte assíncrona (linha 487); dentro do `Promise.allSettled`, `supabase.rpc("is_admin", { _user_id: user.id })` continua intacto (linha 496) e `supabase.from("user_roles").select("role")` também (linha 497). `roleCandidates` ainda inclui `role`, `metadataRole`, `isAdminEmail(...)`, o resultado do RPC `is_admin`, e o resultado de `user_roles.role` — só perdeu os 2 candidatos que vinham de `profiles.select("role")`, que **nunca chegavam a entrar em `roleCandidates`** porque a query sempre falhava (rejected). Ou seja: remover não muda quem é admin hoje, porque essas 2 fontes nunca contribuíam com nada de qualquer forma.
- **`DashboardLayout.tsx` (`resolveRole`, linhas ~364-394)**: `candidates` parte de `[emailRole, emailAffiliateRole, role, metadataRole]` (linha 374), depois soma `user_roles.role` (linha 380-382, intacto) e `"affiliate"` via `affiliates.user_id` (linha 383-385, intacto). A única fonte removida (`profileByUserId` via `profiles.select("role")`) também nunca contribuía — mesma lógica do item acima.

Confirmado: nenhuma das quatro fontes reais de admin (RPC `is_admin`, `user_roles.role`, e-mail, metadata) foi tocada — só as 3 queries que sempre falhavam e nunca alimentavam nada.

### 12.5. Nome do parâmetro `p_query` bate com a assinatura real

`src/integrations/supabase/types.ts:3578-3581`:
```ts
rpc_admin_affiliate_details: {
  Args: { p_from?: string; p_query: string; p_to?: string }
  Returns: Json
}
```
`p_query` é exatamente o nome exigido pela assinatura atual (tipada), e é obrigatório (sem `?`) — o commit manda `p_query: selectedCode ?? ""`, cobrindo o caso de `selectedCode` nulo/undefined sem quebrar o tipo. Bate.

### 12.6. Build / typecheck / testes

```
npx tsc --noEmit -p tsconfig.app.json   → exit 0, sem erros
npm run build                            → exit 0, mesmos warnings pré-existentes de chunk grande, nada novo
npx vitest run                           → Test Files 2 failed | 12 passed (14) — Tests 32 failed | 106 passed (138)
```
Mesma baseline de sempre — nenhuma falha nova.

### 12.7. `git status` final

Idêntico ao inicial: só `.DS_Store`, os ~36 `D ` travados do item #21 (intocados), e os `.md` de relatório. Nenhuma mudança de código feita por mim.

### 12.8. Veredito

**Segura para deploy em produção.** Os dois achados do Banco são reais e a correção é exatamente do tamanho do problema: (1) a RPC de detalhe de afiliado batia numa sobrecarga antiga por nome de parâmetro errado — `p_query` confirmado como o nome certo contra a assinatura tipada em `types.ts`, sem mudança de comportamento visível além de a tela passar a usar a lógica de busca correta e atual; (2) as 3 queries `profiles.select("role")` eram mortas desde sempre (coluna `role` não existe em `profiles`, só `is_admin`), sempre falhavam silenciosamente dentro de `Promise.allSettled`, e — confirmado nos dois arquivos — nunca alimentavam nenhum `candidates`/`roleCandidates`, então removê-las não muda quem é considerado admin ou afiliado hoje. As demais fontes de verificação (RPC `is_admin`, `user_roles.role`, e-mail, metadata) permanecem intactas em ambos os arquivos. `tsc`/`build` limpos, `vitest` na mesma baseline de `32 failed | 106 passed`, `git status` limpo (fora dos `D` travados do Visual, que não fazem parte desta tarefa e não foram tocados).

---

## 13. Validação da 6ª rodada do Visual (2026-08-19) — commit `b548eae0`

Escopo: 1 commit do Visual, `aria-label` em 15 botões só-com-ícone em 12 arquivos (modais, chats, editor de loja). Não toquei nos 37 arquivos `D` travados em `src/components/ui/` (item #21) — confirmados intocados do início ao fim desta validação.

### 13.1. `git log --oneline -5` / `git status --short`

```
1cf378fe docs: log Visual's 6th continuous-mode round in 02_visual_relatorio.md
b548eae0 fix: add aria-label to icon-only buttons across dashboard/chat/editor
cb0d36cc docs: log Banco's 6th continuous-mode round in 01_banco_relatorio.md
6599f50a fix: correct admin role/affiliate RPC calls and drop dead any-casts
e362c4db docs: log Visual's 5th continuous-mode round in 02_visual_relatorio.md
```
`b548eae0` confirmado presente logo abaixo do commit de log do próprio Visual (`1cf378fe`), consistente com o padrão das rodadas anteriores. `git status --short` mostra exatamente os 37 `D ` esperados em `src/components/ui/` (recontados manualmente: `git status --short | grep "^ D " | wc -l` → 37), `.DS_Store`, e os `.md` de relatório — nada de código fora do que o commit trouxe.

### 13.2. Releitura completa do diff (`git show b548eae0`)

`git show --stat`: 12 arquivos, 20 inserções / 12 deleções. Confirmado por dois cortes:
- Todas as **20 linhas adicionadas** contêm `aria-label` (`grep -E "^\+" ... | grep -vc "aria-label"` → 0) — nenhuma linha adicionada introduz nada além do atributo.
- As **12 linhas removidas** são, uma a uma, a mesma linha de `<button>` de antes (mesmo `onClick`, mesma `className`, mesmo conteúdo interno) só sem o `aria-label` — comparação lado a lado confirma que nenhuma reescreveu classe, handler ou estrutura JSX.

Os 15 rótulos cobrem exatamente o que o relatório descreve: fechar modal (`X`) em 9 pontos, voltar (`ArrowLeft`) em 2, enviar/anexar (`Send`/`Paperclip`) em `ChatFornecedoresPage.tsx`, toggle de IA com rótulo dinâmico (`Ativar`/`Desativar assistente de IA`, cobrindo o caso em que o texto visível "IA" some em mobile via `hidden sm:inline`), aumentar/diminuir ícone e excluir elemento no editor de loja, e mostrar histórico/novo chat em `GitChatPage.tsx`/`AtlasChatPage.tsx`. Nenhuma mudança de classe Tailwind, nenhuma reordenação de JSX, nenhum novo estado ou handler — só o atributo.

### 13.3. Build / typecheck / testes

```
npx tsc --noEmit -p tsconfig.app.json   → exit 0, sem erros
npm run build                            → exit 0, mesmos warnings pré-existentes de chunk grande, nada novo
npx vitest run                           → Test Files 2 failed | 12 passed (14) — Tests 32 failed | 106 passed (138)
```
Mesma baseline de sempre — nenhuma falha nova, coerente com uma mudança que não tem nenhum efeito em runtime além do DOM attribute.

### 13.4. `git status` final

37 `D ` do item #21 recontados, intocados; `.DS_Store`; `.md` de relatório. Nenhuma mudança de código feita por mim.

### 13.5. Veredito

**Segura para deploy em produção.** O commit `b548eae0` é puramente aditivo — confirmado que todas as 20 linhas adicionadas contêm só o atributo `aria-label` e todas as 12 linhas removidas são idênticas às originais menos esse atributo, sem tocar `className`, `onClick` ou estrutura JSX em nenhum dos 12 arquivos. Zero mudança visual pra usuário vidente, zero mudança de comportamento — só acessibilidade real pra leitor de tela em botões que hoje não anunciam nada (fechar, voltar, enviar, anexar, excluir, toggle de IA). `tsc`/`build` limpos, `vitest` na mesma baseline de `32 failed | 106 passed`, `git status` limpo fora dos 37 `D` travados do item #21 (não tocados, fora do escopo desta tarefa).

---

## 14. Validação da 7ª rodada do Banco (2026-08-19) — commit `bb9c7ce6`

Escopo: 1 commit do Banco, remoção de leitura/gravação da coluna descontinuada `affiliates.commission_rate` em `CommissionsPage.tsx`, incluindo um `UPDATE` de sincronia que rodava a cada carregamento da tela. Não toquei nos 37 arquivos `D` travados em `src/components/ui/` (item #22) — confirmados intocados do início ao fim.

### 14.1. `git log --oneline -5` / `git status --short`

```
c45d8a90 docs: log Banco's 7th continuous-mode round in 01_banco_relatorio.md
bb9c7ce6 chore: stop reading/writing deprecated affiliates.commission_rate from client
1cf378fe docs: log Visual's 6th continuous-mode round in 02_visual_relatorio.md
b548eae0 fix: add aria-label to icon-only buttons across dashboard/chat/editor
cb0d36cc docs: log Banco's 6th continuous-mode round in 01_banco_relatorio.md
```
`bb9c7ce6` confirmado presente, logo abaixo do commit de log do próprio Banco (`c45d8a90`), padrão de sempre. `git status --short` mostra os 37 `D ` esperados (recontados: `grep "^ D " | wc -l` → 37), `.DS_Store`, e os `.md` de relatório — nada além do commit.

### 14.2. Releitura do diff (`git show bb9c7ce6`)

Único arquivo tocado: `src/pages/dashboard/CommissionsPage.tsx`. Confirmado item a item:
- 4 `.select(...)` em `affiliates` perderam `commission_rate` da lista de colunas.
- O gatilho de sync (`if (existing.ref !== code || existing.link !== canonicalLink || Number(existing.commission_rate) !== COMMISSION_RATE)`) perdeu a terceira condição, e o `.update(...)` correspondente perdeu `commission_rate: COMMISSION_RATE` — esse era o `UPDATE` desnecessário que rodava a cada carregamento sempre que a coluna divergisse da constante.
- `insert`/`update`/fallback de criação de código de afiliado pararam de gravar `commission_rate: COMMISSION_RATE`.
- Os 6 pontos que montavam `AffiliateLinkResponse` trocaram `Number(x.commission_rate ?? COMMISSION_RATE) || COMMISSION_RATE` por `COMMISSION_RATE` direto — mesmo valor final, já que a constante já era o fallback.

Nenhuma outra lógica tocada (código do afiliado, link canônico, `is_active`, tratamento de erro seguem intactos).

### 14.3. `commissionRate`/`commission_rate` nunca aparece em JSX

```
grep -n "commissionRate\|commission_rate" src/pages/dashboard/CommissionsPage.tsx
```
Achados: a declaração de tipo (`commissionRate?: number`), as 6 atribuições `commissionRate: COMMISSION_RATE` (puramente de dados, dentro de `queryFn`), e 2 ocorrências de `row.commission_rate` nas linhas 99/125 — mas essas são de `AffiliateSourceRow` (linha `mapAffiliateConversionToCommission`/`mapAffiliateSaleToCommission`), que lê de **outra fonte** (`affiliate_conversions`/vendas), não da tabela `affiliates` — é exatamente a coluna que o relatório descreve como a fonte real e não-descontinuada da taxa por ciclo; o commit não tocou nelas, corretamente.

`grep -n "commissionRate" src/components/dashboard/AffiliateFinanceDashboard.tsx` só bate a declaração de tipo (`commissionRate?: number`) — nenhuma leitura em JSX. Conferido também que a tela mostra o valor **fixo**: linha 185 (`value: "30%"`) e linha 467 (`<span ...>30%</span>`), texto literal, não interpolado de `affiliateLink.commissionRate`. Nenhum `.commissionRate` (com ponto, acesso à propriedade) aparece em nenhum dos dois arquivos — confirma que o campo é escrito mas nunca lido/renderizado, exatamente como o relatório afirma.

### 14.4. Build / typecheck / testes

```
npx tsc --noEmit -p tsconfig.app.json   → exit 0, sem erros
npm run build                            → exit 0, mesmos warnings pré-existentes de chunk grande, nada novo
npx vitest run                           → Test Files 2 failed | 12 passed (14) — Tests 32 failed | 106 passed (138)
```
Mesma baseline de sempre.

### 14.5. `git status` final

37 `D ` do item #22 recontados, intocados; `.DS_Store`; `.md` de relatório. Nenhuma mudança de código feita por mim.

### 14.6. Veredito

**Segura para deploy em produção.** Confirmado por grep independente (não só pela palavra do relatório) que `commissionRate`/`commission_rate` da tabela `affiliates` nunca chega a nenhum JSX em `CommissionsPage.tsx` nem `AffiliateFinanceDashboard.tsx` — a tela sempre mostrou "30%" fixo como texto literal. As duas ocorrências restantes de `row.commission_rate` no arquivo vêm de uma fonte diferente (`affiliate_conversions`, não descontinuada) e não foram tocadas pelo commit, corretamente. A remoção elimina só leitura/gravação morta e um `UPDATE` de sincronia supérfluo que rodava a cada carregamento — sem mudar nenhum valor exibido. `tsc`/`build` limpos, `vitest` na mesma baseline de `32 failed | 106 passed`, `git status` limpo fora dos 37 `D` travados do item #22 (não tocados, fora do escopo desta tarefa).

---

## 15. Validação da 7ª rodada do Visual (2026-08-19) — commit `bfa7a322`

Escopo: 1 commit do Visual, `overflow-x: auto` na tabela de pedidos de `PagamentosPage.tsx` (`/dashboard/pagamentos`) pra rolar no celular, mesmo padrão de `TransacoesPage.tsx`. Não toquei nos 37 arquivos `D` travados em `src/components/ui/` (item #22) — confirmados intocados.

### 15.1. `git log --oneline -5` / `git status --short`

```
5e31d918 docs: log Visual's 7th continuous-mode round in 02_visual_relatorio.md
bfa7a322 fix: make PagamentosPage orders table horizontally scrollable on narrow screens
c45d8a90 docs: log Banco's 7th continuous-mode round in 01_banco_relatorio.md
bb9c7ce6 chore: stop reading/writing deprecated affiliates.commission_rate from client
1cf378fe docs: log Visual's 6th continuous-mode round in 02_visual_relatorio.md
```
`bfa7a322` confirmado presente, logo abaixo do commit de log do próprio Visual (`5e31d918`). `git status --short` mostra os 37 `D ` esperados (recontados: `grep "^ D " | wc -l` → 37), `.DS_Store`, `.md` de relatório — nada além do commit.

### 15.2. Releitura do diff (`git show bfa7a322`)

Diff de exatamente 2 linhas adicionadas em `src/pages/dashboard/PagamentosPage.tsx`: uma abertura `<div style={{ overflowX: "auto" }}>` logo antes do `<table>` existente, e o `</div>` de fechamento correspondente logo depois do `</table>`. Nenhuma outra linha tocada — conferi lendo o arquivo inteiro na região (linhas 190-248): as 6 colunas (Pedido, Produto, Frete, Status do pagamento, Status de envio, Data), o `.map` de `orders`, os handlers `onMouseEnter`/`onMouseLeave`, os componentes `PaymentStatusBadge`/`FulfillmentStatusBadge`, e toda a formatação (`formatBRL`, cores, `key`) permanecem idênticos — só a tabela ganhou um wrapper por fora.

### 15.3. Comparação com `TransacoesPage.tsx`

```
grep -n "overflow" TransacoesPage.tsx → linha 237: <div style={{ overflowX: "auto" }}>
```
Mesmo padrão exato: `<div style={{ overflowX: "auto" }}>` envolvendo diretamente um `<table style={{ width: "100%", borderCollapse: "collapse" }}>`, sem nenhuma outra propriedade CSS na wrapper. `PagamentosPage.tsx` agora replica essa mesma estrutura ao caractere.

### 15.4. Build / typecheck / testes

```
npx tsc --noEmit -p tsconfig.app.json   → exit 0, sem erros
npm run build                            → exit 0, mesmos warnings pré-existentes de chunk grande, nada novo
npx vitest run                           → Test Files 2 failed | 12 passed (14) — Tests 32 failed | 106 passed (138)
```
Mesma baseline de sempre.

### 15.5. `git status` final

37 `D ` do item #22 recontados, intocados; `.DS_Store`; `.md` de relatório. Nenhuma mudança de código feita por mim.

### 15.6. Veredito

**Segura para deploy em produção.** O commit `bfa7a322` é uma mudança de wrapper de 2 linhas, confirmada por leitura completa do bloco tocado: nenhuma coluna, dado, handler ou lógica da tabela foi alterada — só o container por fora ganhou `overflowX: "auto"`, replicando exatamente o padrão já em produção em `TransacoesPage.tsx` (mesmo estilo, mesma estrutura de wrapper direto em volta do `<table>`). No desktop não muda nada visualmente (a tabela já cabia); no mobile, destrava a rolagem horizontal para colunas que antes ficavam cortadas e inacessíveis (`overflow: hidden` sem esse wrapper). `tsc`/`build` limpos, `vitest` na mesma baseline de `32 failed | 106 passed`, `git status` limpo fora dos 37 `D` travados do item #22 (não tocados, fora do escopo desta tarefa).
