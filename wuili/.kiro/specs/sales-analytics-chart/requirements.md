# Requirements: Sales Analytics Chart

## Introduction

Esta feature transforma o gráfico "Vendas ao longo do tempo" do dashboard de dados mockados para dados reais, consumindo a tabela `orders` do Supabase. O objetivo é exibir o faturamento do período atual (linha azul) versus o período anterior (linha laranja), com suporte a agrupamento diário, semanal e mensal.

---

## Requirements

### Requirement 1: Função de agregação de vendas

**User Story**: Como sistema, preciso de uma função pura que receba pedidos brutos e retorne dados formatados para o gráfico, para que o componente possa renderizar os dados sem lógica de negócio embutida.

#### Acceptance Criteria

1.1 - GIVEN um array de pedidos com `total` e `created_at`, WHEN `getSalesAnalytics("daily", orders)` é chamada, THEN retorna um objeto com `labels` de 7 dias da semana, `current` e `previous` com os totais agrupados por dia.

1.2 - GIVEN um array de pedidos, WHEN `getSalesAnalytics("weekly", orders)` é chamada, THEN retorna `labels: ["S1", "S2", "S3", "S4"]` com totais agrupados por semana do mês atual vs mês anterior.

1.3 - GIVEN um array de pedidos, WHEN `getSalesAnalytics("monthly", orders)` é chamada, THEN retorna `labels` com os 12 meses do ano com totais agrupados por mês do ano atual vs ano anterior.

1.4 - GIVEN um array vazio de pedidos, WHEN `getSalesAnalytics` é chamada com qualquer período, THEN retorna arrays `current` e `previous` preenchidos com zeros (sem `undefined` ou `NaN`).

1.5 - GIVEN qualquer entrada válida, WHEN `getSalesAnalytics` retorna, THEN `labels.length === current.length === previous.length` sempre.

1.6 - GIVEN pedidos com `total` válido, WHEN agregados, THEN todos os valores em `current` e `previous` são `>= 0`.

---

### Requirement 2: Hook de dados com cache

**User Story**: Como componente React, preciso de um hook que busque os pedidos do Supabase e aplique a agregação, para que eu possa consumir dados reais sem gerenciar estado manualmente.

#### Acceptance Criteria

2.1 - GIVEN um usuário autenticado, WHEN `useSalesAnalytics(period)` é chamado, THEN faz query na tabela `orders` filtrando `status IN ('paid', 'approved', 'completed')` e `user_id` do usuário autenticado.

2.2 - GIVEN a query ao Supabase, WHEN os dados chegam, THEN `getSalesAnalytics` é aplicada e o resultado é retornado como `data`.

2.3 - GIVEN o hook já foi chamado com o mesmo `period` e `userId`, WHEN chamado novamente, THEN retorna dados do cache React Query sem nova requisição ao Supabase.

2.4 - GIVEN o período muda (ex: "daily" → "weekly"), WHEN o hook re-executa, THEN uma nova query é disparada com o novo período no `queryKey`.

2.5 - GIVEN nenhum usuário autenticado, WHEN o hook é chamado, THEN a query fica desabilitada (`enabled: false`) e não faz requisição.

2.6 - GIVEN a query ao Supabase falha, WHEN o hook retorna, THEN `isLoading = false`, `error` está preenchido e `data = undefined`.

---

### Requirement 3: Componente do gráfico com dados reais

**User Story**: Como usuário do dashboard, quero ver o gráfico "Vendas ao longo do tempo" com dados reais dos meus pedidos, para que eu possa acompanhar meu faturamento de forma precisa.

#### Acceptance Criteria

3.1 - GIVEN o componente é montado, WHEN os dados estão carregando, THEN exibe um skeleton/loading state no lugar do gráfico.

3.2 - GIVEN os dados foram carregados, WHEN o gráfico renderiza, THEN exibe a linha azul (indigo) para o período atual e a linha laranja (amber) para o período anterior.

3.3 - GIVEN o usuário clica em "Diário", "Semanal" ou "Mensal", WHEN o período muda, THEN o gráfico atualiza dinamicamente com os dados do novo período.

3.4 - GIVEN o usuário passa o mouse sobre o gráfico, WHEN o tooltip aparece, THEN os valores são formatados em BRL usando `Intl.NumberFormat` (ex: "R$ 1.500,00").

3.5 - GIVEN o usuário não tem pedidos, WHEN o gráfico renderiza, THEN exibe as linhas zeradas sem erros ou crashes.

3.6 - GIVEN os dados reais estão disponíveis, WHEN o componente renderiza, THEN NÃO usa nenhum dado mockado (arrays `SALES_DAILY`, `SALES_WEEKLY`, `SALES_MONTHLY` são removidos).

---

### Requirement 4: Filtro de status de pedidos

**User Story**: Como sistema, preciso filtrar apenas pedidos com status válido de pagamento, para que o faturamento exibido reflita apenas receita confirmada.

#### Acceptance Criteria

4.1 - GIVEN pedidos na tabela `orders`, WHEN a query é executada, THEN apenas pedidos com `status IN ('paid', 'approved', 'completed')` são incluídos no cálculo.

4.2 - GIVEN pedidos com status `'pending'`, `'cancelled'` ou qualquer outro status não listado, WHEN a query é executada, THEN esses pedidos são excluídos do cálculo de faturamento.

---

### Requirement 5: Formatação de valores monetários

**User Story**: Como usuário, quero ver os valores do gráfico formatados em reais brasileiros, para que eu possa interpretar os números facilmente.

#### Acceptance Criteria

5.1 - GIVEN um valor numérico, WHEN exibido no tooltip do gráfico, THEN é formatado com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.

5.2 - GIVEN o eixo Y do gráfico, WHEN os ticks são renderizados, THEN exibem valores abreviados (ex: `R$15k`) para manter a legibilidade.

5.3 - GIVEN o valor `0`, WHEN formatado, THEN exibe `R$ 0,00` sem erros.

---

### Requirement 6: Performance e memoização

**User Story**: Como sistema, preciso evitar recálculos desnecessários ao re-renderizar o componente, para que a performance do dashboard não seja degradada.

#### Acceptance Criteria

6.1 - GIVEN o componente re-renderiza sem mudança de período ou dados, WHEN `getSalesAnalytics` seria chamada, THEN o resultado memoizado é retornado sem recálculo.

6.2 - GIVEN a query ao Supabase retorna os mesmos dados, WHEN o componente re-renderiza, THEN nenhuma nova requisição é feita ao banco.

6.3 - GIVEN a query ao Supabase, WHEN executada, THEN seleciona apenas as colunas necessárias (`total`, `created_at`) e não usa `SELECT *`.
