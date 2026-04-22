import { useMemo, useState } from "react";

const platformData: Record<string, { url: string }> = {
  AliExpress: { url: "https://cdn.simpleicons.org/aliexpress/FF6A00" },
  Shopee:     { url: "https://cdn.simpleicons.org/shopee/EE4D2D" },
  eBay:       { url: "https://cdn.simpleicons.org/ebay/E53238" },
  Shopify:    { url: "https://cdn.simpleicons.org/shopify/96BF48" },
  Lazada:     { url: "https://cdn.simpleicons.org/lazada/0F146D" },
  WooCommerce:{ url: "https://cdn.simpleicons.org/woocommerce/96588A" },
  Etsy:       { url: "https://cdn.simpleicons.org/etsy/F16521" },
  Tokopedia:  { url: "https://upload.wikimedia.org/wikipedia/commons/9/99/Tokopedia.svg" },
  BigCommerce:{ url: "https://cdn.simpleicons.org/bigcommerce/121118" },
  Rakuten:    { url: "https://cdn.simpleicons.org/rakuten/BF0000" },
  "Mercado Livre": { url: "https://cdn.simpleicons.org/mercadolibre/FFE600" },
};

const AmazonLogo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" className="amazon-logo">
    <style>{`.amazon-logo .a-letter { fill: #1a1a1a; } .dark .amazon-logo .a-letter { fill: #ffffff; }`}</style>
    <text x="50" y="62" textAnchor="middle" className="a-letter" fontSize="58" fontWeight="900" fontFamily="Georgia, 'Times New Roman', serif">a</text>
    <path d="M22 76 Q50 90 78 76" stroke="#F90" strokeWidth="5" fill="none" strokeLinecap="round"/>
    <path d="M73 72 L79 76 L74 81" stroke="#F90" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

type Props = { platform: string; color?: string; size?: number };

const PlatformLogo = ({ platform, color, size = 18 }: Props) => {
  const [failed, setFailed] = useState(false);
  const fallbackLetters = useMemo(() => platform.slice(0, 2).toUpperCase(), [platform]);

  if (platform === "Amazon") return <AmazonLogo size={size} />;

  const data = platformData[platform];

  if (data && !failed) {
    return (
      <img
        src={data.url}
        alt={platform}
        style={{ width: size, height: size, objectFit: "contain" }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md text-white font-black"
      style={{ width: size, height: size, backgroundColor: color ?? "#888", fontSize: size * 0.35 }}
    >
      {fallbackLetters}
    </span>
  );
};

export default PlatformLogo;
