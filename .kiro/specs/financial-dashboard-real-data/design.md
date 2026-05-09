# Financial Dashboard Real Data — Bugfix Design

## Overview

O módulo financeiro do dashboard exibe valores estáticos/mockados em vez de calcular dinamicamente a partir da tabela `orders` do Supabase. O fix cria uma camada de lógica financeira pura (`/src/lib/financial.ts`) e um hook React Query (`useFinancialData`) que substitui todos os dados hardcoded nas três páginas afetadas: `SaldosPage`, `DashboardHomePage` e `ReportsPage`. O layout e os componentes visuais não são alterados.

## Glossary

- **Bug_Condition (C)**: A condição que dispara o bug — quando qualquer seção financeira exibe valores estáticos em vez de calcular a partir da tabela `orders`
- **Property (P)**: O comportamento correto — valores financeiros calculados dinamicamente a partir dos pedidos reais do usuário autenticado
- **Preservation**: Layout, design, componentes visuais, interações e os cards de Total de Produtos / Total de Pedidos que já buscam dados reais devem permanecer inalterados
- **`calculateOrderProfit`**: Função pura em `src/lib/financial.ts` que calcula o lucro de um único pedido: `total - cost - fees`
- **`getFinancialSummary`**: Função pura em `src/lib/financial.ts` que agrega um array de pedidos em `{ revenue, costs, fees, profit, margin }`
- **`getSalesAnalytics`**: Função pura (já especificada no spec `sales-analytics-chart`) que agrupa pedidos por período para o gráfico de vendas
- **`useFinancialData`**: Hook React Query em `src/hooks/useFinancialData.ts` que busca pedidos do Supabase e expõe os dados calculados
- **`ACTIVE_STATUSES`**: `['paid', 'approved', 'completed']` — statuses que contam como receita confirmada
- **`OrderRow`**: Tipo TypeScript representando uma linha da tabela `orders`: `{ id, total, cost, fees, status, created_at }`

## Bug Details

### Bug Condition

O bug se manifesta quando qualquer componente financeiro renderiza valores a partir de constantes hardcoded (`EARNING_DATA`, `CASHFLOW_DATA`, `SPENDING_BREAKDOWN`, `UPCOMING_BILLS`, `SALES_DAILY/WEEKLY/MONTHLY`, `mockData.ts`) em vez de consultar a tabela `orders` do Supabase. As funções de cálculo financeiro não existem — `src/lib/financial.ts` ainda não foi criado — e nenhum hook busca dados reais para essas seções.

**Formal Specification:**
```
FUNCTION isBugCondition(component)
  INPUT: component — qualquer componente/seção financeira do dashboard
  OUTPUT: boolean

  RETURN component.dataSource IN [
    EARNING_DATA,        // SaldosPage — Visão de Receita
    CASHFLOW_DATA,       // SaldosPage — Fluxo de Caixa
    SPENDING_BREAKDOWN,  // SaldosPage — Visão de Gastos
    UPCOMING_BILLS,      // SaldosPage — Próximos Pagamentos
    SALES_DAILY,         // DashboardHomePage — gráfico
    SALES_WEEKLY,        // DashboardHomePage — gráfico
    SALES_MONTHLY,       // DashboardHomePage — gráfico
    mockData.ts          // ReportsPage — todos os KPIs e gráficos
  ]
  AND NOT existsFile("src/lib/financial.ts")
  AND NOT existsHook("useFinancialData")
END FUNCTION
```

### Examples

