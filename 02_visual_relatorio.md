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

---

# 4ª rodada — 2026-08-19

Escopo desta rodada, definido pelo Maestro: continuar imports/código morto não investigado, componentes grandes, duplicação de UI — E/OU investigar chamadas Supabase diretas em `components/`/`pages/` atrás do mesmo padrão de condição de corrida que o Banco achou 2x (salvar por cima de snapshot em memória) ou erro engolido sem aviso, já que o Banco terminou de cobrir toda a camada de apoio (hooks/lib/contexts). Prioridade do usuário: menos gambiarra, código organizado, pode refatorar com cuidado.

Estado inicial: `54be6bf6` (inclui o 2º fix de condição de corrida do Banco, em `publishProject`). `git log`/`git status` bateram com o esperado (repo limpo, só `.DS_Store` e `.md` de relatório não rastreados). Estado final: `e08aa37f`.

## 1. Investigação das duas frentes

### 1.1 Continuação do `tsc --noUnusedLocals` (arquivos ainda não revisados)
Fui arquivo por arquivo nos itens que ainda não tinham sido tocados. Pulei de propósito: `GeneratedStoreEditorPage.tsx`/`CatalogoPage.tsx`/`CheckoutPage.tsx`/`redesign/Sidebar.tsx`/`DashboardTopbar.tsx`/`landing/*` (já na sua lista de aprovação ou em disputa com trabalho de terceiro) e `financial.preservation.test.ts` (um dos 2 testes obsoletos já aguardando sua confirmação pra apagar).

### 1.2 Chamadas Supabase diretas em `components/`/`pages/`
Levantei os 18 arquivos fora de `hooks/lib/contexts` que chamam `.update(` no Supabase e conferi cada um: a grande maioria já usa patches parciais de campo único (`{ read: true }`, `{ status: "closed" }` etc.) — padrão seguro, não vulnerável ao bug do Banco. Os dois candidatos que pareciam gravar um objeto inteiro (`OwnProductFormModal.tsx`, `SettingsPage.tsx`) são formulários de vida curta (abre → edita → salva, sem sessão longa concorrente) e só incluem os próprios campos editáveis — não é o mesmo padrão do bug do Banco (que envolvia edição de longa duração com escritor concorrente em segundo plano). Já `StoreAdminModal.tsx` delega pra `updateProjectMetadata`, a função que o Banco já corrigiu — segura por herança.

Também varri por `catch` vazio/silencioso em todo `components/`/`pages/` — a maioria é de componentes já órfãos/desconectados (fora de alcance do usuário real, não priorizei investigar a fundo), e nos templates de produto ativos (`ProductTemplateBlack/Blue.tsx`) o erro já é mostrado pro usuário via `reviewNotice`, só falta log — não mexi por ser cosmético demais pra valer commit sozinho.

---

## 2. Executado e commitado

### 2.1 Dois erros silenciosos em telas ativas — agora logados (sem UI nova)
Mesmo padrão que o Banco já usou em `usePlanLimits.ts`/`usePlan.ts` (2ª rodada): onde um `catch` engolia o erro por completo, sem nenhum rastro, adicionei só `console.error` — sem toast, sem mudar nada visível.

- **`GeneratedStoreEditorPage.tsx` (commit `e08aa37f`)**: o autosave do editor de loja (dispara ~900ms depois de qualquer edição) tinha `catch(() => { /* autosave silencioso */ })` — vazio de verdade, nem log. Comparando com `handleManualSave` (o botão "Salvar" manual, poucas linhas acima), que já loga E mostra um indicador "Erro" na tela: se o autosave começasse a falhar (rede instável, RLS, etc.) durante uma sessão longa de edição, o usuário não teria absolutamente nenhum sinal — só descobriria se clicasse "Salvar" manualmente ou perdesse o trabalho ao recarregar. Corrigido só o log; a parte de UI (mostrar "Erro" também no autosave, reaproveitando o mesmo indicador que o save manual já usa) fica como proposta na seção 3, porque isso sim muda o que aparece na tela.
- **`StoreProjectsPage.tsx` (commit `f7733a03`)**: o refetch de projetos disparado por evento realtime (INSERT/DELETE de `user_projects`, ex.: colaborador cria/apaga um projeto) tinha `.catch(() => {})` vazio — se falhasse, a lista ficava desatualizada sem nenhum rastro. Mesmo tratamento: só log.

