// MOCK DATA — substitua por chamadas reais ao Supabase no lancamento

// Pedidos (5 pedidos do arquivo)
export const mockOrders = [
  { id: "PED-1001", product: "Organizador de Gaveta", client: "Ana Souza", platform: "Magalu", status: "Enviado", value: 30.75, profit: 5.80, date: "24/05/2025" },
  { id: "PED-1002", product: "Elastico de Resistencia Set", client: "Bruno Ferreira", platform: "Mercado Livre", status: "Aguardando pagamento", value: 38.24, profit: 22.24, date: "07/10/2025" },
  { id: "PED-1003", product: "LEGO Compativel City", client: "Camila Santos", platform: "AliExpress", status: "Aguardando pagamento", value: 68.12, profit: 35.67, date: "03/06/2025" },
  { id: "PED-1004", product: "Elastico de Resistencia Set", client: "Diego Oliveira", platform: "Mercado Livre", status: "Em processo", value: 37.82, profit: 19.34, date: "01/09/2025" },
  { id: "PED-1005", product: "Tenis Running Lite", client: "Elisa Martins", platform: "Mercado Livre", status: "Aguardando pagamento", value: 107.11, profit: 67.14, date: "02/08/2025" },
];

// Publicacoes
export type ChannelStatus = "published" | "publishing" | "error" | "none";
export const mockPublications: { name: string; sku: string; category: string; price: string; updatedAt: string; ml: ChannelStatus; shopee: ChannelStatus; loja: ChannelStatus }[] = [];

// Transacoes derivadas dos 5 pedidos
export const mockTransacoes = [
  { id: "TX-001", descricao: "Pagamento Magalu - PED-1001", canal: "Magalu", tipo: "entrada" as const, valor: 30.75, status: "conciliado" as const, data: "24/05/2025" },
  { id: "TX-002", descricao: "Pagamento Mercado Livre - PED-1002", canal: "Mercado Livre", tipo: "entrada" as const, valor: 38.24, status: "pendente" as const, data: "07/10/2025" },
  { id: "TX-003", descricao: "Pagamento AliExpress - PED-1003", canal: "AliExpress", tipo: "entrada" as const, valor: 68.12, status: "pendente" as const, data: "03/06/2025" },
  { id: "TX-004", descricao: "Pagamento Mercado Livre - PED-1004", canal: "Mercado Livre", tipo: "entrada" as const, valor: 37.82, status: "conciliado" as const, data: "01/09/2025" },
  { id: "TX-005", descricao: "Pagamento Mercado Livre - PED-1005", canal: "Mercado Livre", tipo: "entrada" as const, valor: 107.11, status: "pendente" as const, data: "02/08/2025" },
  { id: "TX-006", descricao: "Custo fornecedor - PED-1001", canal: "HomeOrg Solutions", tipo: "saida" as const, valor: 15.00, status: "conciliado" as const, data: "24/05/2025" },
  { id: "TX-007", descricao: "Frete - PED-1001", canal: "Transportadora", tipo: "saida" as const, valor: 19.90, status: "conciliado" as const, data: "24/05/2025" },
  { id: "TX-008", descricao: "Custo fornecedor - PED-1003", canal: "BrickMaster Supply", tipo: "saida" as const, valor: 25.00, status: "conciliado" as const, data: "03/06/2025" },
  { id: "TX-009", descricao: "Frete - PED-1003", canal: "Transportadora", tipo: "saida" as const, valor: 14.90, status: "conciliado" as const, data: "03/06/2025" },
  { id: "TX-010", descricao: "Custo fornecedor - PED-1005", canal: "Footwear Global", tipo: "saida" as const, valor: 35.00, status: "conciliado" as const, data: "02/08/2025" },
  { id: "TX-011", descricao: "Frete - PED-1005", canal: "Transportadora", tipo: "saida" as const, valor: 19.90, status: "conciliado" as const, data: "02/08/2025" },
  { id: "TX-012", descricao: "Custo fornecedor - PED-1002", canal: "FitGear Wholesale", tipo: "saida" as const, valor: 16.00, status: "conciliado" as const, data: "07/10/2025" },
  { id: "TX-013", descricao: "Custo fornecedor - PED-1004", canal: "FitGear Wholesale", tipo: "saida" as const, valor: 16.00, status: "conciliado" as const, data: "01/09/2025" },
  { id: "TX-014", descricao: "Frete - PED-1004", canal: "Transportadora", tipo: "saida" as const, valor: 9.90, status: "conciliado" as const, data: "01/09/2025" },
];

// Saldos calculados dos 5 pedidos
// Disponivel = pedidos Enviados/Entregues ja pagos = PED-1001 (30.75) + PED-1004 (37.82) = 68.57
// A liberar = pedidos Aguardando pagamento = PED-1002 + PED-1003 + PED-1005 = 213.47
export const mockSaldos = {
  disponivel: 68.57,
  aLiberar: 213.47,
  reservado: 0,
  repasses: [
    { canal: "Mercado Livre", valor: "R$ 183,17", status: "ok", data: "Hoje" },
    { canal: "Magalu", valor: "R$ 30,75", status: "ok", data: "24/05/2025" },
    { canal: "AliExpress", valor: "R$ 68,12", status: "warning", data: "03/06/2025" },
  ],
};

// Grafico de faturamento por mes (dos 5 pedidos)
export const mockRevenueData = [
  { month: "Mai", faturamento: 30.75, lucro: 5.80 },
  { month: "Jun", faturamento: 68.12, lucro: 35.67 },
  { month: "Ago", faturamento: 107.11, lucro: 67.14 },
  { month: "Set", faturamento: 37.82, lucro: 19.34 },
  { month: "Out", faturamento: 38.24, lucro: 22.24 },
];

export const mockOrdersData = [
  { day: "Mercado Livre", ml: 3, shopee: 0 },
  { day: "AliExpress", ml: 1, shopee: 0 },
  { day: "Magalu", ml: 1, shopee: 0 },
];

// Resumo por loja (dos 5 pedidos)
export const mockResumoLoja = [
  { loja: "Mercado Livre", pedidos: 3, receita: 183.17, lucro: 108.72 },
  { loja: "AliExpress", pedidos: 1, receita: 68.12, lucro: 35.67 },
  { loja: "Magalu", pedidos: 1, receita: 30.75, lucro: 5.80 },
];

// Resumo por categoria (dos 5 pedidos)
export const mockResumoCategoria = [
  { categoria: "Esportes", pedidos: 2, receita: 145.93, lucro: 86.48, margem_pct: 59.3 },
  { categoria: "Brinquedos", pedidos: 1, receita: 68.12, lucro: 35.67, margem_pct: 52.4 },
  { categoria: "Moda", pedidos: 1, receita: 107.11, lucro: 67.14, margem_pct: 62.7 },
  { categoria: "Casa", pedidos: 1, receita: 30.75, lucro: 5.80, margem_pct: 18.9 },
];

// Valores derivados calculados automaticamente
export const mockStats = {
  totalOrders: mockOrders.length,
  totalRevenue: mockOrders.reduce((s, o) => s + o.value, 0),
  totalProfit: mockOrders.reduce((s, o) => s + o.profit, 0),
  totalEntradas: mockTransacoes.filter(t => t.tipo === "entrada").reduce((s, t) => s + t.valor, 0),
  totalSaidas: mockTransacoes.filter(t => t.tipo === "saida").reduce((s, t) => s + t.valor, 0),
  publicacoesComErro: 0,
  publicacoesPublicando: 0,
};
