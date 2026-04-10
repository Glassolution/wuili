const logos = ["Mercado Livre", "Shopee", "AliExpress", "Shopify", "WooCommerce", "Pix", "Stripe"];

const LogosStrip = () => (
  <div className="py-8">
    <div className="relative mx-auto max-w-[1280px] px-6 md:px-20">
      <div className="flex items-center gap-10 py-6 overflow-hidden">
        <span className="flex-shrink-0 whitespace-nowrap text-[11px] font-bold uppercase tracking-[0.1em] text-white/30">
          Integrado com
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div className="absolute bottom-0 left-0 top-0 z-[1] w-16 bg-gradient-to-r from-black/40 to-transparent" />
          <div className="absolute bottom-0 right-0 top-0 z-[1] w-16 bg-gradient-to-l from-black/40 to-transparent" />
          <div className="flex animate-ticker whitespace-nowrap">
            {[...logos, ...logos].map((logo, i) => (
              <span
                key={i}
                className="mr-[52px] flex-shrink-0 whitespace-nowrap text-[15px] font-extrabold text-white/20"
              >
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
