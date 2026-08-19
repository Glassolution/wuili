# Relatório VISUAL — Rotina diária Velo

Data: 2026-08-18
Estado inicial do repo: `93cf9440` (após commit do BANCO removendo `useDashboard.ts` morto)
Estado final: `ce2ba9b3`

Observação de contexto: o `CLAUDE.md` descreve o stack como "Next.js 14 + App Router", mas o projeto real é **Vite + React + TypeScript + Tailwind** (confirmado por `package.json` — `"vite build"`, `vite.config.ts`, ausência de `src/app/`). O CLAUDE.md está desatualizado nesse ponto; não editei o arquivo pois isso é documentação, fora do meu escopo de código.

---

## 1. Investigação realizada

- `npx tsc --noEmit -p tsconfig.app.json` — sem erros de tipo no estado inicial.
- `npx eslint . --ext .ts,.tsx` — 334 problemas no total, mas a esmagadora maioria (`@typescript-eslint/no-explicit-any`) está em `supabase/functions/` (Deno, fora do meu escopo de frontend). Filtrei só `src/` e revisei cada ocorrência relevante.
- `npx knip` — ferramenta de detecção de arquivos/exports/dependências mortas. Resultado: **290 arquivos não referenciados por nenhum import** no projeto (a maioria fora de `src/`: `api/`, `scratch/`, `server/`, arquivos de teste manuais). Dentro de `src/`, isso inclui componentes de dashboard, admin, landing e uma página inteira de redesenho do dashboard não roteada.
- `npx vitest run` — 32 testes falhando em `src/lib/financial.bug-condition.test.ts` e `financial.preservation.test.ts`. Confirmei via `git stash` que essas falhas **já existiam antes de qualquer mudança minha** (são testes que documentam um bug de dados financeiros mockados — território do agente BANCO, não mexi neles).
- Busca manual por bugs visuais comuns: catch vazio (nenhum encontrado), `console.log` de debug esquecido (3 arquivos), condicionais com truthiness constante (`no-constant-binary-expression`, 1 ocorrência).
- Auditoria de roteamento: comparei todo componente/página "órfão" (sem import externo) contra `src/App.tsx` para confirmar se realmente não é alcançável por nenhuma rota, antes de propor qualquer remoção.

---

## 2. O que foi corrigido/limpo (executado, com prova)

### 2.1 Removidos 5 templates de produto mortos (commit `2cec23a7`)
Arquivos removidos: `src/components/store-templates/ProductTemplate.tsx`, `ProductTemplate4.tsx`, `ProductTemplateBeauty.tsx`, `ProductTemplateShopify.tsx`, `ProductPageTemplate.tsx` (1974 linhas no total).

**Prova de que estavam mortos:** `src/components/store-templates/productTemplateRegistry.ts` só registra `ProductTemplateBlue` e `ProductTemplateBlack`:
```ts
export const PRODUCT_TEMPLATES = {
  [BLUE_PRODUCT_TEMPLATE_ID]: { Component: ProductTemplateBlue, ... },
  [BLACK_PRODUCT_TEMPLATE_ID]: { Component: ProductTemplateBlack, ... },
} as const;
```
com o comentário explícito: *"IDs removidos ou desconhecidos sempre caem no template atual"* — confirmando que os templates antigos foram deliberadamente descontinuados no design do próprio registry. `grep -rn "ProductTemplate4\|ProductTemplateBeauty\|ProductTemplateShopify\|ProductPageTemplate"` em `src/` não retornou nenhuma referência externa antes da remoção.

**Validação pós-remoção:**
- `npx tsc --noEmit -p tsconfig.app.json` → sem erros.
- `npm run build` → build completo, sem erros (`✓ built in 6.42s`).
- `npx vitest run` → mesmas 32 falhas pré-existentes (confirmado com `git stash`/`stash pop` antes da remoção, mesmo resultado).

Commit: `2cec23a7 chore: remove dead product page templates (unused, superseded by registry)`.

### 2.2 Removidos 2 `console.log` de debug no fluxo de publicação ML (commit `ce2ba9b3`)
Em `src/components/dashboard/ImportProductModal.tsx`, linhas que logavam o corpo completo do request e da resposta da Edge Function `ml-publish` no console do navegador (sem comentário indicando uso intencional, ao contrário de `MercadoPagoCallbackPage.tsx`, onde logs semelhantes têm o comentário `// Dump completo... para diagnóstico` e por isso **não foram tocados**, ver seção 3).

**Prova:** `git diff src/components/dashboard/ImportProductModal.tsx` no commit `ce2ba9b3` mostra apenas a remoção das duas linhas `console.log(...)`, sem nenhuma outra mudança de lógica. `npx tsc --noEmit` limpo após a mudança; `npx eslint` no arquivo mostra só os 6 erros `no-explicit-any` pré-existentes (não relacionados).

