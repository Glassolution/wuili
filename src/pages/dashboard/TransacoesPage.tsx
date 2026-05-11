import { useState } from "react";
import { Search, Download, ChevronDown, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, Menu } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type CategoryType = "frete_pago" | "frete_pendente" | "processando" | "enviado";

type Transaction = {
  id: string;
  date: string;
  pedido: string;
  produto: string;
  category: CategoryType;
  method: string;
  canal: string;
  amount: number;
  isPositive: boolean;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const mockTransactions: Transaction[] = [
  {
    id: "1",
    date: "30 abr. 2026",
    pedido: "VL-00001",
    produto: "Suporte Veicular",
    category: "frete_pago",
    method: "CJ Dropshipping",
    canal: "Mercado Livre",
    amount: 36.00,
    isPositive: true,
  },
  {
    id: "2",
    date: "29 abr. 2026",
    pedido: "VL-00002",
    produto: "Fone Bluetooth",
    category: "frete_pendente",
    method: "CJ Dropshipping",
    canal: "Mercado Livre",
    amount: 72.25,
    isPositive: false,
  },
  {
    id: "3",
    date: "28 abr. 2026",
    pedido: "VL-00003",
    produto: "Luminária LED",
    category: "enviado",
    method: "CJ Dropshipping",
    canal: "Mercado Livre",
    amount: 91.88,
    isPositive: true,
  },
  {
    id: "4",
    date: "27 abr. 2026",
    pedido: "VL-00004",
    produto: "Carregador Portátil",
    category: "enviado",
    method: "CJ Dropshipping",
    canal: "Mercado Livre",
    amount: 37.80,
    isPositive: true,
  },
  {
    id: "5",
    date: "26 abr. 2026",
    pedido: "VL-00005",
    produto: "Mouse Sem Fio",
    category: "processando",
    method: "CJ Dropshipping",
    canal: "Mercado Livre",
    amount: 35.00,
    isPositive: true,
  },
  {
    id: "6",
    date: "25 abr. 2026",
    pedido: "VL-00006",
    produto: "Teclado Mecânico RGB",
    category: "frete_pendente",
    method: "CJ Dropshipping",
    canal: "Mercado Livre",
    amount: 131.50,
    isPositive: false,
  },
];

// ─── Format Currency ──────────────────────────────────────────────────────────
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

// ─── Category Badge ───────────────────────────────────────────────────────────
const CategoryBadge = ({ category }: { category: CategoryType }) => {
  const config = {
    frete_pago: { bg: "#ECFDF5", color: "#10B981", label: "Frete pago", dot: "#10B981" },
    frete_pendente: { bg: "#FFF7ED", color: "#FB923C", label: "Frete pendente", dot: "#FB923C" },
    processando: { bg: "#EFF6FF", color: "#3B82F6", label: "Processando", dot: "#3B82F6" },
    enviado: { bg: "#ECFDF5", color: "#10B981", label: "Enviado", dot: "#10B981" },
  };

  const { bg, color, label, dot } = config[category];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        backgroundColor: bg,
        color: color,
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        padding: "5px 12px",
        borderRadius: "999px",
      }}
    >
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: dot, flexShrink: 0 }} />
      {label}
    </span>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const TransacoesPage = () => {
  const [filterStatus, setFilterStatus] = useState<"all" | CategoryType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Calculate summary
  const saldoCJ = 320.00;
  const fretesPendentes = 240.65;
  const lucroEstimado = 384.31;

  // Filter transactions
  const filteredTransactions = mockTransactions.filter((t) => {
    const matchesSearch =
      t.pedido.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.produto.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterStatus === "all" || t.category === filterStatus;

    return matchesSearch && matchesFilter;
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
      }}
    >
      {/* ── Summary Strip ────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "32px",
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.04)",
          borderRadius: "28px",
          padding: "24px 32px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {/* Saldo CJ */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#FAFAFA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Menu size={20} strokeWidth={1.8} style={{ color: "#111111" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: "15px",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                color: "#737373",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Saldo CJ disponível
            </p>
            <p
              style={{
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "#111111",
                margin: 0,
                marginTop: "4px",
                lineHeight: 1.2,
              }}
            >
              {formatBRL(saldoCJ)}
            </p>
          </div>
        </div>

        {/* Fretes Pendentes */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#FAFAFA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TrendingDown size={20} strokeWidth={1.8} style={{ color: "#111111" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: "15px",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                color: "#737373",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Fretes pendentes
            </p>
            <p
              style={{
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "#111111",
                margin: 0,
                marginTop: "4px",
                lineHeight: 1.2,
              }}
            >
              {formatBRL(fretesPendentes)}
            </p>
          </div>
        </div>

        {/* Lucro Estimado */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#FAFAFA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TrendingUp size={20} strokeWidth={1.8} style={{ color: "#111111" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <p
              style={{
                fontSize: "15px",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                color: "#737373",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Lucro estimado
            </p>
            <p
              style={{
                fontSize: "22px",
                fontWeight: 600,
                letterSpacing: "-0.03em",
                color: "#111111",
                margin: 0,
                marginTop: "4px",
                lineHeight: 1.2,
              }}
            >
              {formatBRL(lucroEstimado)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Table Container ─────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.04)",
          borderRadius: "28px",
          padding: "28px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {/* Filters */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* All Transactions Dropdown */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                height: "38px",
                padding: "0 16px",
                fontSize: "14px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "#111111",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "background-color 0.15s",
              }}
            >
              Todas transações
              <ChevronDown size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
            </button>

            {/* Date Dropdown */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                height: "38px",
                padding: "0 16px",
                fontSize: "14px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "#111111",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "background-color 0.15s",
              }}
            >
              Data
              <ChevronDown size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
            </button>

            {/* Filter Button */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                height: "38px",
                padding: "0 16px",
                fontSize: "14px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "#111111",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "background-color 0.15s",
              }}
            >
              Filtro
            </button>
          </div>

          {/* Right Side */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Search Icon */}
            <button
              style={{
                width: "38px",
                height: "38px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                cursor: "pointer",
              }}
            >
              <Search size={16} strokeWidth={1.8} style={{ color: "#111111" }} />
            </button>

            {/* Export Dropdown */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                height: "38px",
                padding: "0 16px",
                fontSize: "14px",
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "#111111",
                backgroundColor: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "10px",
                cursor: "pointer",
                transition: "background-color 0.15s",
              }}
            >
              Exportar
              <ChevronDown size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #F3F4F6" }}>
                {["Data", "Pedido / Produto", "Categoria", "Método / Canal", "Valor"].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: "14px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 500,
                      letterSpacing: "-0.01em",
                      color: "#9CA3AF",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction, index) => (
                <tr
                  key={transaction.id}
                  style={{
                    borderBottom: index < filteredTransactions.length - 1 ? "1px solid #F9FAFB" : "none",
                    transition: "background-color 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {/* Date */}
                  <td style={{ padding: "18px 16px" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 400,
                        letterSpacing: "-0.01em",
                        color: "#737373",
                      }}
                    >
                      {transaction.date}
                    </span>
                  </td>

                  {/* Pedido / Produto */}
                  <td style={{ padding: "18px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          backgroundColor: "#F5F5F5",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "#111111",
                          flexShrink: 0,
                        }}
                      >
                        {transaction.pedido.slice(-2)}
                      </div>
                      <div>
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: 500,
                            letterSpacing: "-0.01em",
                            color: "#111111",
                            margin: 0,
                          }}
                        >
                          {transaction.pedido} · {transaction.produto}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td style={{ padding: "18px 16px" }}>
                    <CategoryBadge category={transaction.category} />
                  </td>

                  {/* Method / Canal */}
                  <td style={{ padding: "18px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {/* Icon */}
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "50%",
                          backgroundColor: "#111111",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "#FFFFFF",
                          flexShrink: 0,
                        }}
                      >
                        CJ
                      </div>
                      <span
                        style={{
                          fontSize: "14px",
                          fontWeight: 400,
                          letterSpacing: "-0.01em",
                          color: "#111111",
                        }}
                      >
                        {transaction.method}
                      </span>
                    </div>
                  </td>

                  {/* Amount */}
                  <td style={{ padding: "18px 16px", textAlign: "right" }}>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        letterSpacing: "-0.02em",
                        color: transaction.isPositive ? "#10B981" : "#111111",
                      }}
                    >
                      {transaction.isPositive ? "+" : "−"} {formatBRL(transaction.amount)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid #F3F4F6",
          }}
        >
          <p
            style={{
              fontSize: "13px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "#737373",
              margin: 0,
            }}
          >
            {filteredTransactions.length} transações
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 400,
                letterSpacing: "-0.01em",
                color: "#737373",
                margin: 0,
              }}
            >
              Mostrando 1-{filteredTransactions.length} de {filteredTransactions.length}
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <ChevronLeft size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
              </button>
              <button
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
              >
                <ChevronRight size={14} strokeWidth={1.8} style={{ color: "#737373" }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransacoesPage;
