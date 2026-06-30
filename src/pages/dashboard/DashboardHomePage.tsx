import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Archive,
  CircleHelp,
  Folder,
  Globe2,
  Grid2X2,
  Plus,
  Search,
  Settings,
  Sparkle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type CatalogProductRow = Database["public"]["Tables"]["catalog_products"]["Row"];

type ProductPreview = {
  id: string;
  title: string;
  category: string;
  image: string;
};

const fadeUp = {
  hidden: { opacity: 0, y: 18, scale: 0.98 },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.58, ease: [0.16, 1, 0.3, 1], delay },
  }),
};

const featureCards = [
  {
    eyebrow: "ORGANIZE SEU CATÁLOGO",
    title: "Salve e organize produtos vencedores sem esforço",
    tone: "bg-[#FAFAFA]",
  },
  {
    eyebrow: "REÚNA SUAS IDEIAS",
    title: "Crie coleções para testar nichos, ofertas e anúncios",
    tone: "bg-[#FBFBFB]",
  },
  {
    eyebrow: "CONSTRUA SUA LOJA",
    title: "Publique seus favoritos no Mercado Livre em poucos cliques",
    tone: "bg-[#FAFAFA]",
  },
];

const getProductImages = (images: Json | null): string[] => {
  if (!images) return [];

  if (Array.isArray(images)) {
    return images.filter((image): image is string => typeof image === "string" && image.trim().length > 0);
  }

  if (typeof images === "string") {
    try {
      const parsed: unknown = JSON.parse(images);
      return Array.isArray(parsed)
        ? parsed.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
        : [images];
    } catch {
      return [images];
    }
  }

  return [];
};

const mapProductPreview = (product: CatalogProductRow): ProductPreview | null => {
  const [image] = getProductImages(product.images);

  if (!image) return null;

  return {
    id: product.id,
    title: product.title,
    category: product.category || "Produto",
    image,
  };
};

const ToolbarIcon = ({ children, label }: { children: ReactNode; label: string }) => (
  <button
    type="button"
    aria-label={label}
    className="grid h-7 w-7 place-items-center rounded-full text-[#171717] transition-colors hover:bg-[#F4F4F3]"
  >
    {children}
  </button>
);

const ProductTile = ({
  product,
  className,
}: {
  product?: ProductPreview;
  className: string;
}) => (
  <div className={`overflow-hidden border border-black/[0.06] bg-[#F7F7F6] shadow-[0_18px_42px_rgba(17,17,17,0.11)] ${className}`}>
    {product ? (
      <img src={product.image} alt="" className="h-full w-full object-cover object-center" />
    ) : (
      <div className="h-full w-full bg-[linear-gradient(135deg,#F6F6F5_0%,#EFEFED_100%)]" />
    )}
  </div>
);

const HeroCollage = ({ products }: { products: ProductPreview[] }) => (
  <div className="relative h-[238px] w-[318px]">
    <ProductTile
      product={products[3]}
      className="absolute left-[16px] top-[66px] h-[122px] w-[72px] -rotate-[12deg] rounded-[16px]"
    />
    <ProductTile
      product={products[1]}
      className="absolute left-[72px] top-[34px] h-[168px] w-[108px] rotate-[3deg] rounded-[18px]"
    />
    <ProductTile
      product={products[0]}
      className="absolute left-[122px] top-[16px] z-20 h-[188px] w-[128px] -rotate-[1deg] rounded-[20px] shadow-[0_24px_54px_rgba(17,17,17,0.16)]"
    />
    <ProductTile
      product={products[2]}
      className="absolute right-[22px] top-[48px] h-[142px] w-[94px] rotate-[10deg] rounded-[17px]"
    />
    <ProductTile
      product={products[4]}
      className="absolute bottom-[4px] left-[105px] z-30 h-[74px] w-[96px] -rotate-[5deg] rounded-[15px] shadow-[0_20px_42px_rgba(17,17,17,0.13)]"
    />
    <span className="absolute left-[42px] top-[28px] h-5 w-[2px] -rotate-[24deg] rounded-full bg-[#111]" />
    <span className="absolute left-[58px] top-[22px] h-3.5 w-[2px] -rotate-[5deg] rounded-full bg-[#111]" />
    <span className="absolute right-[12px] bottom-[46px] h-5 w-[2px] rotate-[44deg] rounded-full bg-[#111]" />
    <span className="absolute right-[34px] bottom-[34px] h-3.5 w-[2px] rotate-[68deg] rounded-full bg-[#111]" />
  </div>
);

