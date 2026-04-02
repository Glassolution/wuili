const logos = [
  "Mercado Livre",
  "Shopee",
  "AliExpress",
  "Shopify",
  "WooCommerce",
  "Pix",
  "Stripe",
];

const LogosStrip = () => (
  <section className="py-12 border-y border-border overflow-hidden">
    <div className="max-w-7xl mx-auto px-6 flex items-center gap-12">
      <span className="text-sm font-bold text-muted-foreground whitespace-nowrap uppercase tracking-wider">
        Integrado com
      </span>
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10" />
        <div className="flex animate-ticker whitespace-nowrap">
          {[...logos, ...logos].map((logo, i) => (
            <span key={i} className="text-2xl font-bold text-muted-foreground/40 mx-8 select-none">
              {logo}
            </span>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default LogosStrip;
