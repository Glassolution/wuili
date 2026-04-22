const stats = [
  { value: "+4.200", label: "produtos no catálogo" },
  { value: "1 clique", label: "para publicar em qualquer lugar" },
  { value: "0", label: "estoque necessário" },
  { value: "99,9%", label: "uptime garantido" },
];

const StatsBand = () => (
  <div style={{ background: "#0a2540", borderTop: "1px solid #e3e8ef" }}>
    <div style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "60px 80px" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "1px", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "1px", background: "rgba(255,255,255,0.08)" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)" }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ padding: "0 40px", borderRight: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", textAlign: "center" }}>
            <p style={{ fontSize: "38px", fontWeight: 900, color: "#fff", letterSpacing: "-2px", lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.42)", marginTop: "6px" }}>{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default StatsBand;