const CardProductStack = ({ products }: { products: ProductPreview[] }) => (
  <div className="absolute -bottom-10 left-5 right-5 h-[104px]">
    {products.slice(0, 3).map((product, index) => (
      <div
        key={`${product.id}-${index}`}
        className="absolute bottom-0 h-[92px] w-[42%] overflow-hidden rounded-[13px] border border-black/[0.055] bg-white shadow-[0_16px_28px_rgba(17,17,17,0.08)] transition-transform duration-300 group-hover:-translate-y-2"
        style={{
          left: `${index * 27}%`,
          transform: `rotate(${[-5, 1, 5][index]}deg)`,
          zIndex: index + 1,
        }}
      >
        <img src={product.image} alt="" className="h-full w-full object-cover object-center" />
      </div>
    ))}
  </div>
);

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<ProductPreview[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchProducts = async () => {
      const { data, error } = await supabase
        .from("catalog_products")
        .select("id,title,category,images,is_active,is_blocked,stock_quantity,orders_count")
        .eq("source", "c7drop")
        .eq("is_active", true)
        .eq("is_blocked", false)
        .gt("stock_quantity", 0)
        .order("orders_count", { ascending: false, nullsFirst: false })
        .limit(12);

      if (error || !isMounted) return;

      const previews = ((data ?? []) as CatalogProductRow[])
        .map(mapProductPreview)
        .filter((product): product is ProductPreview => Boolean(product));

      setProducts(previews);
    };

    fetchProducts();

    return () => {
      isMounted = false;
    };
  }, []);

  const productGroups = useMemo(() => {
    if (products.length === 0) return featureCards.map(() => []);

    return featureCards.map((_, index) =>
      [0, 1, 2]
        .map((offset) => products[(index * 3 + offset + 2) % products.length])
        .filter((product): product is ProductPreview => Boolean(product)),
    );
  }, [products]);

  return (
    <main
      className="relative -m-5 min-h-[calc(100%+40px)] overflow-hidden bg-white text-[#111111] sm:-m-6 sm:min-h-[calc(100%+48px)] lg:-m-7 lg:min-h-[calc(100%+56px)]"
      style={{ fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
    >
      <header className="relative z-20 flex h-12 items-center gap-3 border-b border-black/[0.03] px-4">
        <div className="flex items-center gap-2">
          <ToolbarIcon label="Ajustes">
            <Settings className="h-[15px] w-[15px]" strokeWidth={2} />
          </ToolbarIcon>
          <ToolbarIcon label="Aplicativos">
            <Grid2X2 className="h-[15px] w-[15px]" strokeWidth={2} />
          </ToolbarIcon>
          <ToolbarIcon label="Arquivos">
            <Folder className="h-[15px] w-[15px]" strokeWidth={2} />
          </ToolbarIcon>
          <ToolbarIcon label="Coleções">
            <Archive className="h-[15px] w-[15px]" strokeWidth={2} />
          </ToolbarIcon>
          <ToolbarIcon label="Mercados">
            <Globe2 className="h-[15px] w-[15px]" strokeWidth={2} />
          </ToolbarIcon>
        </div>

        <div className="mx-2 flex h-9 flex-1 items-center gap-2 rounded-full bg-[#FBFBFA] px-3 text-[#A3A3A3] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.025)]">
          <Search className="h-[14px] w-[14px]" strokeWidth={1.8} />
          <span className="text-[13px] font-medium">Buscar em todas as coleções</span>
        </div>

        <div className="flex items-center gap-2">
          <ToolbarIcon label="Configurações">
            <Settings className="h-[15px] w-[15px]" strokeWidth={2} />
          </ToolbarIcon>
          <ToolbarIcon label="Ajuda">
            <CircleHelp className="h-[15px] w-[15px]" strokeWidth={2} />
          </ToolbarIcon>
          <button
            type="button"
            aria-label="Conta"
            className="h-7 w-7 rounded-full bg-[radial-gradient(circle_at_72%_26%,#FFB84D_0%,#F97316_26%,#EC4899_58%,#7C3AED_100%)] shadow-[0_6px_18px_rgba(236,72,153,0.22)]"
          />
        </div>
      </header>

      <section className="relative mx-auto flex min-h-[calc(100vh-48px)] w-full max-w-[1180px] flex-col items-center px-6 pb-0 pt-[8.8vh]">
        <motion.div
          className="flex flex-col items-center text-center"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <HeroCollage products={products} />

          <h1 className="mt-5 text-[20px] font-semibold tracking-[-0.035em] text-[#151515]">
            Crie uma coleção única
          </h1>
          <p className="mt-3 max-w-[360px] text-center text-[14px] font-medium leading-[1.5] text-[#B8B8B8]">
            Reúna produtos, ideias, anúncios e referências para acelerar sua próxima venda.
          </p>
          <button
            type="button"
            onClick={() => navigate("/dashboard/catalogo")}
            className="mt-7 inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#F5F5F4] px-4 text-[13px] font-semibold text-[#222] shadow-[0_12px_24px_rgba(17,17,17,0.05),inset_0_0_0_1px_rgba(0,0,0,0.03)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-[14px] w-[14px]" strokeWidth={2} />
            Criar
          </button>
        </motion.div>

        <motion.div
          className="mt-auto grid w-full max-w-[880px] grid-cols-1 gap-4 pt-24 sm:grid-cols-3"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.14}
        >
          {featureCards.map((card, index) => (
            <article
              key={card.eyebrow}
              className={`group relative h-[218px] overflow-hidden rounded-[16px] border border-black/[0.035] ${card.tone} p-5 shadow-[0_16px_42px_rgba(17,17,17,0.032)]`}
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.04em] text-[#B0B0B0]">
                {card.eyebrow}
              </p>
              <h2 className="mt-4 max-w-[235px] text-[17px] font-semibold leading-[1.18] tracking-[-0.035em] text-[#1A1A1A]">
                {card.title}
              </h2>
              {productGroups[index].length > 0 ? (
                <CardProductStack products={productGroups[index]} />
              ) : (
                <div className="absolute -bottom-8 left-6 right-6 h-[92px] rounded-t-[14px] border border-black/[0.045] bg-[linear-gradient(135deg,#F7F7F6_0%,#EFEFED_100%)] shadow-[0_16px_28px_rgba(17,17,17,0.06)]" />
              )}
            </article>
          ))}
        </motion.div>

        <button
          type="button"
          onClick={() => navigate("/dashboard/atlas")}
          aria-label="Abrir Aquas"
          className="absolute bottom-5 right-5 grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-[0_12px_32px_rgba(17,17,17,0.1),inset_0_0_0_1px_rgba(0,0,0,0.05)] transition-transform hover:-translate-y-0.5"
        >
          <Sparkle className="h-[19px] w-[19px]" strokeWidth={1.8} />
        </button>
      </section>
    </main>
  );
};

export default DashboardHomePage;