Commit: `ce2ba9b3 chore: remove leftover debug console.log from ml-publish flow`.

---

## 3. Propostas que precisam da sua aprovação (investigadas, NÃO executadas)

### 3.1 Página inteira órfã: "Redesign" do dashboard (não roteada)
`src/pages/dashboard/DashboardRedesignPage.tsx` não aparece em nenhuma `<Route>` de `src/App.tsx` (busquei por `DashboardRedesignPage` e `redesign` no arquivo de rotas — zero ocorrências). Ela é a única consumidora de todo um cluster de componentes exclusivos em `src/components/dashboard/redesign/` (`BannerIA.tsx`, `DashboardRedesign.tsx`, `Header.tsx`, `MetricCard.tsx`, `MiniMetrics.tsx`, `ProductsTable.tsx`, `SalesChart.tsx`, `Sidebar.tsx`) e de `src/components/dashboard/DashboardLayoutNew.tsx`. Dentro de `redesign/Sidebar.tsx:149` há inclusive um resto de código morto (`{false && isAdmin && null}`, pego pelo eslint `no-constant-binary-expression`) — sintoma de que esse experimento de redesign foi abandonado sem limpeza.
**Proposta:** remover a página + os componentes exclusivos dela, se confirmado que não há plano de retomar esse redesign. Não removi porque é uma página inteira (fora do meu escopo autônomo).

### 3.2 Página órfã com debug de dados sensíveis: `ProductsPage.tsx`
`src/pages/dashboard/ProductsPage.tsx` é importado com `lazy()` em `App.tsx:68`, mas **nunca usado em nenhuma `<Route>`** (busquei `<ProductsPage` no arquivo — zero ocorrências; a rota real de produtos em alta usa `TrendingProductsPage`, não esta). O arquivo loga `Supabase URL`, `User ID` e o retorno bruto da query no console (`console.log("User ID:", user?.id)` etc.) e tem um `// TODO: Implementar sincronização real com integrações` na linha 75.
**Proposta:** se a página é mesmo obsoleta, removê-la (e o import morto em `App.tsx`) elimina o vazamento de debug junto. Não removi por ser uma página inteira.

### 3.3 ~20 componentes de dashboard/admin sem nenhuma referência no código
Confirmei individualmente (grep direto, sem match fora do próprio arquivo) que estes componentes não são importados em lugar nenhum de `src/`:
`AffiliateVisitTracker.tsx`, `PromoCountdown.tsx`, `StartModeOffsetManager.tsx`, `brand/BrandMark.tsx`, `admin/AdminSidebar.tsx`, `admin/AdminWithdrawalsPanel.tsx`, `dashboard/AtlasReopenButton.tsx`, `dashboard/CollectionPickerModal.tsx`, `dashboard/CommunityAnnouncementModal.tsx`, `dashboard/CreateSalesPageModal.tsx`, `dashboard/DashboardTopbar.tsx`, `dashboard/MLReconnectBanner.tsx`, `dashboard/OnboardingHome.tsx`, `dashboard/OwnProductsPanel.tsx`, `dashboard/PixKeyModal.tsx`, `dashboard/ProductScoutAI.tsx`, `dashboard/RefundSection.tsx`, `dashboard/SupportAttachment.tsx`, `dashboard/TikTokShopIntegrationCard.tsx`, `dashboard/TutorialModal.tsx`, `tour/TourWelcomeModal.tsx`.

**Por que não removi:** vários lidam com dinheiro/integrações (Pix, reembolso, TikTok Shop) — se estão desconectados por engano (feature quebrada) em vez de propositalmente abandonados, apagar seria pior que deixar. Prefiro que você confirme intenção antes. Se quiser, posso remover em lote num próximo ciclo já com sua confirmação.

### 3.4 `src/components/landing/*` parecem órfãos, mas há evidência de trabalho ativo — não mexi
Uma checagem inicial (grep + `knip`) mostrou 12 arquivos em `src/components/landing/` sem nenhum import (`CTASection.tsx`, `HowItWorks.tsx`, `FeaturesSection.tsx`, `FeatureSections.tsx`, `LogosStrip.tsx`, `MultiPlatformSection.tsx`, `PricingSection.tsx`, `ProductsSection.tsx`, `StatsBand.tsx`, `TestimonialsSection.tsx`, `AnywhereSection.tsx`, `CreditBanner.tsx`) — a landing atual (`src/pages/Index.tsx`) é autocontida e não usa nenhum deles.
**Por que não mexi:** `git log` mostra que `PricingSection.tsx` recebeu um commit de conteúdo (`c04e2bf9`, 2026-08-18, mudando texto de planos) no mesmo dia de hoje, por outro colaborador/bot (`gpt-engineer-app[bot]`), apesar de o arquivo não estar conectado a nenhuma rota. Isso sugere trabalho em andamento (talvez uma nova seção de preços a caminho) e não código simplesmente esquecido — não é seguro remover sem confirmar com quem está editando.