- **Visão de Receita**: exibe `R$ 20.520,32` e `+1,5%` hardcoded — esperado: soma de `total` dos pedidos `paid/approved/completed` do mês atual vs anterior
- **Visão de Gastos**: exibe `R$ 8.800,00` (custo) e `R$ 1.300,00` (taxas) fixos — esperado: soma de `cost` e `fees` dos pedidos ativos
- **Fluxo de Caixa**: exibe `R$ 342.233,44` e percentuais fictícios — esperado: receita, custo e lucro reais agrupados por mês
- **Próximos Pagamentos**: lista `UPCOMING_BILLS` com datas fixas — esperado: pedidos com `status = 'pending'` e taxas acumuladas
- **Gráfico de Vendas**: usa `SALES_DAILY/WEEKLY/MONTHLY` mockados — esperado: `getSalesAnalytics(period, orders)` com dados reais
- **ReportsPage**: importa `mockData.ts` para KPIs e gráficos — esperado: `getFinancialSummary` e `getSalesAnalytics` com dados reais
- **Sem pedidos**: exibe valores positivos fictícios — esperado: todos os campos exibem zero sem erros

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Layout, design e componentes visuais de todas as páginas afetadas devem permanecer idênticos
- A troca de período (Diário/Semanal/Mensal) no gráfico deve continuar funcionando com a mesma interação e animação
- Os cards "Total de Produtos" e "Total de Pedidos" em `DashboardHomePage` já buscam dados reais — não devem ser alterados
- A seção "Transações Recentes" em `SaldosPage` deve manter o mesmo layout de tabela
- Os estados de loading (skeleton/spinner) existentes devem continuar sendo exibidos durante a busca
- Pedidos com `status IN ('paid', 'approved', 'completed')` devem continuar sendo incluídos nos cálculos como receita válida

**Scope:**
Todos os inputs que NÃO envolvem os dados financeiros calculados (navegação, autenticação, outras páginas do dashboard) devem ser completamente inalterados por este fix.

## Hypothesized Root Cause

1. **Ausência de `src/lib/financial.ts`**: As funções `calculateOrderProfit`, `getFinancialSummary` e `getSalesAnalytics` não existem. Sem essa camada de lógica pura, os componentes não têm como calcular valores a partir dos pedidos reais.

2. **Ausência de `useFinancialData`**: Nenhum hook busca os pedidos do Supabase para as seções financeiras. O hook `useDashboard.ts` existente retorna arrays vazios/mock e não consulta a tabela `orders` com os campos `total`, `cost`, `fees`.

3. **Constantes hardcoded nos componentes**: `SaldosPage` define `EARNING_DATA`, `CASHFLOW_DATA`, `SPENDING_BREAKDOWN` e `UPCOMING_BILLS` diretamente no arquivo. `DashboardHomePage` define `SALES_DAILY/WEEKLY/MONTHLY`. Esses arrays são usados diretamente nos gráficos sem nenhuma substituição dinâmica.

4. **`ReportsPage` importa `mockData.ts`**: A página de relatórios importa explicitamente `mockRevenueData`, `mockResumoLoja`, `mockOrders` e `mockStats` de `src/lib/mockData.ts`, sem nenhuma query ao Supabase.

5. **Tabela `orders` não está no schema de tipos**: O arquivo `src/integrations/supabase/types.ts` não contém a tabela `orders`, o que significa que as queries precisam usar `as any` (padrão já adotado em `DashboardHomePage` para outras queries).

## Correctness Properties

Property 1: Bug Condition — Dados Financeiros Calculados a Partir de Pedidos Reais

_For any_ componente financeiro onde a condição de bug se aplica (isBugCondition retorna true), o sistema corrigido SHALL calcular e exibir valores derivados exclusivamente da tabela `orders` do Supabase para o usuário autenticado, com fallback para zero quando não há pedidos, sem crashes ou erros.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation — Layout e Comportamentos Existentes Inalterados

_For any_ interação que NÃO envolva os dados financeiros calculados (navegação, troca de período, hover em gráficos, cards de Total de Produtos/Pedidos, Transações Recentes), o sistema corrigido SHALL produzir exatamente o mesmo comportamento visual e funcional que o sistema original, preservando layout, animações e estados de loading.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assumindo que a análise de causa raiz está correta:

**Arquivo novo**: `src/lib/financial.ts`

**Responsabilidades**:
1. **`calculateOrderProfit(order)`**: Função pura — `order.total - order.cost - order.fees` com fallback `?? 0` em cada campo
2. **`getFinancialSummary(orders)`**: Agrega pedidos em `{ revenue, costs, fees, profit, margin }`:
   - `revenue`: soma de `total` dos `ACTIVE_STATUSES` menos soma de `total` dos `refunded`
   - `costs`: soma de `cost` dos `ACTIVE_STATUSES`
   - `fees`: soma de `fees` dos `ACTIVE_STATUSES`
   - `profit`: `revenue - costs - fees`
   - `margin`: `revenue > 0 ? (profit / revenue) * 100 : 0`
