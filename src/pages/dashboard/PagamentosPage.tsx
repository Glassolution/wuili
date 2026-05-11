import { useState } from "react";
import { ExternalLink, TrendingUp, Clock, Package, DollarSign } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type PaymentStatus = "paid_cj" | "pending";
type CJStatus = "processing" | "shipped" | "awaiting_balance";

type Order = {
  id: string;
  pedido: string;
  produto: string;
  frete: number;
  paymentStatus: PaymentStatus;
  cjStatus: CJStatus;
  date: string;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────
const mockOrders: Order[] = [
  {
    id: "1",
    pedido: "VL-00001",
    produto: "Suporte Veicular",
    frete: 18.90,
    paymentStatus: "paid_cj",
    cjStatus: "processing",
    date: "30/04/2026",
  },
  {
    id: "2",
    pedido: "VL-00002",
    produto: "Fone Bluetooth",
    frete: 22.50,
    paymentStatus: "pending",
    cjStatus: "awaiting_balance",
    date: "29/04/2026",
  },
  {
    id: "3",
    pedido: "VL-00003",
    produto: "Luminária LED",
    frete: 31.20,
    paymentStatus: "paid_cj",
    cjStatus: "shipped",
    date: "28/04/2026",
  },
  {
    id: "4",
    pedido: "VL-00004",
    produto: "Carregador Portátil",
    frete: 19.80,
    paymentStatus: "paid_cj",
    cjStatus: "shipped",
    date: "27/04/2026",
  },
  {
    id: "5",
    pedido: "VL-00005",
    produto: "Mouse Sem Fio",
    frete: 16.40,
    paymentStatus: "paid_cj",
    cjStatus: "processing",
    date: "26/04/2026",
  },
  {
    id: "6",
    pedido: "VL-00006",
    produto: "Teclado Mecânico RGB",
    frete: 42.60,
    paymentStatus: "pending",
    cjStatus: "awaiting_balance",
    date: "25/04/2026",
  },
];

// ─── Format Currency ──────────────────────────────────────────────────────────
const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

// ─── Payment Status Badge ─────────────────────────────────────────────────────
const PaymentStatusBadge = ({ status }: { status: PaymentStatus }) => {
  const config = {
    paid_cj: { bg: "#ECFDF5", color: "#10B981", label: "Pago na CJ" },
    pending: { bg: "#FFF7ED", color: "#FB923C", label: "Pendente" },
  };

  const { bg, color, label } = config[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: bg,
        color: color,
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        padding: "4px 12px",
        borderRadius: "999px",
      }}
    >
      {label}
    </span>
  );
};

