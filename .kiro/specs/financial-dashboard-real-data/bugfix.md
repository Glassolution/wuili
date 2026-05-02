# Bugfix Requirements Document

## Introduction

O módulo financeiro do dashboard exibe valores estáticos/mockados em vez de calcular dinamicamente a partir da tabela `orders` do Supabase. Isso afeta cinco áreas: Visão de Receita, Visão de Gastos, Fluxo de Caixa, Próximos Pagamentos e os gráficos de vendas por período. O impacto é que os usuários tomam decisões com base em dados fictícios, sem nenhuma relação com seus pedidos reais.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o usuário acessa a Visão de Receita em `SaldosPage` THEN o sistema exibe o valor estático `R$ 20.520,32` e variação `+1,5%` hardcoded, sem consultar a tabela `orders`

1.2 WHEN o usuário acessa a Visão de Gastos em `SaldosPage` THEN o sistema exibe `R$ 8.800,00` de custo de produto e `R$ 1.300,00` de taxas como constantes hardcoded, sem somar `cost` e `fees` dos pedidos reais

1.3 WHEN o usuário acessa o Fluxo de Caixa em `SaldosPage` THEN o sistema exibe `R$ 342.233,44` e o gráfico usa `CASHFLOW_DATA` com percentuais fictícios, sem refletir receita, custo e lucro reais por período

1.4 WHEN o usuário acessa Próximos Pagamentos em `SaldosPage` THEN o sistema exibe itens estáticos (`UPCOMING_BILLS`) com datas fixas, sem considerar pedidos com status `pending` ou taxas acumuladas reais

1.5 WHEN o usuário acessa o gráfico "Vendas ao longo do tempo" em `DashboardHomePage` THEN o sistema renderiza `SALES_DAILY`, `SALES_WEEKLY` e `SALES_MONTHLY` com valores fictícios, sem agrupar pedidos reais por período

1.6 WHEN o usuário acessa a página de Relatórios (`ReportsPage`) THEN o sistema importa e exibe dados de `mockData.ts` (faturamento, lucro, pedidos por plataforma), sem consultar a tabela `orders`

1.7 WHEN não existem pedidos na tabela `orders` THEN o sistema ainda exibe valores positivos fictícios em vez de zero

### Expected Behavior (Correct)

2.1 WHEN o usuário acessa a Visão de Receita THEN o sistema SHALL calcular e exibir a soma de `total` dos pedidos com status `paid`, `approved` ou `completed`, subtraindo o `total` dos pedidos `refunded`, comparando com o período anterior para exibir a variação percentual real

2.2 WHEN o usuário acessa a Visão de Gastos THEN o sistema SHALL calcular e exibir a soma de `cost` (Custo de Produto) e a soma de `fees` (Taxas) separadamente, a partir dos pedidos com status `paid`, `approved` ou `completed`

2.3 WHEN o usuário acessa o Fluxo de Caixa THEN o sistema SHALL calcular e exibir receita (`total`), custo (`cost + fees`) e lucro (`total - cost - fees`) agrupados por período (diário/semanal/mensal) a partir dos pedidos reais

2.4 WHEN o usuário acessa Próximos Pagamentos THEN o sistema SHALL listar os pedidos com status `pending` e o total de taxas (`fees`) acumuladas dos pedidos do período atual

2.5 WHEN o usuário seleciona um período (Diário/Semanal/Mensal) no gráfico de vendas THEN o sistema SHALL agrupar os pedidos reais por `created_at` e exibir os valores de `total` para o período atual e o período anterior equivalente

2.6 WHEN o usuário acessa a página de Relatórios THEN o sistema SHALL buscar os dados financeiros da tabela `orders` via `getFinancialSummary` e `getSalesAnalytics` de `/lib/financial.ts`

2.7 WHEN não existem pedidos na tabela `orders` THEN o sistema SHALL exibir zero em todos os campos financeiros, sem erros ou crashes

### Unchanged Behavior (Regression Prevention)

3.1 WHEN o usuário visualiza qualquer seção financeira THEN o sistema SHALL CONTINUE TO manter o layout, design e componentes visuais existentes sem alterações

3.2 WHEN o usuário alterna entre os períodos Diário, Semanal e Mensal no gráfico THEN o sistema SHALL CONTINUE TO exibir a troca de visualização com a mesma interação e animação atual

3.3 WHEN o usuário acessa o card de Total de Produtos e Total de Pedidos em `DashboardHomePage` THEN o sistema SHALL CONTINUE TO buscar esses valores das tabelas `user_publications` e `orders` como já implementado

3.4 WHEN o usuário acessa a seção de Transações Recentes em `SaldosPage` THEN o sistema SHALL CONTINUE TO exibir a lista de transações com o mesmo layout de tabela atual

3.5 WHEN pedidos com status `paid`, `approved` ou `completed` existem THEN o sistema SHALL CONTINUE TO incluí-los nos cálculos financeiros como receita válida

3.6 WHEN a aplicação está carregando dados do Supabase THEN o sistema SHALL CONTINUE TO exibir os estados de loading (skeleton/spinner) existentes durante a busca
