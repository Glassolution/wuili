// Shared badge counts derived from mock data
// In a real app these would come from an API/store

const orders = [
  { status: "Processando" },
  { status: "Em trânsito" },
  { status: "Processando" },
  { status: "Entregue" },
  { status: "Cancelado" },
  { status: "Entregue" },
  { status: "Em trânsito" },
  { status: "Entregue" },
  { status: "Processando" },
  { status: "Em trânsito" },
  { status: "Entregue" },
  { status: "Entregue" },
  { status: "Cancelado" },
  { status: "Entregue" },
  { status: "Processando" },
];

const publications = [
  { ml: "published", shopee: "published", loja: "published" },
  { ml: "published", shopee: "publishing", loja: "published" },
  { ml: "published", shopee: "published", loja: "error" },
  { ml: "published", shopee: "published", loja: "published" },
  { ml: "publishing", shopee: "none", loja: "published" },
  { ml: "published", shopee: "published", loja: "none" },
  { ml: "published", shopee: "error", loja: "published" },
  { ml: "published", shopee: "published", loja: "published" },
];

export const badges = {
  // pedidos em processando + em trânsito
  pedidos: orders.filter((o) => o.status === "Processando" || o.status === "Em trânsito").length,
  // publicações com erro ou publicando
  publicacoes: publications.filter((p) =>
    Object.values(p).some((v) => v === "error" || v === "publishing")
  ).length,
  // transações: fixed alert count
  transacoes: 1,
};
