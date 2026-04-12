const logos = [
  /* Mercado Livre */
  <svg key="ml" viewBox="0 0 240 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="22" cy="22" r="20" fill="none" stroke="white" strokeWidth="2.5"/>
    <path d="M13 24 L17 17 L22 24 L27 17 L31 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="52" y="30" fontFamily="Inter, sans-serif" fontSize="20" fontWeight="800" fontStyle="italic" fill="white" letterSpacing="-0.5">mercado livre</text>
  </svg>,

  /* Shopee */
  <svg key="shopee" viewBox="0 0 130 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22 8 C22 8 15 11 15 18 C15 22 18 24 22 24 C26 24 29 22 29 18 C29 11 22 8 22 8Z" stroke="white" strokeWidth="2.5" fill="none"/>
    <path d="M11 26 L11 38 L33 38 L33 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="46" y="30" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="800" fill="white" letterSpacing="0.3">Shopee</text>
  </svg>,

  /* AliExpress */
  <svg key="ali" viewBox="0 0 160 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="30" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="700" fill="white" letterSpacing="-0.3">Ali</text>
    <text x="44" y="30" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="400" fill="white" letterSpacing="-0.3">Express</text>
  </svg>,

  /* PIX */
  <svg key="pix" viewBox="0 0 95 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 6 L28 18 L18 30 L8 18 Z" stroke="white" strokeWidth="2.5" fill="none" strokeLinejoin="round"/>
    <path d="M18 18 L22 13 L28 18 L22 23 Z" fill="white"/>
    <text x="38" y="30" fontFamily="Inter, sans-serif" fontSize="24" fontWeight="800" fill="white" letterSpacing="1.5">PIX</text>
  </svg>,

  /* Stripe */
  <svg key="stripe" viewBox="0 0 105 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 14 C18 14 13 15 13 19 C13 24 22 24 22 29 C22 33 15 33 11 32" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
    <text x="30" y="30" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="700" fill="white" letterSpacing="-0.3">Stripe</text>
  </svg>,

  /* WooCommerce */
  <svg key="woo" viewBox="0 0 210 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="10" width="30" height="24" rx="5" stroke="white" strokeWidth="2.5" fill="none"/>
    <path d="M9 22 L13 29 L17 18 L21 29 L25 22" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <text x="40" y="30" fontFamily="Inter, sans-serif" fontSize="20" fontWeight="700" fill="white" letterSpacing="-0.3">WooCommerce</text>
  </svg>,

  /* Amazon */
  <svg key="amazon" viewBox="0 0 150 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="30" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="800" fill="white" letterSpacing="-0.5">amazon</text>
    <path d="M2 34 Q75 44 148 34" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
  </svg>,

  /* Dropi */
  <svg key="dropi" viewBox="0 0 100 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 8 C18 8 10 12 10 20 C10 26 14 30 18 30 C22 30 26 26 26 20 C26 12 18 8 18 8Z" stroke="white" strokeWidth="2.5" fill="none"/>
    <circle cx="18" cy="20" r="3.5" fill="white"/>
    <text x="36" y="30" fontFamily="Inter, sans-serif" fontSize="20" fontWeight="900" fill="white" letterSpacing="1">DROPI</text>
  </svg>,

  /* Nuvemshop */
  <svg key="nuvem" viewBox="0 0 180 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 28 C6 28 4 25 4 22 C4 18 7 16 10 16 C10 12 14 8 20 8 C25 8 28 11 29 15 C32 14 36 16 36 20 C36 24 33 28 28 28 Z" stroke="white" strokeWidth="2" fill="none"/>
    <text x="44" y="30" fontFamily="Inter, sans-serif" fontSize="18" fontWeight="700" fill="white" letterSpacing="-0.3">Nuvemshop</text>
  </svg>,

  /* Yampi */
  <svg key="yampi" viewBox="0 0 100 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="30" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="800" fill="white" letterSpacing="-0.3">Yampi</text>
  </svg>,
];

const doubled = [...logos, ...logos];

const LogosStrip = () => (
  <div className="bg-black py-16">
    {/* Centered container with max-width and fade edges */}
    <div className="relative mx-auto max-w-[1200px] overflow-hidden px-6 md:px-10">
      {/* Fade left */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-black to-transparent" />
      {/* Fade right */}
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-black to-transparent" />

      {/* Scrolling track */}
      <div
        className="flex items-center gap-16"
        style={{
          animation: "scroll-logos 35s linear infinite",
          width: "max-content",
        }}
      >
        {doubled.map((logo, i) => (
          <div key={i} className="h-[36px] flex-shrink-0 opacity-85" style={{ display: "flex", alignItems: "center" }}>
            {/* Clone SVG with fixed height */}
            <div className="h-[36px] [&>svg]:h-full [&>svg]:w-auto">
              {logo}
            </div>
          </div>
        ))}
      </div>
    </div>

    <style>{`
      @keyframes scroll-logos {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
    `}</style>
  </div>
);

export default LogosStrip;