### 3.5 34 dependências npm sem nenhum import no código (`knip --dependencies`)
Ex.: `@radix-ui/react-accordion`, `cmdk`, `embla-carousel-react`, `react-hook-form`, `@hookform/resolvers`, `vaul`, `input-otp`, `react-day-picker`, `react-resizable-panels`, `date-fns`, `resend`, entre outras. A maioria sustenta primitivos do `src/components/ui/` (shadcn) que existem como scaffolding padrão mesmo sem uso atual — é convenção comum do shadcn manter o kit completo instalado. Não removi porque mexer em `package.json` tem raio de ação maior (pode afetar builds/outros agentes) e o ganho real de bundle é baixo (código não importado já não entra no bundle pelo tree-shaking do Vite). Se quiser reduzir superfície do `package.json`, posso levantar uma lista final revisada.

---

## 4. Resumo de commits desta sessão

```
ce2ba9b3 chore: remove leftover debug console.log from ml-publish flow
2cec23a7 chore: remove dead product page templates (unused, superseded by registry)
```

Ambos acima do commit inicial do BANCO (`93cf9440`). Árvore de trabalho limpa ao final (só seguem não commitados: `public/.DS_Store` modificado e `.playwright-manual-capture.mjs` não rastreado — nenhum dos dois é meu, não toquei).

---

# 2ª rodada — 2026-08-19

Escopo desta rodada, decidido pelo Maestro: **pode executar sem aprovação** quebra de arquivos grandes e consolidação de duplicação, desde que sem mudança visível; **precisa de aprovação** normalizar `strokeWidth` de ícones Lucide e revisar uso de verde fora de indicadores de margem/lucro (mudança visual em escala, mesmo que pareça pequena por item).

Estado inicial: `051687c0` (merge mais recente, já incluindo a correção de segurança `b5643859` do Banco e o trabalho da Lovable). Estado final: `d34f2172`.

Antes de começar, reconferi `git log --oneline -5` e `git status --short` como pedido — bateu exatamente com o esperado (repo limpo, só arquivos de relatório/`.DS_Store` não rastreados).

**Nota à parte, sem ação minha:** o relatório do Banco/Maestro (`00_maestro_relatorio.md`) descreve uma falha de segurança no "widget de busca do Atlas (ProductScoutAI)". Reconferi e `src/components/dashboard/ProductScoutAI.tsx` continua sem nenhuma referência em `src/` (mesmo resultado da 1ª rodada) — ou seja, ou o achado do Banco é sobre a Edge Function (`atlas-search`, já corrigida em `b5643859`) e "ProductScoutAI" é só o nome do recurso, não deste arquivo React específico, ou há algo que meu grep não está pegando. Não mexi em nada disso (é escopo do Banco/segurança), só deixo registrado pra não ficar uma contradição silenciosa entre os dois relatórios.

## 1. Commits executados (refactor puro, sem aprovação — dentro do escopo liberado)

### 1.1 `DashboardSidebar.tsx`: objeto `styles` extraído (commit `d69254e0`)
O componente tinha 1430 linhas, das quais 584 (linhas 194–777) eram um único objeto `styles` estático de `CSSProperties` — sem closure sobre props/state, só valores fixos. Movido para `src/components/dashboard/DashboardSidebar.styles.ts`, reimportado de volta.

**Prova de que é só relocação, nenhum valor mudou:**
```
diff <(git show HEAD~1:.../DashboardSidebar.tsx | sed -n '194,777p') \
     <(tail -n +3 DashboardSidebar.styles.ts | sed '1s/export const/const/')
```
→ diff vazio (exit 0). `npx tsc --noEmit -p tsconfig.app.json` limpo, `npm run build` limpo. Arquivo principal caiu de 1430 para 846 linhas.

### 1.2 `GeneratedStoreEditorPage.tsx`: tipos/constantes/helpers extraídos (commit `d34f2172`)
Este é o maior arquivo do projeto (4955 linhas — o segundo maior, `types.ts`, é gerado automaticamente pelo Supabase e não conta). As primeiras 249 linhas eram tipos, constantes puras e funções utilitárias sem closure sobre o estado do componente (`getAllImages`, `formatBRL`, `hslToHex`, `colorToHex`, `renderIconMarkup`, `catalogTaxonomy`, registro de ícones, presets de botão/texto). Movidas para `src/pages/GeneratedStoreEditorPage.helpers.tsx`, todas exportadas e reimportadas no arquivo principal. Também limpei 12 imports de ícones `lucide-react` (`Shirt`, `Laptop`, `Baby`, `PawPrint`, `HeartPulse`, `Dumbbell`, `Gamepad2`, `Car`, `BookOpen`, `Boxes`, `ShoppingCart`, `Phone`) que ficaram sem uso no arquivo principal depois da extração (confirmado via grep, 0 ocorrências restantes no corpo do componente).