// ─── CJ Status Badge ──────────────────────────────────────────────────────────
const CJStatusBadge = ({ status }: { status: CJStatus }) => {
  const config = {
    processing: { bg: "#EFF6FF", color: "#3B82F6", label: "Processando" },
    shipped: { bg: "#ECFDF5", color: "#10B981", label: "Enviado" },
    awaiting_balance: { bg: "#FEF2F2", color: "#EF4444", label: "Aguardando saldo" },
  };

  const { bg, color, label } = config[status];

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: bg,
        color: color,
        fontSize: "13px",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        padding: "4px 12px",
        borderRadius: "999px",
      }}
    >
      {label}
    </span>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const PagamentosPage = () => {
  // Calculate summary
  const saldoCJ = 320.00;
  const fretesPendentes = mockOrders
    .filter(o => o.paymentStatus === "pending")
    .reduce((sum, o) => sum + o.frete, 0);
  const pedidosAguardando = mockOrders.filter(o => o.cjStatus === "awaiting_balance").length;
  const totalGastoMes = mockOrders.reduce((sum, o) => sum + o.frete, 0);

  const handleOpenCJ = () => {
    window.open("https://cjdropshipping.com", "_blank", "noopener,noreferrer");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "28px",
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        WebkitFontSmoothing: "antialiased",
        textRendering: "optimizeLegibility",
      }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 600,
            letterSpacing: "-0.04em",
            color: "#111111",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Saldo CJ Dropshipping
        </h1>
        <p
          style={{
            fontSize: "14px",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "#737373",
            marginTop: "6px",
          }}
        >
          Gerencie pedidos e acompanhe os pagamentos realizados diretamente na CJ Dropshipping.
        </p>
      </div>

      {/* ── Summary Card ────────────────────────────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "20px",
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.04)",
          borderRadius: "24px",
          padding: "28px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
        }}
      >
        {/* Saldo atual CJ */}
        <div>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#F5F5F5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <DollarSign size={20} strokeWidth={1.8} style={{ color: "#111111" }} />
          </div>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "#737373",
              margin: 0,
            }}
          >
            Saldo atual CJ
          </p>
          <p
            style={{
              fontSize: "24px",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: "#111111",
              margin: 0,
              marginTop: "6px",
            }}
          >
            {formatBRL(saldoCJ)}
          </p>
        </div>

        {/* Fretes pendentes */}
        <div>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#FFF7ED",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <Clock size={20} strokeWidth={1.8} style={{ color: "#FB923C" }} />
          </div>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "#737373",
              margin: 0,
            }}
          >
            Fretes pendentes
          </p>
          <p
            style={{
              fontSize: "24px",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: "#FB923C",
              margin: 0,
              marginTop: "6px",
            }}
          >
            {formatBRL(fretesPendentes)}
          </p>
        </div>

        {/* Pedidos aguardando */}
        <div>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#FEF2F2",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <Package size={20} strokeWidth={1.8} style={{ color: "#EF4444" }} />
          </div>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "#737373",
              margin: 0,
            }}
          >
            Pedidos aguardando envio
          </p>
          <p
            style={{
              fontSize: "24px",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: "#EF4444",
              margin: 0,
              marginTop: "6px",
            }}
          >
            {pedidosAguardando}
          </p>
        </div>

        {/* Total gasto */}
        <div>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              backgroundColor: "#EFF6FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "12px",
            }}
          >
            <TrendingUp size={20} strokeWidth={1.8} style={{ color: "#3B82F6" }} />
          </div>
          <p
            style={{
              fontSize: "13px",
              fontWeight: 400,
              letterSpacing: "-0.01em",
              color: "#737373",
              margin: 0,
            }}
          >
            Total gasto este mês
          </p>
          <p
            style={{
              fontSize: "24px",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: "#3B82F6",
              margin: 0,
              marginTop: "6px",
            }}
          >
            {formatBRL(totalGastoMes)}
          </p>
        </div>
      </div>

      {/* ── CJ Dropshipping Button ──────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
          padding: "32px",
          backgroundColor: "#FAFAFA",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: "20px",
        }}
      >
        <button
          onClick={handleOpenCJ}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            height: "48px",
            padding: "0 32px",
            fontSize: "15px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "#FFFFFF",
            backgroundColor: "#111111",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#000000")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#111111")}
        >
          Abrir CJ Dropshipping
          <ExternalLink size={16} strokeWidth={2} />
        </button>

        <p
          style={{
            fontSize: "13px",
            fontWeight: 400,
            letterSpacing: "-0.01em",
            color: "#737373",
            margin: 0,
            textAlign: "center",
            maxWidth: "600px",
          }}
        >
          Os pagamentos e recargas são realizados diretamente na plataforma da CJ Dropshipping.
        </p>
      </div>

      {/* ── Orders Table ────────────────────────────────────────────────── */}
      <div>
        <h2
          style={{
            fontSize: "18px",
            fontWeight: 600,
            letterSpacing: "-0.03em",
            color: "#111111",
            margin: 0,
            marginBottom: "16px",
          }}
        >
          Controle de pedidos
        </h2>

        <div
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid rgba(0,0,0,0.06)",
            borderRadius: "16px",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ backgroundColor: "#FAFAFA", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                {["Pedido", "Produto", "Frete", "Status do pagamento", "Status CJ", "Data"].map((header) => (
                  <th
                    key={header}
                    style={{
                      padding: "14px 20px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 600,
                      letterSpacing: "-0.01em",
                      color: "#737373",
                      textTransform: "uppercase",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mockOrders.map((order, index) => (
                <tr
                  key={order.id}
                  style={{
                    borderBottom: index < mockOrders.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none",
                    transition: "background-color 0.12s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#FAFAFA")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "16px 20px" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                        color: "#111111",
                      }}
                    >
                      {order.pedido}
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 400,
                        letterSpacing: "-0.01em",
                        color: "#111111",
                      }}
                    >
                      {order.produto}
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 500,
                        letterSpacing: "-0.01em",
                        color: "#111111",
                      }}
                    >
                      {formatBRL(order.frete)}
                    </span>
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <CJStatusBadge status={order.cjStatus} />
                  </td>
                  <td style={{ padding: "16px 20px" }}>
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 400,
                        letterSpacing: "-0.01em",
                        color: "#737373",
                      }}
                    >
                      {order.date}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PagamentosPage;
