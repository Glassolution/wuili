export const CatalogMockup = () => (
  <div
    style={{
      width: "100%",
      maxWidth: 1120,
      margin: "0 auto",
      borderRadius: 18,
      boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
      border: "1px solid rgba(0,0,0,0.08)",
      overflow: "hidden",
      backgroundColor: "#fff",
    }}
  >
    <img
      src="/hero.png"
      alt="Tela de catálogo dropshipping da Velo"
      style={{ width: "100%", height: "auto", display: "block" }}
      loading="lazy"
    />
  </div>
);

export const ImportModalMockup = () => (
  <div style={{
    width: "100%", maxWidth: 380, backgroundColor: "#fff", borderRadius: 12,
    boxShadow: "0 24px 60px rgba(0,0,0,0.22)", border: "1px solid rgba(0,0,0,0.07)",
    overflow: "hidden", fontFamily: "system-ui,-apple-system,sans-serif",
  }}>
    <div style={{ padding: "14px 16px", borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a", marginBottom: 10 }}>Importar Produto</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "#fff", backgroundColor: "#0a0a0a", padding: "3px 10px", borderRadius: 99 }}>1 Detalhes</span>
        <span style={{ fontSize: 10, color: "#aaa" }}>→</span>
        <span style={{ fontSize: 10, color: "#aaa", padding: "3px 10px", border: "1px solid #e8e8e8", borderRadius: 99 }}>2 Revisão</span>
      </div>
    </div>
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#0a0a0a", marginBottom: 5 }}>Título do anúncio</div>
        <div style={{ border: "1.5px solid #0a0a0a", borderRadius: 8, padding: "8px 10px", fontSize: 9.5, color: "#0a0a0a", backgroundColor: "#f8f8f8", lineHeight: 1.4 }}>
          Suporte Veicular Magnético Universal 360° — Fixa no Painel
        </div>
      </div>
      <div style={{ border: "1px solid #f0f0f0", borderRadius: 9, overflow: "hidden", marginBottom: 12, fontSize: 9.5 }}>
        {[
          { label: "Custo do produto", value: "R$ 8,70", bold: false },
          { label: "Frete estimado", value: "R$ 4,50", bold: false },
          { label: "Taxas da plataforma", value: "R$ 3,20", bold: false },
          { label: "Total de custos", value: "R$ 16,40", bold: true },
        ].map((row, i) => (
          <div key={row.label} style={{
            display: "flex", justifyContent: "space-between", padding: "6px 10px",
            backgroundColor: row.bold ? "#f8f8f8" : i % 2 === 0 ? "#fafafa" : "#fff",
            fontWeight: row.bold ? 700 : 400,
            color: row.bold ? "#0a0a0a" : "#555",
            borderTop: row.bold ? "1px solid #eee" : "none",
          }}>
            <span>{row.label}</span>
            <span>{row.value}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, fontWeight: 600, marginBottom: 7 }}>
          <span style={{ color: "#0a0a0a" }}>Multiplicador</span>
          <span style={{ color: "#0a0a0a" }}>2.5x → R$ 41,00</span>
        </div>
        <div style={{ height: 5, backgroundColor: "#f0f0f0", borderRadius: 99, position: "relative" }}>
          <div style={{ width: "60%", height: "100%", backgroundColor: "#0a0a0a", borderRadius: 99 }} />
          <div style={{ width: 14, height: 14, backgroundColor: "#0a0a0a", borderRadius: "50%", position: "absolute", top: -4.5, left: "60%", transform: "translateX(-50%)", border: "2px solid #fff", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }} />
        </div>
      </div>
      <div style={{ width: "100%", backgroundColor: "#0a0a0a", color: "#fff", border: "none", borderRadius: 9, padding: "10px 0", fontSize: 11, fontWeight: 600, textAlign: "center" }}>
        Próximo →
      </div>
    </div>
  </div>
);

export const OrdersMockup = () => {
  const orders = [
    { id: "#4821", product: "Suporte Veicular Magnético", status: "Enviado", sColor: "#16a34a", sBg: "#dcfce7", value: "R$ 26,10" },
    { id: "#4820", product: "Kit Skincare Vitamina C", status: "Em preparo", sColor: "#d97706", sBg: "#fef3c7", value: "R$ 37,50" },
    { id: "#4819", product: "Fone TWS Bluetooth Pro", status: "Enviado", sColor: "#16a34a", sBg: "#dcfce7", value: "R$ 45,60" },
    { id: "#4818", product: "Smartwatch Série X Ultra", status: "Entregue", sColor: "#6b7280", sBg: "#f3f4f6", value: "R$ 126,00" },
  ];
  return (
    <div style={{
      width: "100%", maxWidth: 520, backgroundColor: "#fff", borderRadius: 12,
      boxShadow: "0 24px 60px rgba(0,0,0,0.22)", border: "1px solid rgba(0,0,0,0.07)",
      overflow: "hidden", fontFamily: "system-ui,-apple-system,sans-serif",
    }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a" }}>Pedidos</span>
        <span style={{ fontSize: 9, color: "#999" }}>Últimas 24h</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: "1px solid #f0f0f0" }}>
        {[
          { label: "Receita", value: "R$ 1.240", color: "#16a34a" },
          { label: "Pedidos", value: "47", color: "#0a0a0a" },
          { label: "Margem", value: "41%", color: "#0a0a0a" },
        ].map((m, i) => (
          <div key={m.label} style={{ padding: "12px 14px", borderRight: i < 2 ? "1px solid #f0f0f0" : "none" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: m.color, letterSpacing: "-0.03em" }}>{m.value}</div>
            <div style={{ fontSize: 8.5, color: "#999", marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>
      {orders.map((o, i) => (
        <div key={o.id} style={{ display: "flex", alignItems: "center", padding: "9px 16px", borderBottom: i < orders.length - 1 ? "1px solid #f8f8f8" : "none", gap: 10 }}>
          <span style={{ fontSize: 9, color: "#aaa", minWidth: 36 }}>{o.id}</span>
          <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: "#0a0a0a" }}>{o.product}</span>
          <span style={{ fontSize: 8.5, fontWeight: 600, color: o.sColor, backgroundColor: o.sBg, padding: "2px 8px", borderRadius: 99, whiteSpace: "nowrap" }}>{o.status}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#0a0a0a", minWidth: 52, textAlign: "right" }}>{o.value}</span>
        </div>
      ))}
    </div>
  );
};

export const OrdersDashboardMockup = () => {
  const tabs = ["Todos", "Pendente", "Pago", "Enviado", "Entregue", "Cancelado"];
  const metrics = [
    { label: "Total de Pedidos", value: "247" },
    { label: "Receita Total", value: "R$ 12.840" },
    { label: "Lucro Total", value: "R$ 5.136", green: true },
    { label: "Ticket Médio", value: "R$ 52,00" },
  ];
  return (
    <div style={{
      width: "100%", maxWidth: 560, backgroundColor: "#fff", borderRadius: 12,
      boxShadow: "0 24px 60px rgba(0,0,0,0.22)", border: "1px solid rgba(0,0,0,0.07)",
      overflow: "hidden", fontFamily: "system-ui,-apple-system,sans-serif",
    }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0a0a0a" }}>Pedidos</span>
        <div style={{ display: "flex", gap: 6 }}>
          <span style={{ fontSize: 9, color: "#555", backgroundColor: "#f5f5f5", padding: "3px 8px", borderRadius: 6 }}>Mercado Livre</span>
          <span style={{ fontSize: 9, color: "#555", backgroundColor: "#f5f5f5", padding: "3px 8px", borderRadius: 6 }}>Shopee</span>
        </div>
      </div>

      {/* Metrics 2x2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #f0f0f0" }}>
        {metrics.map((m, i) => (
          <div key={m.label} style={{
            padding: "10px 14px",
            borderRight: i % 2 === 0 ? "1px solid #f0f0f0" : "none",
            borderBottom: i < 2 ? "1px solid #f0f0f0" : "none",
          }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: m.green ? "#16a34a" : "#0a0a0a", letterSpacing: "-0.03em" }}>{m.value}</div>
            <div style={{ fontSize: 8, color: "#999", marginTop: 2 }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #f0f0f0", overflowX: "auto", padding: "0 12px" }}>
        {tabs.map((tab, i) => (
          <div key={tab} style={{
            padding: "8px 10px", fontSize: 9.5, fontWeight: i === 0 ? 700 : 400,
            color: i === 0 ? "#0a0a0a" : "#888",
            borderBottom: i === 0 ? "2px solid #0a0a0a" : "2px solid transparent",
            whiteSpace: "nowrap", cursor: "pointer",
          }}>{tab}</div>
        ))}
      </div>

      {/* Table header */}
      <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 70px", padding: "6px 14px", backgroundColor: "#fafafa", borderBottom: "1px solid #f0f0f0" }}>
        {["Pedido", "Produto", "Status", "Valor"].map(h => (
          <div key={h} style={{ fontSize: 8, fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</div>
        ))}
      </div>

      {/* Skeleton rows */}
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 80px 70px", padding: "10px 14px", borderBottom: "1px solid #f8f8f8", alignItems: "center", gap: 8 }}>
          <div style={{ height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, width: "60%" }} />
          <div style={{ height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, width: `${60 + i * 8}%` }} />
          <div style={{ height: 18, backgroundColor: "#f0f0f0", borderRadius: 99, width: 60 }} />
          <div style={{ height: 8, backgroundColor: "#f0f0f0", borderRadius: 4, width: "70%" }} />
        </div>
      ))}
    </div>
  );
};
