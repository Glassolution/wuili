/* Each entry styled to mimic its brand's visual identity */
const logos = [
  {
    name: "Mercado Livre",
    style: { fontWeight: 900, fontStyle: "italic", letterSpacing: "-0.02em", fontSize: "18px" },
  },
  {
    name: "Shopee",
    style: { fontWeight: 800, letterSpacing: "0.02em", fontSize: "20px" },
  },
  {
    name: "AliExpress",
    style: { fontWeight: 700, letterSpacing: "-0.01em", fontSize: "19px" },
  },
  {
    name: "Dropi",
    style: { fontWeight: 900, letterSpacing: "0.04em", fontSize: "20px", textTransform: "uppercase" as const },
  },
  {
    name: "Pix",
    style: { fontWeight: 800, letterSpacing: "0.06em", fontSize: "22px", textTransform: "uppercase" as const },
  },
  {
    name: "Stripe",
    style: { fontWeight: 700, letterSpacing: "-0.02em", fontSize: "22px" },
  },
  {
    name: "WooCommerce",
    style: { fontWeight: 700, letterSpacing: "-0.01em", fontSize: "18px" },
  },
];

const allLogos = [...logos, ...logos];

const LogosStrip = () => (
  <div className="relative overflow-hidden border-y border-white/[0.05] bg-[#080d1a] py-10">
    <p className="mb-8 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">
      Integrado com
    </p>

    <div className="relative overflow-hidden">
      {/* fade edges */}
      <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-10 w-32 bg-gradient-to-r from-[#080d1a] to-transparent" />
      <div className="pointer-events-none absolute bottom-0 right-0 top-0 z-10 w-32 bg-gradient-to-l from-[#080d1a] to-transparent" />

      <div className="flex animate-ticker items-center whitespace-nowrap">
        {allLogos.map((logo, i) => (
          <span
            key={i}
            className="mx-14 flex-shrink-0 whitespace-nowrap text-white/30 transition-colors duration-300 hover:text-white/90"
            style={{
              fontFamily: "'Inter', sans-serif",
              ...logo.style,
            }}
          >
            {logo.name}
          </span>
        ))}
      </div>
    </div>
  </div>
);

export default LogosStrip;
