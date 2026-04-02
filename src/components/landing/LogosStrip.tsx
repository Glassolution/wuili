const logos = ["Mercado Livre", "Shopee", "AliExpress", "Shopify", "WooCommerce", "Pix", "Stripe"];

const LogosStrip = () => (
  <div style={{ background: "#fff", borderTop: "1px solid #e3e8ef" }}>
    <div style={{ position: "relative", maxWidth: "1280px", margin: "0 auto", padding: "0 80px" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "1px", background: "#e3e8ef" }} />
      <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: "1px", background: "#e3e8ef" }} />
      <div style={{ padding: "24px 0", overflow: "hidden", display: "flex", alignItems: "center", gap: "40px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#97aab3", textTransform: "uppercase", letterSpacing: "0.1em", whiteSpace: "nowrap", flexShrink: 0 }}>
          Integrado com
        </span>
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "64px", background: "linear-gradient(to right, #fff, transparent)", zIndex: 1 }} />
          <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "64px", background: "linear-gradient(to left, #fff, transparent)", zIndex: 1 }} />
          <div className="flex animate-ticker whitespace-nowrap">
            {[...logos, ...logos].map((logo, i) => (
              <span key={i} style={{ fontSize: "15px", fontWeight: 800, color: "#c8d2dc", marginRight: "52px", whiteSpace: "nowrap", flexShrink: 0 }}>
                {logo}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default LogosStrip;
