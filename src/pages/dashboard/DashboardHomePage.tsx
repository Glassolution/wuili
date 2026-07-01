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
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCollection,
  deleteCollection,
  listCollectionCategories,
  listCollectionsWithSummaries,
  type CollectionSummary,
} from "@/lib/collectionsApi";
import { veloToast } from "@/components/ui/velo-toast";

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
  <div className={`box-border overflow-hidden rounded-[12px] border-[0.5px] border-[#E5E5E5] bg-white p-2 shadow-[0_4px_12px_rgba(0,0,0,0.08)] ${className}`}>
    {product ? (
      <img src={product.image} alt="" className="h-full w-full rounded-[8px] object-cover object-center" />
    ) : (
      <div className="h-full w-full rounded-[8px] bg-[linear-gradient(135deg,#F6F6F5_0%,#EFEFED_100%)]" />
    )}
  </div>
);

const HeroCollage = ({ products }: { products: ProductPreview[] }) => (
  <div className="relative h-[220px] w-[280px]">
    <ProductTile
      product={products[3]}
      className="absolute left-[0px] top-[42px] h-[160px] w-[130px] -rotate-[8deg]"
    />
    <ProductTile
      product={products[1]}
      className="absolute left-[38px] top-[28px] z-10 h-[160px] w-[130px] -rotate-[4deg]"
    />
    <ProductTile
      product={products[0]}
      className="absolute left-[75px] top-[18px] z-30 h-[160px] w-[130px] rotate-[1deg]"
    />
    <ProductTile
      product={products[2]}
      className="absolute left-[112px] top-[30px] z-20 h-[160px] w-[130px] rotate-[4deg]"
    />
    <ProductTile
      product={products[4]}
      className="absolute left-[150px] top-[44px] h-[160px] w-[130px] rotate-[8deg]"
    />
    <span className="absolute left-[28px] top-[20px] z-40 h-5 w-[2px] -rotate-[24deg] rounded-full bg-[#111]" />
    <span className="absolute left-[44px] top-[14px] z-40 h-3.5 w-[2px] -rotate-[5deg] rounded-full bg-[#111]" />
    <span className="absolute right-[2px] bottom-[46px] z-40 h-5 w-[2px] rotate-[44deg] rounded-full bg-[#111]" />
    <span className="absolute right-[24px] bottom-[34px] z-40 h-3.5 w-[2px] rotate-[68deg] rounded-full bg-[#111]" />
  </div>
);

