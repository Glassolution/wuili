# Tasks: Sales Analytics Chart

## Task List

- [ ] 1. Criar função pura `getSalesAnalytics`
  - [ ] 1.1 Criar arquivo `src/lib/salesAnalytics.ts` com os tipos `Period`, `OrderRow` e `SalesAnalyticsResult`
  - [ ] 1.2 Implementar lógica de janelas de tempo para cada período (daily: últimos 7 dias vs 7 anteriores; weekly: mês atual vs mês anterior; monthly: ano atual vs ano anterior)
  - [ ] 1.3 Implementar agrupamento por bucket com `date-fns` (`format`, `startOfDay`, `startOfMonth`, `startOfYear`, etc.)
  - [ ] 1.4 Garantir que todos os buckets existam com valor 0 quando não há dados
  - [ ] 1.5 Implementar helper `weekOfMonthLabel` para mapear dia do mês → "S1"/"S2"/"S3"/"S4"

- [ ] 2. Criar hook `useSalesAnalytics`
  - [ ] 2.1 Criar arquivo `src/hooks/useSalesAnalytics.ts`
  - [ ] 2.2 Implementar query Supabase na tabela `orders` com filtro de `status IN ('paid','approved','completed')` e `user_id`
  - [ ] 2.3 Selecionar apenas colunas `total` e `created_at` na query
  - [ ] 2.4 Aplicar `getSalesAnalytics` nos dados retornados
  - [ ] 2.5 Configurar `queryKey: ["sales-analytics", userId, period]` para cache por período
  - [ ] 2.6 Desabilitar query quando `!user` (`enabled: !!user`)

- [ ] 3. Atualizar componente do gráfico no `DashboardHomePage`
  - [ ] 3.1 Remover arrays mockados `SALES_DAILY`, `SALES_WEEKLY`, `SALES_MONTHLY`
  - [ ] 3.2 Mapear período PT-BR ("Diário"/"Semanal"/"Mensal") para tipo `Period` EN ("daily"/"weekly"/"monthly")
  - [ ] 3.3 Integrar `useSalesAnalytics` no componente, substituindo `chartData` mockado
  - [ ] 3.4 Adicionar skeleton/loading state enquanto `isLoading = true`
  - [ ] 3.5 Construir `chartData` a partir de `data.labels`, `data.current`, `data.previous` com fallback para array vazio
  - [ ] 3.6 Atualizar `ChartTooltip` para usar `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`
  - [ ] 3.7 Remover `ReferenceLine` hardcoded (ou torná-la dinâmica baseada no período atual)

- [ ] 4. Escrever testes unitários para `getSalesAnalytics`
  - [ ] 4.1 Criar arquivo `src/lib/salesAnalytics.test.ts`
  - [ ] 4.2 Testar retorno com array vazio (todos os valores devem ser 0)
  - [ ] 4.3 Testar alinhamento de arrays (`labels.length === current.length === previous.length`) para cada período
  - [ ] 4.4 Testar `weekOfMonthLabel` para dias limítrofes (1, 7, 8, 14, 15, 21, 22, 31)
  - [ ] 4.5 Testar que pedidos fora das janelas de tempo não são contabilizados
