import { useMemo, useState } from "react";

const platformData: Record<string, { url: string }> = {
  AliExpress: { url: "https://cdn.simpleicons.org/aliexpress/FF6A00" },
  Shopee:     { url: "/brand/shopee.png" },
  eBay:       { url: "https://cdn.simpleicons.org/ebay/E53238" },
  Shopify:    { url: "/brand/shopify-ia.png" },
  C7Drop: { url: "/velo-logo.svg" },
  Lazada:     { url: "https://cdn.simpleicons.org/lazada/0F146D" },
  WooCommerce:{ url: "https://cdn.simpleicons.org/woocommerce/96588A" },
  Etsy:       { url: "https://cdn.simpleicons.org/etsy/F16521" },
  Amazon:     { url: "/brand/amazon.png" },
  Tokopedia:  { url: "https://upload.wikimedia.org/wikipedia/commons/9/99/Tokopedia.svg" },
  BigCommerce:{ url: "https://cdn.simpleicons.org/bigcommerce/121118" },
  Rakuten:    { url: "https://cdn.simpleicons.org/rakuten/BF0000" },
  "Mercado Livre": { url: "/brand/mercado-livre.png" },
};

type Props = { platform: string; color?: string; size?: number };

const PlatformLogo = ({ platform, color, size = 18 }: Props) => {
  const [failed, setFailed] = useState(false);
  const fallbackLetters = useMemo(() => platform.slice(0, 2).toUpperCase(), [platform]);

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
      className="flex shrink-0 items-center justify-center rounded-md text-white font-semibold"
      style={{ width: size, height: size, backgroundColor: color ?? "#888", fontSize: size * 0.35 }}
    >
      {fallbackLetters}
    </span>
  );
};

export default PlatformLogo;