const CardProductStack = ({ products }: { products: ProductPreview[] }) => (
  <div className="absolute bottom-5 left-5 right-5 h-[112px]">
    {products.slice(0, 3).map((product, index) => (
      <div
        key={`${product.id}-${index}`}
        className="absolute bottom-0 h-[104px] w-[42%] overflow-hidden rounded-[13px] border border-black/[0.055] bg-white shadow-[0_16px_28px_rgba(17,17,17,0.08)] transition-transform duration-300 group-hover:-translate-y-2"
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

const CreateCollectionModal = ({
  open,
  categories,
  creating,
  onClose,
  onCreate,
}: {
  open: boolean;
  categories: string[];
  creating: boolean;
  onClose: () => void;
  onCreate: (payload: { name: string; category: string | null }) => void;
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName("");
      setCategory(categories[0] ?? null);
    }
  }, [categories, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-[430px] rounded-[22px] border border-black/[0.06] bg-white p-5 shadow-[0_24px_70px_rgba(17,17,17,0.18)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold tracking-[-0.04em] text-[#111111]">
              Criar coleção
            </h2>
            <p className="mt-1 text-[13px] font-medium leading-5 text-[#777]">
              Nomeie uma vitrine para salvar produtos do catálogo Velo.
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-[#777] transition-colors hover:bg-[#F4F4F3] hover:text-[#111]"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <label className="mt-5 block text-[12px] font-semibold uppercase tracking-[0.08em] text-[#999]">
          Nome da coleção
        </label>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
          placeholder="Ex: Eletrônicos campeões"
          className="mt-2 h-11 w-full rounded-[12px] border border-black/[0.08] bg-[#FAFAFA] px-3 text-[14px] font-medium text-[#111] outline-none transition-colors placeholder:text-[#B8B8B8] focus:border-[#111]"
        />

        <p className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-[#999]">
          Categoria
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(categories.length > 0 ? categories : ["Geral"]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`h-9 rounded-full px-3 text-[12px] font-semibold transition-colors ${
                category === item
                  ? "bg-[#111111] text-white"
                  : "bg-[#F3F3F2] text-[#555] hover:bg-[#EBEBEA] hover:text-[#111]"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={!name.trim() || creating}
          onClick={() => onCreate({ name: name.trim(), category })}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#111111] text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {creating ? "Criando..." : "Criar coleção"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-full text-[13px] font-semibold text-[#777] transition-colors hover:bg-[#F6F6F5] hover:text-[#111]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
};

const CollectionCard = ({
  collection,
  deleting,
  onDelete,
}: {
  collection: CollectionSummary;
  deleting: boolean;
  onDelete: () => void;
}) => {
  return (
    <article
      className="relative min-h-[172px] rounded-[16px] border border-[#E5E5E5] bg-[#FAFAF9] p-5 text-left shadow-[0_14px_34px_rgba(17,17,17,0.035)]"
    >
      <button
        type="button"
        aria-label="Excluir coleção"
        disabled={deleting}
        onClick={onDelete}
        className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-[#999] transition-colors hover:bg-white hover:text-[#111] disabled:cursor-wait disabled:opacity-45"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.8} />
      </button>

      <p className="pr-10 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#999]">
        {collection.category || "COLEÇÃO VELO"}
      </p>
      <h2 className="mt-3 pr-10 text-[16px] font-semibold leading-[1.2] tracking-[-0.025em] text-black">
        {collection.name}
      </h2>
      <p className="mt-2 text-[13px] font-medium text-[#777]">
        {collection.productCount} produto{collection.productCount === 1 ? "" : "s"} salvo{collection.productCount === 1 ? "" : "s"}
      </p>

      <div className="mt-7 flex items-center gap-2">
        {collection.thumbnails.length > 0 ? (
          collection.thumbnails.map((image, index) => (
            <img
              key={`${image}-${index}`}
              src={image}
              alt=""
              className="h-12 w-12 rounded-[8px] border border-black/[0.04] bg-white object-cover object-center"
            />
          ))
        ) : (
          <div className="h-12 w-12 rounded-[8px] border border-black/[0.04] bg-[#EFEFEE]" />
        )}
      </div>
    </article>
  );
};

const DashboardHomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [deletingCollectionId, setDeletingCollectionId] = useState<string | null>(null);

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

  const loadCollectionData = async (userId: string) => {
    const [collectionRows, categoryRows] = await Promise.all([
      listCollectionsWithSummaries(userId),
      listCollectionCategories(),
    ]);

    setCollections(collectionRows);
    setCategories(categoryRows);
  };

  useEffect(() => {
    if (!user?.id) return;

    loadCollectionData(user.id).catch(() => {
      veloToast.error("Não foi possível carregar suas coleções.");
    });
  }, [user?.id]);

  const handleCreateCollection = async ({ name, category }: { name: string; category: string | null }) => {
    if (!user?.id) {
      veloToast.error("Faça login para criar uma coleção.");
      return;
    }

    setCreatingCollection(true);

    try {
      const collection = await createCollection({ name, category, userId: user.id });
      setCreateModalOpen(false);
      navigate(
        `/dashboard/catalogo?collectionId=${encodeURIComponent(collection.id)}&collectionName=${encodeURIComponent(collection.name)}`,
      );
    } catch {
      veloToast.error("Não foi possível criar a coleção.");
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleDeleteCollection = async (collection: CollectionSummary) => {
    const confirmed = window.confirm(`Excluir a coleção "${collection.name}"?`);
    if (!confirmed) return;

    setDeletingCollectionId(collection.id);

    try {
      await deleteCollection(collection.id);
      if (user?.id) await loadCollectionData(user.id);
    } catch {
      veloToast.error("Não foi possível excluir a coleção.");
    } finally {
      setDeletingCollectionId(null);
    }
  };

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
      className="relative -m-5 min-h-screen overflow-visible bg-white pb-24 text-[#111111] sm:-m-6 lg:-m-7"
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

      <section className="relative mx-auto flex w-full max-w-[1180px] flex-col items-center bg-white px-6 pb-20 pt-[8.8vh]">
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
            onClick={() => setCreateModalOpen(true)}
            className="mt-7 inline-flex h-9 items-center gap-2 rounded-[10px] bg-[#F5F5F4] px-4 text-[13px] font-semibold text-[#222] shadow-[0_12px_24px_rgba(17,17,17,0.05),inset_0_0_0_1px_rgba(0,0,0,0.03)] transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className="h-[14px] w-[14px]" strokeWidth={2} />
            Criar
          </button>
        </motion.div>

        <motion.div
          className="grid w-full max-w-[760px] grid-cols-1 gap-4 pt-24 md:grid-cols-2"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.14}
        >
          {collections.length === 0 ? (
            featureCards.map((card, index) => (
              <article
                key={card.eyebrow}
                className={`group relative h-[280px] overflow-hidden rounded-[16px] border border-black/[0.035] ${card.tone} p-5 shadow-[0_16px_42px_rgba(17,17,17,0.032)]`}
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
                  <div className="absolute bottom-5 left-6 right-6 h-[104px] rounded-[14px] border border-black/[0.045] bg-[linear-gradient(135deg,#F7F7F6_0%,#EFEFED_100%)] shadow-[0_16px_28px_rgba(17,17,17,0.06)]" />
                )}
              </article>
            ))
          ) : (
            collections.map((collection) => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                deleting={deletingCollectionId === collection.id}
                onDelete={() => handleDeleteCollection(collection)}
              />
            ))
          )}
        </motion.div>
      </section>

      <CreateCollectionModal
        open={createModalOpen}
        categories={categories}
        creating={creatingCollection}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateCollection}
      />
    </main>
  );
};

export default DashboardHomePage;