3. **`getSalesAnalytics(period, orders)`**: Reutiliza o algoritmo já especificado no spec `sales-analytics-chart/design.md` — agrupa pedidos por período (daily/weekly/monthly), retorna `{ labels, current, previous }`
4. **`getCashflowData(orders)`**: Agrupa pedidos por mês retornando `{ m, income, expense, savings }[]` para o gráfico de Fluxo de Caixa — `income` = receita, `expense` = custo+fees, `savings` = lucro (valores absolutos em BRL, não percentuais)
5. **`getPendingOrders(orders)`**: Filtra pedidos com `status = 'pending'`, retorna array para "Próximos Pagamentos"

**Arquivo novo**: `src/hooks/useFinancialData.ts`

**Responsabilidades**:
- Query Supabase: `orders` com `SELECT id, total, cost, fees, status, created_at` filtrado por `user_id` e `status IN ('paid','approved','completed','refunded','pending')`
- Cache via `queryKey: ["financial-data", userId]`
- Expõe: `{ summary, cashflowData, pendingOrders, orders, isLoading, error }`
- `enabled: !!user` — desabilitado sem autenticação
- Fallback: retorna zeros/arrays vazios quando `orders = []`

**Arquivo modificado**: `src/pages/dashboard/SaldosPage.tsx`

**Mudanças específicas**:
1. Remover constantes `EARNING_DATA`, `CASHFLOW_DATA`, `SPENDING_BREAKDOWN`, `UPCOMING_BILLS`
2. Importar e chamar `useFinancialData()`
3. Substituir `R$ 20.520,32` → `fmt(summary.revenue)` e calcular variação percentual vs período anterior
4. Substituir `R$ 8.800,00` → `fmt(summary.costs)` e `R$ 1.300,00` → `fmt(summary.fees)`
5. Substituir `R$ 342.233,44` → `fmt(summary.profit)` e `CASHFLOW_DATA` → `cashflowData` do hook
6. Substituir `UPCOMING_BILLS` → `pendingOrders` do hook (manter estrutura visual)
7. Adicionar skeleton loading nos valores numéricos durante `isLoading`

**Arquivo modificado**: `src/pages/dashboard/DashboardHomePage.tsx`

**Mudanças específicas**:
1. Remover constantes `SALES_DAILY`, `SALES_WEEKLY`, `SALES_MONTHLY`
2. Importar `useSalesAnalytics` (do spec `sales-analytics-chart`) ou criar inline com `useFinancialData`
3. Substituir `chartData` (que hoje seleciona entre os arrays mockados) pelos dados do hook
4. Manter `REVENUE_MINI` como está — é apenas decorativo no card de Receita (ou substituir pelos últimos 5 meses reais como melhoria opcional)
5. Manter toda a lógica de `statsData` (Total de Pedidos, Total de Produtos, Receita) — já usa dados reais

**Arquivo modificado**: `src/pages/dashboard/ReportsPage.tsx`

**Mudanças específicas**:
1. Remover import de `mockData.ts`
2. Importar `useFinancialData` e `getSalesAnalytics`
3. Substituir `mockStats` → `summary` do hook para KPIs
4. Substituir `mockRevenueData` → dados mensais calculados via `getSalesAnalytics("monthly", orders)`
5. Substituir `mockResumoLoja` → dados agrupados por plataforma (campo `platform` da tabela `orders`, se disponível) ou fallback vazio
6. Substituir `mockOrders` → `orders` do hook para top produtos

## Testing Strategy

### Validation Approach

A estratégia segue duas fases: primeiro, confirmar o bug executando testes no código não corrigido para observar os valores mockados; depois, verificar que o fix calcula corretamente e não quebra comportamentos existentes.

### Exploratory Bug Condition Checking

**Goal**: Confirmar que os componentes exibem valores hardcoded antes do fix. Confirmar ou refutar a análise de causa raiz.

**Test Plan**: Escrever testes que renderizam os componentes com um Supabase mockado retornando pedidos reais e verificar que os valores exibidos NÃO correspondem aos pedidos mockados (ainda mostram os valores hardcoded). Executar no código não corrigido.