**Por que não fui além:** as linhas 290–4955 originais são um único componente com todo o estado/hooks interdependentes — dividir isso de verdade (não só tirar o que já era independente) é um refactor de alto risco que exigiria revisão profunda, não algo pra fazer sozinho num passe contínuo. Deixei como proposta separada (seção 2.3 abaixo).

**Prova:**
- `npx tsc --noEmit -p tsconfig.app.json` → limpo.
- `npm run build` → limpo, e o chunk `GeneratedStoreEditorPage-*.js` manteve **exatamente o mesmo tamanho** antes e depois (`184.42 kB` / gzip `45.78 kB`) — evidência de que o bundle final é equivalente, não só "compila".
- `npx vitest run` → `32 failed | 106 passed (138)`, idêntico ao baseline já confirmado pré-existente pelo Testes (`03_testes_relatorio.md`).
- Arquivo principal: 4955 → 4741 linhas. Novo arquivo: 294 linhas.

### 1.3 Duplicação encontrada, mas NÃO consolidada (avaliei e recuei — registro do porquê)
Procurei duplicação real pra consolidar, como pedido. Achei dois clusters grandes:

- **`formatBRL`/`formatPrice`/`formatCurrency` repetido em ~27 arquivos.** Já existe um helper canônico em `src/lib/priceFormat.ts` (`formatPriceBRL`, com guarda `Number.isFinite(value) ? value : 0`). Comparei as ~18 implementações locais lado a lado: a maioria usa `Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"})` sem guarda nenhuma (`.format(value)` direto), algumas fazem `Number(v || 0)` ou `Number(value ?? 0)`. **Não consolidei** porque trocar todas por `formatPriceBRL` mudaria o comportamento em casos de borda (valor `NaN`/`undefined`): hoje algumas telas mostrariam "R$ NaN" e passariam a mostrar "R$ 0,00" — tecnicamente uma correção, mas é uma mudança de comportamento visível, fora do que a regra de hoje autoriza sem aprovação. Fica como proposta (seção 2.1).
- **`getAllImages`/`getFirstImage`/`getProductImage` repetido em ~9 arquivos.** Ao olhar de perto, não é duplicação de verdade em todos os casos — por exemplo `OrderDetailPage.tsx` tem uma função `getProductImage` que recebe um pedido inteiro, não uma lista de imagens; a assinatura e o formato de entrada mudam de arquivo pra arquivo. Consolidar isso sem verificar cada call site individualmente arriscaria comportamento diferente. Não mexi.

## 2. Propostas que precisam da sua aprovação (documentadas, NÃO executadas)

### 2.1 Consolidar as ~18 implementações locais de `formatBRL`/`formatPrice`/`formatCurrency` no helper já existente `formatPriceBRL` (`src/lib/priceFormat.ts`)
Arquivos com implementação local (lista parcial, todas com o mesmo padrão `Intl.NumberFormat("pt-BR", {style:"currency", currency:"BRL"})` ou `.toLocaleString` equivalente): `PlansUpgradeModal.tsx`, `AdminUserDetailModal.tsx`, `SelectProductModal.tsx`, `ImportProductModal.tsx`, `SuggestedProducts.tsx`, `OwnProductsPanel.tsx`, `CheckoutPage.tsx`, `StoreCatalogPage.tsx`, `AdminBlankPage.tsx`, `OrderDetailPage.tsx`, `TransacoesPage.tsx`, `PagamentosPage.tsx`, `PublicationsPage.tsx`, `OrdersPage.tsx`, `CatalogoPage.tsx`, `ClientesPage.tsx`, `TrendingProductsPage.tsx`, `AIChatPage.tsx`, `AdminBlankPage.tsx`, `DashboardHomePage.tsx`, `AtlasChatPage.tsx`, `ResultsPage.tsx`, `AiProductPagesPage.tsx`, `ProdutosMLPage.tsx`.
**Risco identificado:** algumas variantes locais não protegem contra `NaN`/`undefined` (mostrariam "R$ NaN" hoje); trocar todas pelo helper canônico mudaria esse texto pra "R$ 0,00" nesses casos — mudança visível, mesmo que pra melhor. Proposta: aprovar a migração (posso fazer arquivo por arquivo, com commit e captura do antes/depois de cada um) ou manter como está.

