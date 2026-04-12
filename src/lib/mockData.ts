// ─────────────────────────────────────────────────────────────
// MOCK DATA — substitua por chamadas reais ao Supabase no lançamento
// ─────────────────────────────────────────────────────────────

// ── Pedidos ──────────────────────────────────────────────────
export const mockOrders = [
  { id: "#4821", product: "Fone TWS", client: "João M.", platform: "Mercado Livre", status: "Entregue", value: 189, profit: 63, date: "hoje 14:32" },
  { id: "#4820", product: "Tênis Casual", client: "Maria S.", platform: "Shopee", status: "Em trânsito", value: 127, profit: 47, date: "hoje 11:15" },
  { id: "#4819", product: "Kit Skincare", client: "Ana L.", platform: "Minha Loja", status: "Processando", value: 89, profit: 38, date: "ontem 18:40" },
  { id: "#4818", product: "Relógio Smart", client: "Pedro R.", platform: "Mercado Livre", status: "Entregue", value: 234, profit: 82, date: "ontem 09:22" },
  { id: "#4817", product: "Mochila Urban", client: "Lucas F.", platform: "Shopee", status: "Cancelado", value: 156, profit: 0, date: "2 dias atrás" },
  { id: "#4816", product: "Óculos Retrô", client: "Carla D.", platform: "Minha Loja", status: "Entregue", value: 78, profit: 34, date: "2 dias atrás" },
  { id: "#4815", product: "Mouse Sem Fio", client: "Marcos V.", platform: "Mercado Livre", status: "Em trânsito", value: 67, profit: 28, date: "3 dias atrás" },
  { id: "#4814", product: "Capa iPhone", client: "Julia A.", platform: "Shopee", status: "Entregue", value: 39, profit: 22, date: "3 dias atrás" },
  { id: "#4813", product: "Perfume Importado", client: "Fernanda K.", platform: "Mercado Livre", status: "Processando", value: 189, profit: 71, date: "4 dias atrás" },
  { id: "#4812", product: "Tênis Feminino", client: "Camila B.", platform: "Shopee", status: "Em trânsito", value: 144, profit: 52, date: "4 dias atrás" },
  { id: "#4811", product: "Câmera Seg.", client: "Ricardo P.", platform: "Minha Loja", status: "Entregue", value: 278, profit: 94, date: "5 dias atrás" },
  { id: "#4810", product: "Suporte Notebook", client: "Amanda G.", platform: "Mercado Livre", status: "Entregue", value: 89, profit: 31, date: "5 dias atrás" },
  { id: "#4809", product: "Kit Maquiagem", client: "Beatriz N.", platform: "Shopee", status: "Cancelado", value: 119, profit: 0, date: "6 dias atrás" },
  { id: "#4808", product: "Luminária LED", client: "Diego S.", platform: "Minha Loja", status: "Entregue", value: 97, profit: 38, date: "6 dias atrás" },
  { id: "#4807", product: "Caixa de Som", client: "Thiago M.", platform: "Mercado Livre", status: "Processando", value: 167, profit: 57, date: "7 dias atrás" },
];

// ── Publicações ───────────────────────────────────────────────
export type ChannelStatus = "published" | "publishing" | "error" | "none";

export const mockPublications = [
  { name: "Fone TWS", sku: "AUD-4821", category: "Eletrônicos", price: "R$ 189,00", updatedAt: "Hoje, 14:32", ml: "published" as ChannelStatus, shopee: "published" as ChannelStatus, loja: "published" as ChannelStatus },
  { name: "Tênis Casual", sku: "MOD-4820", category: "Moda", price: "R$ 127,00", updatedAt: "Hoje, 11:15", ml: "published" as ChannelStatus, shopee: "publishing" as ChannelStatus, loja: "published" as ChannelStatus },
  { name: "Kit Skincare", sku: "BEL-4819", category: "Beleza", price: "R$ 89,00", updatedAt: "Ontem, 18:40", ml: "published" as ChannelStatus, shopee: "published" as ChannelStatus, loja: "error" as ChannelStatus },
  { name: "Relógio Smart", sku: "TEC-4818", category: "Eletrônicos", price: "R$ 234,00", updatedAt: "Ontem, 09:22", ml: "published" as ChannelStatus, shopee: "published" as ChannelStatus, loja: "published" as ChannelStatus },
  { name: "Mochila Urbana", sku: "MOD-4817", category: "Moda", price: "R$ 156,00", updatedAt: "2 dias atrás", ml: "publishing" as ChannelStatus, shopee: "none" as ChannelStatus, loja: "published" as ChannelStatus },
  { name: "Óculos Retrô", sku: "MOD-4816", category: "Moda", price: "R$ 78,00", updatedAt: "2 dias atrás", ml: "published" as ChannelStatus, shopee: "published" as ChannelStatus, loja: "none" as ChannelStatus },
  { name: "Mouse Sem Fio", sku: "TEC-4815", category: "Eletrônicos", price: "R$ 67,00", updatedAt: "3 dias atrás", ml: "published" as ChannelStatus, shopee: "error" as ChannelStatus, loja: "published" as ChannelStatus },
  { name: "Capa iPhone", sku: "TEC-4814", category: "Eletrônicos", price: "R$ 39,00", updatedAt: "3 dias atrás", ml: "published" as ChannelStatus, shopee: "published" as ChannelStatus, loja: "published" as ChannelStatus },
];

