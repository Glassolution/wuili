import {
  BarChart3,
  BookOpen,
  Home,
  Package,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

/**
 * Um passo do tour guiado.
 *
 * `target` casa com um atributo `data-dashboard-tour` que já existe na marcação
 * do app (sidebar, catálogo, pedidos, etc.). Quando o alvo não é encontrado na
 * tela, o passo é exibido centralizado em vez de ancorado — assim o tour nunca
 * trava por causa de um elemento ausente (lista vazia, permissão, etc.).
 */
export type TourStep = {
  /** Valor do data-dashboard-tour a destacar. Ausente = passo centralizado. */
  target?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Rota que precisa estar aberta para o alvo existir. */
  route: string;
};

export const TOUR_STEPS: TourStep[] = [
  {
    target: "inicio",
    title: "Este é o seu Início",
    description:
      "O painel reúne seus números principais: produtos, pedidos, páginas criadas e integrações conectadas.",
    icon: Home,
    route: "/dashboard",
  },
  {
    target: "catalogo",
    title: "Catálogo Velo",
    description:
      "Aqui ficam os produtos prontos para vender, já com fornecedor, preço e estoque atualizados.",
    icon: Package,
    route: "/dashboard/catalogo",
  },
  {
    target: "catalogo-busca",
    title: "Busque por nicho ou produto",
    description:
      "Use a busca para filtrar o catálogo e encontrar rápido o tipo de produto que você quer vender.",
    icon: Search,
    route: "/dashboard/catalogo",
  },
  {
    target: "catalogo-produto",
    title: "Escolha um produto",
    description:
      "Cada card mostra preço de custo e margem. Clique em um produto para ver os detalhes completos.",
    icon: ShoppingCart,
    route: "/dashboard/catalogo",
  },
  {
    target: "produtos-em-alta",
    title: "Produtos em Alta",
    description:
      "Veja o que está vendendo mais no momento, com sinais de demanda para escolher sua próxima oferta.",
    icon: TrendingUp,
    route: "/dashboard/produtos-em-alta",
  },
  {
    target: "minha-loja",
    title: "Páginas de venda",
    description:
      "Crie páginas de venda com IA a partir de um produto e acompanhe todas as que você já publicou.",
    icon: Sparkles,
    route: "/dashboard/minha-loja",
  },
  {
    target: "publicacoes",
    title: "Suas publicações",
    description:
      "Acompanhe o que está no ar, revise anúncios e faça ajustes sem sair da Velo.",
    icon: BookOpen,
    route: "/dashboard/publicacoes",
  },
  {
    target: "pedidos",
    title: "Pedidos",
    description:
      "Todos os pedidos dos seus canais conectados chegam aqui, com status e detalhes de cada venda.",
    icon: ShoppingCart,
    route: "/dashboard/pedidos",
  },
  {
    target: "relatorios",
    title: "Relatórios",
    description:
      "Gere relatórios de faturamento, margem e desempenho para entender o que está funcionando.",
    icon: BarChart3,
    route: "/dashboard/relatorios",
  },
  {
    target: "configuracoes",
    title: "Configurações da conta",
    description:
      "Ajuste seus dados, formas de pagamento e as integrações com Mercado Livre e Shopee.",
    icon: Settings,
    route: "/dashboard/configuracoes",
  },
  {
    title: "Tudo pronto para vender",
    description:
      "Você já conhece o essencial da Velo. Pode refazer este tour quando quiser pelo botão Assistir Tutorial no topo do painel.",
    icon: Sparkles,
    route: "/dashboard",
  },
];