### 2.2 Normalizar `strokeWidth` dos ícones Lucide — dados levantados, nada executado
110 arquivos usam `strokeWidth` explícito em ícones Lucide, com **25 valores diferentes** em uso (de `0` a `3`, incluindo casas decimais como `1.85`, `2.05`, `2.35`). Distribuição das ocorrências mais comuns:
```
130× strokeWidth={2}      60× strokeWidth={1.5}     51× strokeWidth={1.7}
122× strokeWidth={1.8}    38× strokeWidth={2.2}     36× strokeWidth={2.4}
 72× strokeWidth={1.9}    35× strokeWidth={2.1}     26× strokeWidth={2.5}
```
Não há nenhuma constante/token de design no código (`grep -rn "STROKE_WIDTH"` não retorna nada) — cada instância foi ajustada manualmente, sem padrão. Prova de que é inconsistência real, não variação proposital: no mesmo arquivo `AiProductPagesPage.tsx`, o mesmo ícone (`WandSparkles`) aparece com `strokeWidth={2.05}` (linha 239), `strokeWidth={2}` (linha 507) e `strokeWidth={2.1}` (linha 1181) — três instâncias do mesmo ícone, três valores diferentes, sem motivo aparente.
**Por que não executei:** normalizar para `1.5` (o valor documentado) mudaria a espessura visível de centenas de ícones em dezenas de páginas do dashboard — é uma mudança visual em escala, mesmo que cada mudança individual seja sutil. Precisa da sua aprovação explícita no chat antes.

### 2.3 Revisar uso de verde fora de indicadores de margem/lucro — dados levantados, nada executado
39 arquivos usam classes Tailwind `text-green-*`/`bg-green-*`/`border-green-*`/`ring-green-*` (ou `emerald-*`). Nem todos são violações óbvias da regra — bati o olho e agrupei:
- **Parecem legítimos (margem/lucro/indicador financeiro):** `CatalogoPage.tsx`, `ReportsPage.tsx`, `TrendingProductsPage.tsx`, `TransacoesPage.tsx` (não confirmei linha a linha, é uma primeira triagem).
- **Fora da regra estrita "só margem/lucro" — mas seguem convenção universal de UI (verde = sucesso/conectado):** status "conectado" em `MercadoPagoIntegrationCard.tsx`, `TikTokShopIntegrationCard.tsx`, `PlatformIntegrationModal.tsx`; toast de sucesso em `src/components/ui/sonner.tsx`; confirmação em `SubscriptionConfirmedPage.tsx`, `CheckoutPage.tsx`, `SalesThankYouPage.tsx`.
- Lista completa dos 39 arquivos está disponível se você quiser — não reproduzo aqui pra não inflar o relatório.

**Por que não executei, e uma ressalva:** trocar "verde = sucesso/conectado" nessas telas por outra cor quebraria uma convenção de UI extremamente comum (quase universal), e várias dessas telas são explicitamente client-facing (checkout, confirmação de assinatura — categorias já protegidas pelo portão de aprovação). Antes de qualquer execução, recomendo confirmar se a regra "verde só pra margem/lucro" é realmente para *todo* uso de verde no produto, ou se o documentado se refere só aos indicadores dentro do dashboard de vendas (nesse caso, os itens de "conectado"/"sucesso" seriam exceções válidas, não violações). Não encontrei essa regra escrita em nenhum `.md` do repo (`CLAUDE.md`, `AGENTS.md`, `VISUAL_REFINEMENT_SUMMARY.md`) — pode valer a pena documentá-la formalmente em algum lugar, se confirmada, pra próximas rodadas não precisarem perguntar de novo.

### 2.4 Achado secundário (não é bug novo, é o mesmo padrão já visto): mais um bloco de JSX morto com `{false && ...}`
Em `GeneratedStoreEditorPage.tsx`, agora na linha 3622 (linha 3836 antes da minha extração — só mudou de número, já existia antes de eu mexer no arquivo), há `{false && activeTemplate.kind === "produto" ? (...) : ...}` — mesmo padrão do achado da 1ª rodada em `redesign/Sidebar.tsx:149`. Pego pelo eslint (`no-constant-condition`, `no-constant-binary-expression`). Como está dentro do componente gigante (não mexi na lógica dele, ver seção 1.2), não removi. Fica registrado como proposta de limpeza pontual de baixo risco, mas dentro de um arquivo de alto risco pra editar.

## 3. Validação final da rodada

```
$ npx tsc --noEmit -p tsconfig.app.json   → limpo
$ npm run build                            → limpo (mesmos warnings pré-existentes de chunk >500kB)
$ npx vitest run                           → 32 failed | 106 passed (138) — baseline pré-existente, inalterado
$ git status --short                       → só public/.DS_Store e arquivos de relatório (nenhum meu não commitado)
```

## 4. Commits desta rodada

```
d34f2172 refactor: extract GeneratedStoreEditorPage's types/constants/helpers
d69254e0 refactor: extract DashboardSidebar inline styles into own module
```
Ambos em cima de `051687c0` (estado no início desta rodada).

---

# 3ª rodada — 2026-08-19

