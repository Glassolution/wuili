const partnerLogos = [
  {
    name: "Shopee",
    src: "/brand/shopee.svg",
    imageClass: "h-8 md:h-9",
  },
  {
    name: "Mercado Livre",
    src: "/brand/mercado-livre.svg",
    imageClass: "h-9 md:h-10",
  },
  {
    name: "TikTok Shop",
    src: "/brand/tiktok-shop.svg",
    imageClass: "h-8 md:h-9",
  },
];

const LogosStrip = () => (
  <section className="bg-black py-14 md:py-16" aria-label="Marketplaces integrados e planejados">
    <div className="mx-auto flex max-w-[980px] flex-wrap items-center justify-center gap-x-16 gap-y-10 px-6 md:gap-x-24 md:px-10">
      {partnerLogos.map((logo) => (
        <img
          key={logo.name}
          src={logo.src}
          alt={`${logo.name} logo`}
          className={`w-auto max-w-[190px] object-contain opacity-90 transition-opacity duration-200 hover:opacity-100 ${logo.imageClass}`}
          style={{ filter: "brightness(0) invert(1)" }}
          loading="lazy"
        />
      ))}
    </div>
  </section>
);

export default LogosStrip;
