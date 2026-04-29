const partnerLogos = [
  {
    name: "Mercado Livre",
    src: "/brand/mercado-livre.svg",
    frameClass: "bg-[#FFE600]",
    imageClass: "h-8 md:h-9",
  },
  {
    name: "CJ Dropshipping",
    src: "/brand/cj-dropshipping.svg",
    frameClass: "bg-white",
    imageClass: "h-8 md:h-9",
  },
  {
    name: "Shopee",
    src: "/brand/shopee.svg",
    frameClass: "bg-white",
    imageClass: "h-7 md:h-8",
  },
  {
    name: "Mercado Pago",
    src: "/brand/mercado-pago.svg",
    frameClass: "bg-[#FFE600]",
    imageClass: "h-8 md:h-9",
  },
];

const doubled = [...partnerLogos, ...partnerLogos, ...partnerLogos];

const LogosStrip = () => (
  <section className="bg-black py-14 md:py-16" aria-label="Integrações relevantes para a Velo">
    <div className="relative mx-auto max-w-[1200px] overflow-hidden px-6 md:px-10">
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-black to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-black to-transparent" />

      <div
        className="flex w-max items-center gap-6 md:gap-8"
        style={{ animation: "scroll-logos 30s linear infinite" }}
      >
        {doubled.map((logo, i) => (
          <div
            key={`${logo.name}-${i}`}
            className={`flex h-16 min-w-[210px] shrink-0 items-center justify-center rounded-2xl border border-white/10 px-7 shadow-[0_16px_55px_rgba(255,255,255,0.08)] ${logo.frameClass}`}
          >
            <img
              src={logo.src}
              alt={`${logo.name} logo`}
              className={`w-auto max-w-[160px] object-contain ${logo.imageClass}`}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>

    <style>{`
      @keyframes scroll-logos {
        0% { transform: translateX(0); }
        100% { transform: translateX(-33.333%); }
      }
    `}</style>
  </section>
);

export default LogosStrip;