Escopo desta rodada, definido pelo Maestro: procurar áreas novas de frontend não cobertas nas rodadas anteriores — imports não usados, componentes grandes ainda não quebrados, bugs visuais reais, duplicação de lógica de UI, `useEffect` sem cleanup. Prioridade do usuário: menos gambiarra, código organizado, pode refatorar com mais cuidado que o mínimo, validando com Testes depois.

Estado inicial: `5a672a68` (inclui a correção de segurança do atlas-search, o fix de condição de corrida do Banco em `userProjects.ts`, e o texto do botão da landing corrigido direto pelo Maestro). Repo limpo ao conferir `git log`/`git status` (só `.DS_Store` e os `.md` de relatório não rastreados, nenhum meu). Estado final: `087bb692`.

## 1. `useEffect` sem cleanup — retomado, nada de novo encontrado

Reconferi o que tinha ficado pendente da rodada anterior: varri os 63 arquivos que usam `addEventListener`/`setInterval`/`.subscribe(` e comparei contagem de setup vs. cleanup em cada um. Achei 3 mismatches numéricos, investiguei os três a fundo e nenhum é bug real:
- `main.tsx`: 3 `addEventListener` sem remove — são listeners de nível de módulo (recuperação de chunk load error), vivem pelo tempo de vida do app inteiro, não deveriam ter cleanup mesmo.
- `lib/requestTimeout.ts`: 1 `addEventListener` sem remove — usa `{ once: true }`, se autorremove.
- `CheckoutPage.tsx`: `setInterval`×1 vs `clearInterval`×2 — é o padrão defensivo normal (limpa antes de criar + limpa no unmount), não sobra intervalo nenhum.

Todos os `.subscribe(`/`.unsubscribe(`/`removeChannel(` bateram certinho. Não achei nenhum vazamento novo de listener/interval/subscription.

## 2. Executado e commitado (dead code confirmado por `tsc --noUnusedLocals`, sem mudança visível)

Como o projeto desliga de propósito `noUnusedLocals`/`no-unused-vars` no eslint (achado real, não é falta de configuração — é decisão deliberada do time para não travar CI com o código gerado pelas ferramentas de IA), rodei `tsc` manualmente com essas flags só para investigação, sem tocar no `tsconfig.json`/`eslint.config.*`. Isso apontou 211 ocorrências em ~52 arquivos. Fui arquivo por arquivo, olhei o contexto de cada um antes de mexer (várias "sobras" eram na verdade indício de uma feature inteira desconectada, não simples import esquecido — ver seção 3), e só executei onde confirmei que era limpeza pura, sem efeito colateral:

### 2.1 `DashboardLayout.tsx` — bloco morto de onboarding de loja + duplicações (commit `5d12e796`)
O achado mais substancial desta seção: linhas ~494–740 continham um fluxo antigo e completo de "onboarding da primeira loja" — estado (`stores`, `storesHydrated`, `shouldAutoShowStoreOnboarding`), dois `useEffect`s que liam/gravavam a tabela `profiles` do Supabase e `localStorage` a cada carregamento do dashboard, e uma função `persistCompletedStore` que também gravava no Supabase. **Nenhum desses 4 identificadores tinha um único lugar de leitura no arquivo inteiro** (confirmado pelo `tsc --noUnusedLocals`, não só grep manual) — foi superado pelo fluxo novo de onboarding em modal que já existe logo acima (`showOnboarding`/`shouldShowOnboarding`), mas nunca foi removido. Na prática: toda vez que qualquer usuário abria o dashboard, o app fazia até 2 consultas extras a `profiles` e gravações em `localStorage`/Supabase **para um resultado que nada na tela usava**. Removi o bloco inteiro (efeitos + estado + função), uma declaração duplicada de `isModelsRoute` (a cópia usada está em outro componente do mesmo arquivo, `MobileDashboardChrome`; a de dentro de `DashboardLayoutInner` nunca era lida), dois flags hardcoded mortos (`isStartMode = false`/`hasActivePlan = true` dentro de `MobileDashboardChrome` — há outro `isStartMode` de verdade, computado, em `DashboardLayoutInner`, esse não mexi), um `canAccessCommissions` nunca lido, um subcomponente `MobileVeloMark` nunca renderizado, e os imports que ficaram órfãos.

Confirmei que os helpers importados de `FirstStoreOnboarding.tsx` (`readUserStores`, `saveUserStores`, `STORES_CHANGED_EVENT`, `hasCompletedStoreOnboarding`, `markStoreOnboardingCompleted`, tipo `VeloStore`) só eram usados dentro do bloco morto **neste arquivo** — não toquei em `FirstStoreOnboarding.tsx` em si, porque `getActiveStore()` (outro export do mesmo módulo) segue em uso ativo em `ImportProductModal.tsx`, `TrendingProductsPage.tsx` e `CatalogoProductDetailPage.tsx`.

**Prova:** `tsc --noEmit` limpo, `npm run build` limpo, `npx vitest run` → mesma baseline pré-existente (32 failed | 106 passed). Arquivo caiu de ~900 para ~720 linhas relevantes (181 linhas removidas no total).