### 2.2 Query de contagem descartada em `useSupplierChat.ts` (commit `f1818e5b`)
Achado no meio da varredura de chamadas Supabase diretas (este arquivo é hook, mas a query específica ligava direto ao componente de lista de conversas com fornecedor). Pra cada fornecedor listado, o código fazia uma query extra de `count: "exact"` em `chat_messages` — e o resultado (`count`) nunca era lido; `unread` já vem hardcoded como `0` duas linhas abaixo, com o comentário `// simplified — no read tracking yet`. Ou seja, uma consulta inteira ao banco, por fornecedor, sempre descartada. Removida — reduz o N+1 já registrado no seu item #12 de aprovação (não fecha o item todo, só corta uma query supérflua dentro dele). Também limpei `useState`/`useCallback` importados e nunca usados no mesmo arquivo.

### 2.3 Limpeza de imports/locais mortos confirmados (commits `636fc153`, `96997666`, `a3f551e4`, `237987af`, `45b6e165`)
- `StoreProjectsPage.tsx`: `toast` (import nunca usado) e `isFreePlan` (calculado, nunca lido — confirmei que o paywall real usa `canCreateStorePlan`/`canCreateSalesPagePlan`, que checam `currentPlan` direto, então não é bug de gating, só sobra).
- `CatalogPage.tsx` (rota `/dashboard/produtos`, página ativa — diferente de `CatalogoPage.tsx`): import `supabase` nunca usado, ícones `Plug`/`SlidersHorizontal`, e `useQueryClient`/`queryClient` (a única mutation do arquivo é a de sincronização manual, que está desativada de propósito — ver achado 3.3 abaixo — então nunca havia nada pra invalidar).
- `ProductImagesDownload.tsx`: componente `SkeletonCard` inteiro e a variável `allLoaded`, nenhum dos dois referenciado em lugar nenhum — sobra de uma UI de loading que nunca foi ligada.
- `SupplierCompareModal.tsx`: tipo `SupplierProduct` importado sem uso, índice `i` de loop sem uso (já tinha `key={sp.id}`).
- `help/guides.ts`: 5 ícones Lucide importados e nunca usados.

**Validação de toda a seção 2:** `npx tsc --noEmit -p tsconfig.app.json` limpo, `npm run build` limpo (mesmos warnings pré-existentes de chunk grande), `npx vitest run` → `32 failed | 106 passed (138)`, idêntico à baseline de todas as rodadas anteriores.

---

## 3. Achados novos que precisam da sua decisão (investigados, NÃO executados)

### 3.1 🟠 `useStartMode.ts`: o hook inteiro foi esvaziado — sempre retorna "usuário tem plano pago", ignorando o plano real
O comentário no topo do arquivo descreve a regra de negócio: usuário grátis → Start Mode ativo automaticamente (algum tipo de modo restrito); usuário pago → Start Mode desativado. Mas o corpo da função hoje é só:
```ts
export const useStartMode = (): UseStartModeResult => {
  return { isStartMode: false, hasActivePlan: true, loading: false };
};
```
`git log -p` mostra que isso foi um corte deliberado: uma versão anterior (commit `efea8cbd`) calculava tudo de verdade a partir de `usePlan()` (checava `status === "active" && PAID_PLANS.has(plan)`, sincronizava com `localStorage`, disparava evento pro `DashboardLayout` reagir). No commit seguinte (`05ed70604`, cujo título fala de "sincronização de pedidos do ML e dashboard premium" — nada a ver com Start Mode), essa lógica inteira foi apagada e substituída pelos valores fixos, sem nenhuma explicação relacionada ao commit.

**Alcance real, hoje:** busquei todo `src/` — só um arquivo importa esse hook (`ImportProductModal.tsx`), e nem lá ele chega a ser chamado (`useStartMode(` não aparece — só o `import`, morto). Esse mesmo arquivo já tem seu próprio `const isStartMode = false;` hardcoded na linha 246, independente do hook. Ou seja: **o Start Mode como recurso não está restringindo ninguém hoje**, em lugar nenhum do app — nem por causa desse hook (que ninguém chama de verdade), nem apesar dele.

**Por que não mexi:** isso é decisão de produto, não bug técnico simples — não sei se "Start Mode restringir usuário grátis" ainda é uma regra que vocês querem ativa ou se foi desligada de propósito (talvez temporariamente, pra destravar testes, e esquecida). Removi só o import morto não — decidi nem isso, porque cortar o import sem entender a intenção pode dificultar achar esse fio depois. Fica registrado pra você decidir: (a) reativar a lógica real (reverter pro padrão do commit `efea8cbd`), (b) remover o hook e o import morto de vez, assumindo que Start Mode foi descontinuado, ou (c) me dizer que já sabia disso e não é prioridade.

