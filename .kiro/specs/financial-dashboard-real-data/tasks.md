# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Dados Financeiros Hardcoded Ignoram Pedidos Reais
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — render `SaldosPage` with Supabase mocked returning 3 `paid` orders with `total = 100` each; assert displayed revenue equals `R$ 300,00` (not `R$ 20.520,32`)
  - Test cases to cover (from Bug Condition in design):
    - `SaldosPage` com 3 pedidos `paid` (total=100 cada) → exibe `R$ 20.520,32` em vez de `R$ 300,00`
    - `DashboardHomePage` com pedidos reais → `chartData` ainda usa `SALES_WEEKLY` hardcoded
    - `ReportsPage` → exibe `mockStats.totalRevenue` em vez da soma real dos pedidos
    - Supabase retornando array vazio → ainda exibe `R$ 20.520,32` em vez de `R$ 0,00`
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "SaldosPage exibe R$ 20.520,32 mesmo com pedidos totalizando R$ 300,00")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Layout, Interações e Cards Existentes Inalterados
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (navigation, period switching, stats cards)
  - Observe: clicar em Diário/Semanal/Mensal atualiza o gráfico corretamente no código atual
  - Observe: cards "Total de Produtos" e "Total de Pedidos" buscam dados reais sem alteração
  - Observe: skeletons aparecem durante `isLoading = true`
  - Observe: seção "Transações Recentes" mantém layout de tabela atual
  - Write property-based tests: for all arrays of orders with `total ≥ 0`, `cost ≥ 0`, `fees ≥ 0`, the layout snapshot of non-financial sections remains unchanged (from Preservation Requirements in design)
  - Additional property: for any period selection (daily/weekly/monthly), the chart interaction and animation behavior is preserved
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [-] 3. Fix — substituir dados hardcoded por cálculos dinâmicos a partir da tabela `orders`

  - [x] 3.1 Criar `src/lib/financial.ts` com funções puras de cálculo financeiro
    - Implementar `calculateOrderProfit(order)`: `(order.total ?? 0) - (order.cost ?? 0) - (order.fees ?? 0)`
    - Implementar `getFinancialSummary(orders)`: agrega em `{ revenue, costs, fees, profit, margin }` usando `ACTIVE_STATUSES = ['paid', 'approved', 'completed']`; `revenue` subtrai `total` dos pedidos `refunded`; `margin = revenue > 0 ? (profit / revenue) * 100 : 0`
    - Implementar `getCashflowData(orders)`: agrupa por mês retornando `{ m, income, expense, savings }[]` — `income` = receita, `expense` = custo+fees, `savings` = lucro
    - Implementar `getPendingOrders(orders)`: filtra `status = 'pending'`
    - Implementar `getSalesAnalytics(period, orders)`: agrupa por período (daily/weekly/monthly), retorna `{ labels, current, previous }` (reutilizar algoritmo do spec `sales-analytics-chart`)
    - Exportar tipo `OrderRow`: `{ id, total, cost, fees, status, created_at }`
    - _Bug_Condition: isBugCondition(component) — `src/lib/financial.ts` não existe_
    - _Expected_Behavior: getFinancialSummary(orders) retorna zeros para array vazio; margin nunca divide por zero_
    - _Preservation: funções puras sem side effects — não afetam nenhum componente existente_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.2 Criar `src/hooks/useFinancialData.ts` com React Query
    - Query Supabase: `SELECT id, total, cost, fees, status, created_at FROM orders WHERE user_id = userId AND status IN ('paid','approved','completed','refunded','pending')`
    - Usar `as any` para contornar ausência de `orders` no schema de tipos (padrão já adotado no projeto)
    - `queryKey: ["financial-data", userId]`
    - `enabled: !!user`
    - Expor `{ summary, cashflowData, pendingOrders, orders, isLoading, error }`
    - Fallback: retornar zeros/arrays vazios quando `orders = []` ou `isLoading = true`
    - _Bug_Condition: isBugCondition(component) — `useFinancialData` não existe_
    - _Expected_Behavior: hook retorna dados calculados via getFinancialSummary; fallback para zeros sem crashes_
    - _Preservation: hook novo, não altera nenhum hook existente (useDashboard, usePlan, etc.)_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 3.3 Atualizar `src/pages/dashboard/SaldosPage.tsx`
    - Remover constantes `EARNING_DATA`, `CASHFLOW_DATA`, `SPENDING_BREAKDOWN`, `UPCOMING_BILLS`
    - Importar e chamar `useFinancialData()`
    - Substituir `R$ 20.520,32` → `fmt(summary.revenue)` com variação percentual calculada vs período anterior
    - Substituir `R$ 8.800,00` → `fmt(summary.costs)` e `R$ 1.300,00` → `fmt(summary.fees)`
    - Substituir `R$ 342.233,44` → `fmt(summary.profit)` e `CASHFLOW_DATA` → `cashflowData` do hook
    - Substituir `UPCOMING_BILLS` → `pendingOrders` do hook (manter estrutura visual idêntica)
    - Adicionar skeleton loading nos valores numéricos durante `isLoading`
    - _Bug_Condition: EARNING_DATA, CASHFLOW_DATA, SPENDING_BREAKDOWN, UPCOMING_BILLS hardcoded_
    - _Expected_Behavior: valores calculados via getFinancialSummary e getCashflowData a partir de pedidos reais_
    - _Preservation: layout, design e componentes visuais inalterados; seção Transações Recentes inalterada_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.4, 3.6_

  - [ ] 3.4 Atualizar `src/pages/dashboard/DashboardHomePage.tsx`
    - Remover constantes `SALES_DAILY`, `SALES_WEEKLY`, `SALES_MONTHLY`
    - Importar `useFinancialData` e usar `getSalesAnalytics(period, orders)` para gerar `chartData`
    - Substituir seleção entre arrays mockados por dados calculados do hook
    - Manter toda a lógica de `statsData` (Total de Pedidos, Total de Produtos, Receita) — já usa dados reais
    - _Bug_Condition: SALES_DAILY, SALES_WEEKLY, SALES_MONTHLY hardcoded_
    - _Expected_Behavior: chartData calculado via getSalesAnalytics com pedidos reais por período_
    - _Preservation: cards Total de Produtos e Total de Pedidos inalterados; troca de período mantém interação e animação_
    - _Requirements: 2.5, 3.2, 3.3_

  - [ ] 3.5 Atualizar `src/pages/dashboard/ReportsPage.tsx`
    - Remover import de `mockData.ts`
    - Importar `useFinancialData` e `getSalesAnalytics`
    - Substituir `mockStats` → `summary` do hook para KPIs
    - Substituir `mockRevenueData` → dados mensais via `getSalesAnalytics("monthly", orders)`
    - Substituir `mockResumoLoja` → dados agrupados por plataforma (campo `platform` se disponível) ou fallback vazio
    - Substituir `mockOrders` → `orders` do hook para top produtos
    - _Bug_Condition: ReportsPage importa mockData.ts_
    - _Expected_Behavior: KPIs e gráficos calculados via getFinancialSummary e getSalesAnalytics_
    - _Preservation: layout da página de relatórios inalterado_
    - _Requirements: 2.6, 3.1_

  - [ ] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Dados Financeiros Calculados a Partir de Pedidos Reais
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [ ] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Layout e Comportamentos Existentes Inalterados
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [ ] 4. Checkpoint — Garantir que todos os testes passam
  - Rodar suite completa de testes (unit + property-based + integration)
  - Verificar que `calculateOrderProfit`, `getFinancialSummary`, `getCashflowData`, `getPendingOrders` e `getSalesAnalytics` passam nos testes unitários
  - Verificar que `useFinancialData` passa nos testes de integração com Supabase mockado
  - Verificar que `SaldosPage`, `DashboardHomePage` e `ReportsPage` exibem valores corretos com hook mockado
  - Verificar que nenhum teste de preservation quebrou
  - Perguntar ao usuário se surgirem dúvidas sobre comportamentos edge case