### 2.2 `AICharacterCreator.tsx` — 20 imports de thumbnail nunca usados (commit `dd49603d`)
O arquivo importa `model297t..model304t`, `ugc307t..ugc311t`, `ugcBlondet`, `ugcBrunettet` (20 arquivos de imagem "-thumb", com comentário dizendo que seriam "usadas só na grade"), mas a grade real usa um segundo conjunto de thumbnails já conectado (`card_u1..card_um6`, confirmei `src={m.thumb}` na linha do componente). Os 20 imports "-thumb" nunca chegaram a ser ligados — puro import morto, sem efeito nenhum na tela.

### 2.3 `DashboardHomePage.tsx` — helpers de "ações de mensagem" órfãos + imports (commit `8f0e7b8f`)
`getMessageActions`, `formatMargin`, `formatPrice` e o tipo `AtlasFunctionResponse` não tinham nenhuma chamada no arquivo — sobra de uma versão anterior de renderização de ações em mensagens do chat. Removi só esses três (confirmados sem uso), sem mexer em `normalizeAtlasActions`/`isAtlasAction` (que tecnicamente ficam meio soltos depois disso, mas achei melhor não puxar mais esse fio numa passada só — fica registrado, ver seção 3 se quiser que eu complete a limpeza depois). Também removi imports não usados (`AtlasHistoryMenu`, `AtlasMessageText`, `atlasThreadsQueryKey`, ícones).

### 2.4 `ProdutosMLPage.tsx` — leitura morta de campos da CJ Dropshipping descontinuada (commit `ff812fef`)
A cada pedido do Mercado Livre importado, o código buscava `cj_variant_id`, `cj_product_id`, `cj_product_url` de `user_publications` — três campos vindos da integração CJ, que o próprio `CLAUDE.md` (seção 8) diz estar "descontinuada definitivamente". Confirmei que **nenhum dos três é lido depois de atribuído** (só `cost_price`, também buscado na mesma query, é realmente usado no cálculo de lucro). Removi as 3 variáveis e ajustei o `select()` para não buscar mais essas colunas. Também limpei imports não usados (`queryClient`, alguns ícones) — nessa limpeza cheguei a remover `ShoppingBag` por engano (não estava na lista de não-usados), o `tsc` acusou na hora (`Cannot find name 'ShoppingBag'`) e já reincluí antes de commitar; fica registrado como lembrete de conferir `tsc --noEmit` depois de cada edição, não só no final.

### 2.5 `AdminUserDetailModal.tsx` — imports não usados (commit `087bb692`)
Limpeza simples: `useMemo`, `useState`, `ArrowUpRight`, `ExternalLink`, `cn` nunca usados no arquivo. Confirmei que o componente é renderizado de verdade em `AdminUsersPage.tsx` antes de mexer.

**Validação de toda a seção 2, ao final:** `tsc --noEmit -p tsconfig.app.json` limpo, `npm run build` limpo (mesmos warnings pré-existentes de chunk grande), `npx vitest run` → `32 failed | 106 passed (138)`, idêntico à baseline pré-existente.

## 3. Propostas novas que precisam da sua aprovação (investigadas, NÃO executadas)

### 3.1 🔴 Achado de segurança: descrição de produto renderizada como HTML puro, sem sanitização, em 3 telas (2 delas públicas sem login)
`PublicProductPage.tsx:462`, `PublicProductPage2.tsx:221` (ambas públicas, `/loja/:slug/produto/:id`, sem autenticação) e `CatalogoProductDetailPage.tsx:768` (autenticada) fazem `dangerouslySetInnerHTML={{ __html: product.description }}` **sem nenhuma sanitização**. `product.description` vem direto da coluna `catalog_products.description`, que por sua vez é "gravada pelo scraper" (comentário em `src/lib/userProjects.ts:361`, função `fetchPublicStoreProducts`, que já observa que o RPC existe justamente porque visitante sem login também acessa esse dado). Não há `DOMPurify`/`sanitize-html` em nenhum lugar do projeto (`grep` não retornou nada) — inclusive há um comentário em `productTemplateShared.tsx:123` dizendo que outro trecho do código monta elementos "sem `dangerouslySetInnerHTML`" de propósito, o que sugere que o time já tem essa preocupação, só não caiu nesses 3 lugares.

**Por que é sério:** se qualquer descrição de produto capturada pelo scraper (de um fornecedor comprometido, ou uma página de fornecedor mal-intencionada) contiver `<script>` ou handlers inline, esse código roda no navegador de **qualquer visitante anônimo** que abrir a página pública de um produto em qualquer loja Velo publicada — clássico XSS armazenado. Não precisa de login nem de engenharia social; só precisa que o dado bruto do fornecedor chegue com HTML malicioso.

