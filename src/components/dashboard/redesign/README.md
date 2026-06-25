# Dashboard Redesign - Velo

Redesign completo do dashboard inspirado no Olshop Dashboard com componentes modulares e reutilizáveis.

## Estrutura de Componentes

### 1. **Sidebar.tsx**
- Sidebar fixa à esquerda com logo da Velo
- Menus expansíveis com submenu
- Itens: Dashboard, Produtos, Pedidos, Financeiro, Promoções, Analytics, Configurações
- Ícones via Lucide React

### 2. **Header.tsx**
- Header fixo no topo com título "Dashboard"
- Botões de notificação, configurações e "Ver Loja"
- Posicionado ao lado da sidebar

### 3. **BannerIA.tsx**
- Banner com gradiente azul
- Ícone de Sparkles
- Texto dinâmico com contagem de produtos
- Botão "Ver Produtos"

### 4. **MetricCard.tsx**
- Card compacto com 2 valores cada
- Suporta ícone opcional
- Tipografia bold para números
- Bordas e espaçamento consistentes

### 5. **SalesChart.tsx**
- Gráfico de área usando Recharts
- Eixo X: horas do dia (00 ao 24)
- Valor total em bold com variação % vs ontem
- Gradiente azul no preenchimento

### 6. **MiniMetrics.tsx**
- 4 mini métricas empilhadas
- Cada uma com valor + variação % colorida
- Verde para positivo, vermelho para negativo
- Background colorido por tipo de variação

### 7. **ProductsTable.tsx**
- Tabela com 5 produtos mockados
- Colunas: Produto | Canal | Tipo | Visualizações | Cliques | CTR | Custo | Vendas
- Checkbox para seleção
- Search bar + filtro "Escolher Critério"
- Variações coloridas nas colunas numéricas

### 8. **DashboardRedesign.tsx**
- Componente principal que orquestra todos os outros
- Layout responsivo com grid
- Dados mockados

## Cores

- Fundo: #FFFFFF (white)
- Sidebar: #FFFFFF com borda direita
- Accent: #2563EB (blue-600)
- Sucesso: #16A34A (green-600)
- Erro: #DC2626 (red-600)
- Texto principal: #111827 (gray-900)

## Tipografia

- Font: Inter
- Números: Bold (font-bold)
- Títulos: Semibold (font-semibold)
- Labels: Medium (font-medium)

## Como Usar

Acesse a rota `/dashboard-redesign` para visualizar o novo dashboard.

```tsx
import { DashboardRedesign } from "@/components/dashboard/redesign/DashboardRedesign";

export default function DashboardRedesignPage() {
  return <DashboardRedesign />;
}
```

## Dados Mockados

Todos os dados são mockados e podem ser facilmente substituídos por dados reais:

- **Produtos**: 5 produtos com dados de visualizações, cliques, CTR, custo e vendas
- **Métricas**: Valores fixos com variações percentuais
- **Gráfico**: 9 pontos de dados por hora do dia
- **Mini Métricas**: 4 métricas com variações

## Próximos Passos

1. Integrar com API real para dados dinâmicos
2. Adicionar filtros e busca funcional
3. Implementar paginação na tabela
4. Adicionar exportação de dados
5. Implementar dark mode
