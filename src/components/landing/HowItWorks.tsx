const steps = [
  { num: "01", emoji: "🏪", title: "Crie sua loja", desc: "Template pronto em 5 minutos. Personalize com sua marca." },
  { num: "02", emoji: "📦", title: "Escolha produtos", desc: "+4.200 produtos verificados de fornecedores reais." },
  { num: "03", emoji: "🚀", title: "Publique com 1 clique", desc: "Vai pro ML, Shopee e sua loja automaticamente." },
  { num: "04", emoji: "💰", title: "Receba o lucro", desc: "Fornecedor entrega, você embolsa a diferença." },
];

const HowItWorks = () => (
  <div id="como-funciona" style={{ background: "#fff", borderTop: "1px solid #e3e8ef" }}>
    <div style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "88px 80px" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "1px", background: "#e3e8ef" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "1px", background: "#e3e8ef" }} />

      <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#635bff", marginBottom: "14px" }}>Como funciona</p>
      <h2 style={{ fontSize: "clamp(28px,2.8vw,40px)", fontWeight: 900, letterSpacing: "-1.5px", color: "#0a2540", marginBottom: "52px" }}>
        Do zero à primeira venda em 4 passos
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", border: "1px solid #e3e8ef", borderRadius: "16px", overflow: "hidden" }}>
        {steps.map((s, i) => (
          <div key={s.num} style={{ padding: "30px 24px", borderRight: i < 3 ? "1px solid #e3e8ef" : "none" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#635bff", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.num}</span>
            <span style={{ fontSize: "28px", display: "block", margin: "12px 0" }}>{s.emoji}</span>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#0a2540", marginBottom: "6px" }}>{s.title}</h3>
            <p style={{ fontSize: "13px", color: "#425466", lineHeight: 1.6 }}>{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default HowItWorks;