**Por que não corrigi direto:** é achado de segurança (mesma categoria do achado do Atlas do Banco) e precisaria de uma dependência nova (`DOMPurify` ou equivalente) no `package.json` — fora do escopo de execução autônoma combinado. Proposta pronta: sanitizar com uma allowlist básica (tags de formatação de texto: `p`, `br`, `strong`, `em`, `ul`/`li`, etc.) antes de passar para `dangerouslySetInnerHTML`, nos 3 lugares.

### 3.2 🟡 `CatalogoPage.tsx` (rota `/dashboard/catalogo`, página ativa e roteada): ~780 linhas de um dashboard de analytics inteiro, construído mas nunca renderizado
Entre a linha ~131 e a ~913 (de um arquivo de 1735 linhas — quase metade do arquivo), o código define uma série de subcomponentes completos e independentes: `KPICard`, `PerformanceGeneralCard`, `TrafficByChannelCard`, `ProductAnalysisChartCard`, `MLPublicationsDonutCard`, `SidebarRecentLogs`, `SidebarAtlasSuggestions`, `SidebarCustomers`, `SidebarDrawerFooter`, mais helpers (`getName`, `viewsChartData`). Nenhum deles aparece como tag JSX (`<KPICard`, `<PerformanceGeneralCard`, etc.) nem no `return` desses próprios componentes nem no `return` do componente principal `CatalogoPage` (que só começa na linha 914) — confirmado por grep de cada nome em todo o arquivo. `KPICard` inclusive tem uma prop `isMock` com badge "MOCK" visível — um sinal de que era protótipo/rascunho de uma tela de analytics (cards de KPI, gráfico de performance, tráfego por canal, funil de produtos, sidebar com logs recentes/sugestões do Atlas/clientes), nunca finalizada ou ligada à página real.

**Por que não mexi:** é um volume grande (quase metade de um arquivo de uma página ativa e usada de verdade todo dia), e — assim como a página de "redesign" do dashboard já na sua lista de aprovação — pode ser trabalho em andamento de uma reformulação futura dessa tela, não lixo esquecido. Prefiro que você confirme a intenção antes de eu apagar ~780 linhas: (a) se é experimento abandonado, removo com a mesma prova de "zero uso" que já apliquei nos itens da seção 2; (b) se é uma reformulação futura da página de catálogo em andamento, aviso e não toco.

### 3.3 🟡 `CheckoutPage.tsx`: variáveis de estado de UI computadas mas nunca exibidas (`promoCode`, `country`, `userEmail`, textos de período) — pode ser feature de cupom/país incompleta, não toquei
`tsc --noUnusedLocals` acusou `promoCode`/`setPromoCode`, `country`/`setCountry`, `userEmail`, e três textos calculados (`recurringPeriodLabel`, `checkoutPeriodLabel`, `checkoutDescription`) como nunca lidos. Diferente dos itens da seção 2, não investiguei a fundo nem mexi: `CheckoutPage.tsx` é a tela de pagamento (cliente final, cartão/assinatura), está na categoria mais sensível do portão de aprovação, e o padrão (estado de UI para campo de cupom/país que existe mas não aparece em lugar nenhum) cheira mais a **campo que devia estar na tela e não está** (ex.: usuário não consegue aplicar cupom de desconto porque o campo existe no código mas não é renderizado) do que a lixo simples — precisaria de mais investigação para saber se é bug real de UI faltando ou decisão consciente de remover esse recurso. Fica registrado para próxima rodada ou para sua decisão direta.

### 3.4 Observação, sem ação: outros arquivos grandes com imports/variáveis não usadas, ainda não investigados a fundo
`tsc --noUnusedLocals` também apontou `GeneratedStoreEditorPage.tsx` (24 ocorrências), `ProductDetailPage.tsx` (7) e outros arquivos menores. Não tive tempo nesta rodada de investigar cada um com o mesmo cuidado (alguns podem ser imports simples, outros podem esconder blocos mortos como o da seção 3.2) — fica como ponto de partida natural para a próxima rodada do Visual. **Não mexi** em `src/components/landing/*`, `src/components/dashboard/redesign/*` nem `DashboardTopbar.tsx` — todos já cobertos pela sua lista de aprovação/observação existente (trabalho de terceiro em andamento ou componente órfão já reportado).

## 4. Commits desta rodada

```
087bb692 chore: remove unused imports from AdminUserDetailModal
ff812fef chore: remove dead CJ-Dropshipping leftover fields and unused imports from ProdutosMLPage
8f0e7b8f chore: remove dead message-actions helpers and unused imports from DashboardHomePage
dd49603d chore: remove unused thumbnail asset imports from AICharacterCreator
5d12e796 chore: remove dead store-onboarding block and unused locals from DashboardLayout
```
Todos em cima de `5a672a68` (estado no início desta rodada).