### 3.2 🟠 `ProductDetailPage.tsx` (rota ativa `/dashboard/publicacoes/:id`): mostra "Fikri Store" fixo no lugar do canal de venda real
Na seção "Canal" da tela de detalhe de uma publicação (produto já publicado no Mercado Livre), o código é:
```tsx
const [channel, setChannel] = useState("Fikri Store");
...
<button ...><Store size={14} /><span>{channel}</span></button>
<button ...>+</button>
```
`channel` nunca muda (`setChannel` não é chamado em lugar nenhum do arquivo — foi isso que apareceu no `tsc --noUnusedLocals`) e o botão "+" ao lado não faz nada. "Fikri Store" é claramente um nome de placeholder de template de dashboard (não é nome de nenhuma loja Velo) — sobrou de um kit de UI usado como base visual. Como essa é literalmente a página de detalhe de uma publicação no Mercado Livre (o arquivo importa `ml_item_id`, `STATUS_META` com os status do ML etc.), o valor real ali quase certamente deveria ser algo como "Mercado Livre", não um nome de loja fictício.

**Por que não corrigi:** viola a regra do `CLAUDE.md` de não mostrar dado inventado na tela, mas mudar o texto exibido é mudança visível — precisa da sua aprovação. Não sei também se o botão "+" deveria abrir algo (conectar outro canal?) ou se é decoração morta — precisaria de mais contexto de produto antes de decidir o que colocar ali.

### 3.3 🟡 Reforço/confirmação de um achado já na sua lista (item #4): o próprio front-end assume que existe um cron que o Banco não achou
Em `CatalogPage.tsx` (página ativa `/dashboard/produtos`), o botão de "sincronizar catálogo" está desativado de propósito:
```ts
// Sincronização manual desativada — catálogo agora vem do cron C7Drop.
const syncMutation = useMutation({
  mutationFn: async () => {
    throw new Error("Sincronização manual desativada. O catálogo agora é alimentado pelo cron C7Drop.");
  },
  ...
});
```
Os dois botões que chamam esse `syncMutation` continuam visíveis e clicáveis na tela — qualquer usuário que clique recebe esse erro. Isso é evidência direta, do lado do front-end, do achado #4 do Banco (não existe nenhum agendamento automático do C7Drop configurado): o código aqui foi escrito assumindo que o cron existe e funciona, e por isso desligou deliberadamente o botão manual — só que, pelo que o Banco encontrou, esse cron nunca existiu de verdade. Não mexi (é o mesmo item #4 já pendente, só reforça a urgência).

