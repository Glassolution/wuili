const logos = [
  { name: "Mercado Livre", color: "#FFE600" },
  { name: "Shopee", color: "#F85A00" },
  { name: "AliExpress", color: "#FF4747" },
  { name: "Dropi", color: "#6C63FF" },
  { name: "Pix", color: "#32BCAD" },
  { name: "Stripe", color: "#635BFF" },
  { name: "WooCommerce", color: "#96588A" },
];

const allLogos = [...logos, ...logos];

const LogosStrip = () => (
  <div className="relative overflow-hidden border-y border-white/[0.06] bg-[#080d1a] py-7">
    <p className="mb-5 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
      Integrado com
    </p>
    <div className="relative overflow-hidden">
      {/* fade edges */}
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-20 bg-gradient-to-r from-[#080d1a] to-transparent" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-20 bg-gradient-to-l from-[#080d1a] to-transparent" />
      <div className="flex animate-ticker items-center whitespace-nowrap">
        {allLogos.map((logo, i) => (
          <span
            key={i}
            className="mx-10 flex-shrink-0 text-[15px] font-black tracking-tight text-white/30 transition-colors duration-300 hover:text-white/80"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {logo.name}
          </span>
        ))}
      </div>
    </div>
  </div>
);

export default LogosStrip;