**Test Cases**:
1. **SaldosPage — Receita hardcoded**: Renderizar `SaldosPage` com Supabase mockado retornando 3 pedidos `paid` com `total = 100` cada → verificar que exibe `R$ 20.520,32` em vez de `R$ 300,00` (falha no código não corrigido)
2. **DashboardHomePage — Gráfico mockado**: Renderizar com pedidos reais → verificar que `chartData` ainda usa `SALES_WEEKLY` hardcoded (falha no código não corrigido)
3. **ReportsPage — KPIs mockados**: Renderizar → verificar que `mockStats.totalRevenue` é exibido em vez de soma real dos pedidos (falha no código não corrigido)
4. **Sem pedidos — valores não zerados**: Renderizar com Supabase retornando array vazio → verificar que ainda exibe `R$ 20.520,32` em vez de `R$ 0,00` (falha no código não corrigido)

**Expected Counterexamples**:
- Valores exibidos não correspondem aos pedidos injetados via mock
- Causa confirmada: constantes hardcoded nos componentes, ausência de `financial.ts` e `useFinancialData`

### Fix Checking

**Goal**: Verificar que para todos os inputs onde a condição de bug se aplica, o sistema corrigido produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL component WHERE isBugCondition(component) DO
  result := render_fixed(component, orders)
  ASSERT displayedValue(result) = calculateExpected(orders)
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos os inputs onde a condição de bug NÃO se aplica, o sistema corrigido produz o mesmo resultado que o original.

**Pseudocode:**
```
FOR ALL interaction WHERE NOT isBugCondition(interaction) DO
  ASSERT behavior_original(interaction) = behavior_fixed(interaction)
END FOR
```

**Testing Approach**: Testes de propriedade são recomendados para preservation checking porque:
- Geram muitos casos de teste automaticamente (arrays de pedidos com valores aleatórios)
- Capturam edge cases que testes unitários manuais podem perder
- Fornecem garantias fortes de que o comportamento é preservado para todos os inputs não-bugados

**Test Cases**:
1. **Preservation — Layout visual**: Verificar que o snapshot do componente não muda após o fix (exceto pelos valores numéricos)
2. **Preservation — Troca de período**: Verificar que clicar em Diário/Semanal/Mensal continua atualizando o gráfico
3. **Preservation — Cards de stats**: Verificar que Total de Produtos e Total de Pedidos continuam buscando dados reais sem alteração
4. **Preservation — Loading states**: Verificar que skeletons aparecem durante `isLoading = true`

### Unit Tests

- `calculateOrderProfit` com valores normais, zeros e campos ausentes (`undefined`)
- `getFinancialSummary` com array vazio, pedidos `paid`, `refunded` e `pending` misturados
- `getFinancialSummary` — verificar que `margin = 0` quando `revenue = 0` (sem divisão por zero)
- `getCashflowData` — verificar agrupamento correto por mês
- `getPendingOrders` — verificar filtro por `status = 'pending'`
- `getSalesAnalytics` — reutilizar testes do spec `sales-analytics-chart`

### Property-Based Tests

- Gerar arrays aleatórios de pedidos com `total ≥ 0`, `cost ≥ 0`, `fees ≥ 0` e verificar que `profit = revenue - costs - fees` sempre
- Verificar que `margin ∈ [−∞, 100]` nunca causa divisão por zero
- Verificar que `getFinancialSummary([]) = { revenue: 0, costs: 0, fees: 0, profit: 0, margin: 0 }`
- Verificar que pedidos `refunded` reduzem `revenue` mas não aumentam `costs`
- Verificar que pedidos `pending` aparecem em `getPendingOrders` mas não em `getFinancialSummary.revenue`

### Integration Tests

- `useFinancialData` com Supabase mockado retornando pedidos reais → verificar estrutura de retorno
- `SaldosPage` renderizada com hook mockado → verificar que valores exibidos correspondem ao `summary`
- `ReportsPage` renderizada com hook mockado → verificar que KPIs correspondem ao `summary`
- `DashboardHomePage` com `useSalesAnalytics` mockado → verificar que gráfico usa dados do hook