### 3.4 Duas páginas órfãs novas encontradas (mesma categoria do item #7 já aprovado — não removi)
`tsc --noUnusedLocals` também apontou em `App.tsx` que `PreviewPage` e `ReportsPage` (além do já conhecido `ProductsPage`, item #7) são importadas com `lazy()` mas **não aparecem em nenhuma `<Route>`**. Diferente do `ProductsPage` (que era claramente descartável — só vazava debug), essas duas parecem features reais e completas, não protótipos:
- `src/pages/PreviewPage.tsx` (260 linhas): prévia pública de uma "página de vendas gerada", com paywall (`showPaywall`), fluxo de compra e leitura direta de `generated_sales_pages` no Supabase.
- `src/pages/dashboard/ReportsPage.tsx` (387 linhas): um sistema de "relatório de vendas com IA" completo (score geral, métricas de receita/lucro/ticket médio, seções de texto), lendo de uma tabela própria de relatórios.

**Por que não mexi:** ambas parecem trabalho real e substancial que nunca foi ligado ao roteamento — mesma categoria de "pode ser feature esquecida de ligar (bug) ou trabalho futuro em andamento" dos outros itens órfãos já na sua lista. Não removi nem os imports mortos em `App.tsx`. Fica como possível item novo pra lista de aprovação, ou você pode simplesmente confirmar se são recursos abandonados/futuros.

---

## 4. Commits desta rodada

```
636fc153 chore: remove unused toast import and isFreePlan local from StoreProjectsPage
f7733a03 fix: log realtime refetch failures in StoreProjectsPage instead of swallowing them
f1818e5b perf: remove unused per-supplier message count query in useSupplierChat
96997666 chore: remove unused imports and queryClient from CatalogPage
a3f551e4 chore: remove dead SkeletonCard component and allLoaded local from ProductImagesDownload
237987af chore: remove unused SupplierProduct type import and loop index in SupplierCompareModal
45b6e165 chore: remove unused Lucide icon imports from help/guides
e08aa37f fix: log autosave failures in GeneratedStoreEditorPage instead of swallowing them
```
Todos em cima de `54be6bf6` (estado no início desta rodada).

---

# 5ª rodada — 2026-08-19

Escopo desta rodada, definido pelo Maestro: componentes de UI compartilhados em `src/components/ui/` (kit shadcn) — customização que quebra outros lugares, ou duplicação entre eles e componentes "reinventados"; OU duplicação de lógica de formulário/validação entre modais parecidos (`ImportProductModal`, `OwnProductFormModal` etc.); OU julgamento próprio. Prioridade: menos gambiarra.

Estado inicial: `dd4a7d15`. `git log`/`git status` bateram com o esperado (repo limpo, só `.DS_Store` e `.md` de relatório não rastreados).

**Nota importante sobre esta rodada:** encontrei um achado grande e bem verificado (seção 1), mas o comando de remoção de arquivo (`rm`/`git rm`) foi bloqueado pelo classificador de modo automático desta sessão — tanto em lote (37 arquivos de uma vez) quanto testado depois em um único arquivo isolado, o bloqueio se manteve. Não insisti nem tentei contornar (instrução explícita da ferramenta é não tentar burlar). Resultado: **nenhum commit de execução nesta rodada** — só investigação e propostas, diferente das rodadas 1–4. O achado da seção 1 está com prova completa e pronto para execução assim que alguém com permissão de exclusão de arquivo rodar (ou eu, numa sessão sem esse bloqueio específico).

## 1. Achado principal: ~37 arquivos do kit shadcn em `src/components/ui/` são código morto puro (zero import em todo o `src/`) — pronto pra remover, mas bloqueado nesta sessão

Investigação: para cada um dos ~50 arquivos de `src/components/ui/`, rodei um grep programático (`grep -rl "ui/<nome>\"" src`, excluindo o próprio arquivo) contra todo `src/` (não só `import`, qualquer referência ao caminho `ui/<nome>"`), e cruzei com uma varredura separada no repo inteiro fora de `src/` (scripts, testes, config) pra garantir que não é referenciado em nenhum outro lugar (só achei um falso positivo, `ui/alert-dialog` batendo com o regex de `alert`, que não faz parte da lista — `alert-dialog.tsx` é usado de verdade e não foi tocado). Também confirmei que não há import relativo (`./`) entre os próprios arquivos de `ui/` uns aos outros — cada candidato é uma ilha isolada, sem risco de remover algo que outro arquivo do kit ainda usa internamente.

**Lista completa (37 arquivos, 3224 linhas no total, confirmado por `wc -l`):**
```
accordion.tsx, alert.tsx, aspect-ratio.tsx, avatar.tsx, badge.tsx, breadcrumb.tsx,
calendar.tsx, card.tsx, carousel.tsx, chart.tsx, checkbox.tsx, collapsible.tsx,
command.tsx, context-menu.tsx, drawer.tsx, dropdown-menu.tsx, form.tsx, hover-card.tsx,
input-otp.tsx, menubar.tsx, navigation-menu.tsx, pagination.tsx, popover.tsx,
progress.tsx, radio-group.tsx, resizable.tsx, scroll-area.tsx, sidebar.tsx (637
linhas — o maior de todos), slider.tsx, sonner.tsx, switch.tsx, table.tsx, tabs.tsx,
textarea.tsx, toaster.tsx, toggle-group.tsx, use-toast.ts
```

**Por que isso é surpreendente e vale registrar:** não é só "sobrou uns componentes do template". O projeto **abandonou o kit shadcn quase inteiro** e reinventou sua própria UI na marra — confirmei contando toda ocorrência de `from "@/components/ui/<nome>"` em `src/`: de ~50 primitivos instalados, só **14 são realmente usados** (`velo-toast` 59×, `button` 15×, `skeleton` 11×, `velo-loading-screen` 8×, `dialog` 4×, `tooltip` 3×, `toast` 2× — só o tipo, via `hooks/use-toast.ts` — `sheet` 2×, `label` 2×, `input` 2×, `toggle` 1×, `separator` 1×, `select` 1×, `alert-dialog` 1×). Isso bate com o padrão que já vinha aparecendo nas rodadas anteriores (`OwnProductFormModal.tsx`, por exemplo, é 100% `<div>`/Tailwind cru, nem um import de `ui/` — ver seção 2 abaixo) e explica por que `card.tsx`, `badge.tsx`, `table.tsx`, `dropdown-menu.tsx` (componentes que normalmente seriam onipresentes num dashboard) têm **zero uso** — o dashboard inteiro foi construído com markup próprio em vez do kit.

**Achado colateral confirmado nessa varredura (não é o mesmo item do #3.5 da rodada 1):** o item 3.5 da 1ª rodada falava de **dependências npm** sem import (`package.json`, fora de escopo por afetar build). Este achado aqui é diferente e está dentro do meu escopo: são os **arquivos-fonte `.tsx`/`.ts` do próprio projeto** em `src/components/ui/`, que o Vite já exclui do bundle final por tree-shaking (então não há ganho de performance), mas que continuam poluindo o repo, o autocomplete do editor e a superfície que um humano (ou eu, numa rodada futura) precisa escanear pra saber "isso é usado ou não" — exatamente a categoria "menos gambiarra" que você pediu.

**Validação que já fiz, pronta pra quando puder remover:** os 37 arquivos não aparecem em nenhum `import`, não são `lazy()`, não têm import relativo entre si, não aparecem em nenhum teste (`grep` em `*.test.*` vazio). Remover é operação de zero risco de comportamento — só falta o comando de exclusão em si, bloqueado nesta sessão.

**Proposta:** na próxima rodada (ou nesta mesma sessão se o bloqueio for específico de contexto), rodar `git rm` nos 37 arquivos listados acima, seguido de `npx tsc --noEmit`, `npm run build` e `npx vitest run` pra confirmar que nada quebrou (esperado: zero diferença, já que nada os importa).

## 2. Modais: shell duplicado ~19× em vez do `Dialog` do shadcn — investigado, não executado (blast radius grande demais pra rodada de refatoração pura)

Como pedido, comparei a lógica de formulário/validação entre os modais de produto (`ImportProductModal.tsx`, 1389 linhas, e `OwnProductFormModal.tsx`, 314 linhas). Não achei duplicação de lógica de validação real entre os dois — são fluxos genuinamente diferentes (`ImportProductModal` importa produto já pronto do catálogo de fornecedor; `OwnProductFormModal` é cadastro manual do zero, com upload de imagem própria pro Storage, o único lugar do projeto que faz esse upload — não há outro modal fazendo a mesma coisa pra consolidar). O helper de parse numérico local do `OwnProductFormModal` (`num()`, linha 94) também não tem gêmeo exato em outro modal — os parses parecidos em `CheckoutPage.tsx`/`CatalogPage.tsx`/`StoreCatalogPage.tsx` têm regras de borda sutilmente diferentes (`>= 0` vs `> 0`, regex de limpeza de moeda diferente), o mesmo tipo de risco que a rodada 2 já identificou pro `formatBRL` e decidiu não consolidar às cegas — não mexi pelo mesmo motivo.

O que achei em vez disso, olhando o "shell" (moldura) dos modais em vez da lógica interna: **o kit shadcn tem um `Dialog` pronto e não-customizado em `src/components/ui/dialog.tsx`** (confirmei lendo o arquivo — é o padrão de fábrica do shadcn/Radix, sem nenhuma alteração), mas ele só é usado em 2 componentes ativos (`ManualCategoryDialog.tsx`, `SupplierCompareModal.tsx` — já coberto em rodadas anteriores) mais `TutorialModal.tsx` (órfão, já na sua lista). **Todos os outros ~19 modais do dashboard reescrevem a mesma moldura na mão**, `<div className="fixed inset-0 z-[N] flex items-center justify-center bg-black/NN ...">`, cada um com seu próprio valor de overlay/blur/animação, em vez de usar o primitivo já instalado. Levantei os valores de `z-index` usados em todo `fixed inset-0` do projeto (não só modais — inclui painéis/drawers): **encontrei pelo menos 15 valores distintos em uso** (`z-40`, `z-50`, `z-[55]`, `z-[60]`, `z-[70]`, `z-[80]`, `z-[90]`, `z-[95]`, `z-[100]`, `z-[110]`, `z-[120]`, `z-[125]`, `z-[140]`, `z-[999]`, `z-[9999]`), escolhidos arquivo por arquivo, sem nenhuma constante/token central (mesmo padrão do achado já registrado na rodada 2 sobre `strokeWidth` de ícones — decisão ad-hoc por arquivo, sem padronização). Não confirmei nenhum caso concreto de dois desses overlays abertos ao mesmo tempo colidindo na tela (não tive tempo de rastrear a árvore de renderização de cada combinação possível), então não estou afirmando um bug ativo — é um risco estrutural, não um bug comprovado.

**Por que não executei nada aqui:** consolidar os 19 modais pro `Dialog` do shadcn mudaria comportamento visível de verdade (foco automático/focus trap, fechar com ESC, fechar clicando fora, animação de entrada/saída — o `Dialog` do shadcn tem tudo isso via Radix; os modais na mão têm um comportamento diferente em cada um, alguns nem fecham com ESC) — é uma mudança de UX em ~19 telas, muito além do que cabe numa rodada sem aprovação. Normalizar só o `z-index` também mexe em ordem de empilhamento visual, mesmo risco. Fica registrado como proposta de fundo pra você decidir se vale abrir como iniciativa própria (não cabe no "achado pontual" de uma rodada).

## 3. Achado novo, ativo: toast de sucesso/erro que nunca aparece em `/admin/comissoes` (aprovar/rejeitar afiliado)

Ao rastrear o kit `ui/toast.tsx` (que sobrevive porque `src/hooks/use-toast.ts`, fora de `components/ui/`, importa um tipo dele) descobri uma cadeia de arquivos mortos: `src/components/ui/toaster.tsx` (o componente `<Toaster />` que precisaria estar montado no `App.tsx` pra qualquer toast desse sistema aparecer na tela) **nunca é importado em lugar nenhum** — confirmei em `src/App.tsx` que só `VeloToaster` (o sistema de toast próprio, `velo-toast.tsx`) está montado, não o `<Toaster />` do shadcn.

Isso importa porque `src/components/admin/AdminAffiliateApplicationsPanel.tsx` (renderizado dentro de `AdminCommissionsPage`, rota ativa `/admin/comissoes` — confirmei em `App.tsx`) usa exatamente esse sistema morto: `toast({...})` nas linhas 165 (sucesso ao aprovar/rejeitar solicitação de afiliado) e 182 (erro, incluindo mensagens específicas por código de erro do RPC). **Como o `<Toaster />` nunca é montado, nenhum desses dois toasts jamais aparece na tela** — a ação em si funciona (o RPC `rpc_admin_accept_affiliate_application`/`rpc_admin_reject_affiliate_application` roda normalmente e a lista é invalidada/atualizada no sucesso), mas o admin não recebe nenhuma confirmação visual de que funcionou, e em caso de erro específico (ex.: RPC rejeitado por alguma regra de negócio) não recebe explicação nenhuma — só percebe algo errado se ficar de olho se a linha da tabela mudou ou não.

**Por que não corrigi direto:** é uma mudança de comportamento visível (um toast passaria a aparecer onde hoje não aparece nenhum) — mesma categoria de restrição das outras correções de UI. Duas formas óbvias de corrigir, ambas simples (um componente ou uma troca de import): (a) trocar o `toast` importado de `@/hooks/use-toast` por `veloToast` de `@/components/ui/velo-toast` nesse arquivo, seguindo o padrão que os outros 59 call-sites do projeto já usam; ou (b) montar `<Toaster />` no `App.tsx`. A opção (a) é mais consistente com o resto do projeto. Fica pra sua aprovação.

## 4. Validação

Como não houve execução nesta rodada (bloqueio de exclusão de arquivo), não há diff de código pra validar com `tsc`/`build`/`vitest`. Reconferi `git status --short` ao final: só `public/.DS_Store` (não meu) e os `.md` de relatório.

## 5. Resumo

Nenhum commit de código nesta rodada — só a atualização deste relatório. Achado principal (seção 1, remoção de 37 arquivos mortos do kit shadcn, ~3224 linhas) está com prova completa e pronto pra execução, mas o comando de exclusão de arquivo foi bloqueado pelo classificador desta sessão (testado em lote e isolado). Duas propostas novas registradas pra sua decisão: consolidação/normalização do shell de modais + z-index (seção 2, fundo grande, não cabe numa rodada) e o bug ativo de toast silencioso em `/admin/comissoes` (seção 3, correção pequena, só precisa de aprovação por mudar o que aparece na tela).
