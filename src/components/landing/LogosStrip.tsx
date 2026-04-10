const LogosStrip = () => (
  <div className="border-y border-white/[0.05] bg-[#080d1a] py-14">
    <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-center gap-x-16 gap-y-10 px-10">

      {/* Mercado Livre */}
      <svg height="28" viewBox="0 0 220 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-35 transition-opacity duration-300 hover:opacity-90">
        <circle cx="20" cy="20" r="18" fill="none" stroke="white" strokeWidth="2"/>
        <path d="M12 22 L16 16 L20 22 L24 16 L28 22" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <text x="48" y="27" fontFamily="Inter, sans-serif" fontSize="17" fontWeight="800" fontStyle="italic" fill="white" letterSpacing="-0.5">mercado livre</text>
      </svg>

      {/* Shopee */}
      <svg height="28" viewBox="0 0 110 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-35 transition-opacity duration-300 hover:opacity-90">
        <path d="M20 8 C20 8 14 10 14 16 C14 20 17 22 20 22 C23 22 26 20 26 16 C26 10 20 8 20 8Z" stroke="white" strokeWidth="2" fill="none"/>
        <path d="M10 24 L10 36 L30 36 L30 24" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <text x="42" y="27" fontFamily="Inter, sans-serif" fontSize="19" fontWeight="800" fill="white" letterSpacing="0.5">Shopee</text>
      </svg>

      {/* AliExpress */}
      <svg height="28" viewBox="0 0 140 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-35 transition-opacity duration-300 hover:opacity-90">
        <text x="0" y="27" fontFamily="Inter, sans-serif" fontSize="19" fontWeight="700" fill="white" letterSpacing="-0.3">Ali</text>
        <text x="40" y="27" fontFamily="Inter, sans-serif" fontSize="19" fontWeight="400" fill="white" letterSpacing="-0.3">Express</text>
      </svg>

      {/* Pix */}
      <svg height="28" viewBox="0 0 80 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-35 transition-opacity duration-300 hover:opacity-90">
        <path d="M16 8 L24 16 L16 24 L8 16 Z" stroke="white" strokeWidth="2" fill="none" strokeLinejoin="round"/>
        <path d="M16 16 L20 12 L24 16 L20 20 Z" fill="white"/>
        <text x="34" y="27" fontFamily="Inter, sans-serif" fontSize="20" fontWeight="800" fill="white" letterSpacing="1">PIX</text>
      </svg>

      {/* Stripe */}
      <svg height="28" viewBox="0 0 90 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-35 transition-opacity duration-300 hover:opacity-90">
        <path d="M16 14 C16 14 12 15 12 18 C12 22 20 22 20 26 C20 30 14 30 10 29" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
        <text x="28" y="27" fontFamily="Inter, sans-serif" fontSize="19" fontWeight="700" fill="white" letterSpacing="-0.3">Stripe</text>
      </svg>

      {/* WooCommerce */}
      <svg height="28" viewBox="0 0 180 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-35 transition-opacity duration-300 hover:opacity-90">
        <rect x="2" y="10" width="26" height="20" rx="4" stroke="white" strokeWidth="2" fill="none"/>
        <path d="M8 20 L11 26 L15 18 L19 26 L22 20" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <text x="36" y="27" fontFamily="Inter, sans-serif" fontSize="17" fontWeight="700" fill="white" letterSpacing="-0.3">WooCommerce</text>
      </svg>

      {/* Dropi */}
      <svg height="28" viewBox="0 0 90 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-35 transition-opacity duration-300 hover:opacity-90">
        <path d="M16 8 C16 8 8 12 8 20 C8 26 12 30 16 30 C20 30 24 26 24 20 C24 12 16 8 16 8Z" stroke="white" strokeWidth="2" fill="none"/>
        <circle cx="16" cy="20" r="4" fill="white"/>
        <text x="34" y="27" fontFamily="Inter, sans-serif" fontSize="19" fontWeight="900" fill="white" letterSpacing="1">DROPI</text>
      </svg>

    </div>
  </div>
);

export default LogosStrip;