// ── Transações ────────────────────────────────────────────────
export const mockTransacoes = [
  { id: "TX-0091", descricao: "Pagamento Shopee", canal: "Shopee", tipo: "entrada" as const, valor: 127, status: "conciliado" as const, data: "Hoje 14:10" },
  { id: "TX-0090", descricao: "Pagamento Mercado Livre", canal: "Mercado Livre", tipo: "entrada" as const, valor: 234, status: "conciliado" as const, data: "Hoje 13:55" },
  { id: "TX-0089", descricao: "Tarifa logística", canal: "Transportadora", tipo: "saida" as const, valor: 18, status: "conciliado" as const, data: "Hoje 13:48" },
  { id: "TX-0088", descricao: "Ajuste manual", canal: "Interno", tipo: "saida" as const, valor: 45, status: "ajuste" as const, data: "Ontem" },
  { id: "TX-0087", descricao: "Pagamento Minha Loja", canal: "Minha Loja", tipo: "entrada" as const, valor: 89, status: "conciliado" as const, data: "Ontem" },
  { id: "TX-0086", descricao: "Taxa marketplace", canal: "Shopee", tipo: "saida" as const, valor: 12, status: "conciliado" as const, data: "Ontem" },
  { id: "TX-0085", descricao: "Pagamento Mercado Livre", canal: "Mercado Livre", tipo: "entrada" as const, valor: 189, status: "conciliado" as const, data: "2 dias atrás" },
  { id: "TX-0084", descricao: "Estorno pedido #4817", canal: "Shopee", tipo: "saida" as const, valor: 156, status: "pendente" as const, data: "2 dias atrás" },
  { id: "TX-0083", descricao: "Pagamento Minha Loja", canal: "Minha Loja", tipo: "entrada" as const, valor: 278, status: "conciliado" as const, data: "3 dias atrás" },
  { id: "TX-0082", descricao: "Tarifa logística", canal: "Transportadora", tipo: "saida" as const, valor: 22, status: "conciliado" as const, data: "3 dias atrás" },
];

// ── Saldos ────────────────────────────────────────────────────
export const mockSaldos = {
  disponivel: 12480,
  aLiberar: 3240,
  reservado: 890,
  repasses: [
    { canal: "Mercado Livre", valor: "R$ 4.200,00", status: "ok", data: "Hoje" },
    { canal: "Shopee", valor: "R$ 1.840,00", status: "ok", data: "Hoje" },
    { canal: "Minha Loja", valor: "R$ 620,00", status: "warning", data: "Ontem" },
    { canal: "Reserva chargeback", valor: "R$ 890,00", status: "neutral", data: "Em análise" },
  ],
};

// ── Relatórios ────────────────────────────────────────────────
export const mockRevenueData = [
  { month: "Jan", faturamento: 4200, lucro: 1400 },
  { month: "Fev", faturamento: 5800, lucro: 2100 },
  { month: "Mar", faturamento: 4900, lucro: 1700 },
  { month: "Abr", faturamento: 7200, lucro: 2800 },
  { month: "Mai", faturamento: 6800, lucro: 2400 },
  { month: "Jun", faturamento: 9100, lucro: 3600 },
  { month: "Jul", faturamento: 8400, lucro: 3200 },
  { month: "Ago", faturamento: 11200, lucro: 4500 },
  { month: "Set", faturamento: 10800, lucro: 4200 },
  { month: "Out", faturamento: 13400, lucro: 5600 },
  { month: "Nov", faturamento: 15200, lucro: 6800 },
  { month: "Dez", faturamento: 18900, lucro: 8400 },
];

export const mockOrdersData = [
  { day: "Seg", ml: 8, shopee: 5, loja: 3 },
  { day: "Ter", ml: 12, shopee: 7, loja: 4 },
  { day: "Qua", ml: 9, shopee: 6, loja: 2 },
  { day: "Qui", ml: 14, shopee: 9, loja: 5 },
  { day: "Sex", ml: 18, shopee: 11, loja: 6 },
  { day: "Sáb", ml: 15, shopee: 8, loja: 4 },
  { day: "Dom", ml: 20, shopee: 13, loja: 7 },
];

// ── Valores derivados (usados em múltiplas páginas) ───────────
export const mockStats = {
  totalOrders: mockOrders.length,
  totalRevenue: mockOrders.reduce((s, o) => s + o.value, 0),
  totalProfit: mockOrders.reduce((s, o) => s + o.profit, 0),
  processingOrders: mockOrders.filter(o => o.status === "Processando").length,
  inTransitOrders: mockOrders.filter(o => o.status === "Em trânsito").length,
  totalEntradas: mockTransacoes.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0),
  totalSaidas: mockTransacoes.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0),
  publicacoesComErro: mockPublications.filter(p => [p.ml, p.shopee, p.loja].includes("error")).length,
  publicacoesPublicando: mockPublications.filter(p => [p.ml, p.shopee, p.loja].includes("publishing")).length,
};
