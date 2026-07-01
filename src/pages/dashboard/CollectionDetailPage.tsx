import { useEffect, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { ProductCard, ProductCardSkeleton, type Product } from "@/components/dashboard/ProductCard";
import {
  fetchCollectionProducts,
  getCollection,
  removeProductFromCollection,
  type VeloCollection,
} from "@/lib/collectionsApi";
import { veloToast } from "@/components/ui/velo-toast";

const CollectionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [collection, setCollection] = useState<VeloCollection | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!id) return;

      setLoading(true);
      try {
        const [collectionRow, productRows] = await Promise.all([
          getCollection(id),
          fetchCollectionProducts(id),
        ]);

        if (!isMounted) return;

        setCollection(collectionRow);
        setProducts(productRows);
      } catch {
        if (isMounted) {
          veloToast.error("Não foi possível carregar a coleção.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const removeProduct = async (productId: string) => {
    if (!id || removingId) return;

    setRemovingId(productId);
    const previous = products;
    setProducts((current) => current.filter((product) => product.id !== productId));

    try {
      await removeProductFromCollection(id, productId);
    } catch {
      setProducts(previous);
      veloToast.error("Não foi possível remover o produto.");
    } finally {
      setRemovingId(null);
    }
  };

  const addProducts = () => {
    if (!collection) return;

    navigate(
      `/dashboard/catalogo?collectionId=${encodeURIComponent(collection.id)}&collectionName=${encodeURIComponent(collection.name)}`,
    );
  };

  return (
    <main className="-mt-1 min-h-full bg-[#F7F7F8] px-4 py-5 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-[1180px]">
        <button
          type="button"
          onClick={() => navigate("/colecoes")}
          className="mb-5 inline-flex h-9 items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3 text-[12px] font-semibold text-[#555] transition-colors hover:bg-[#F1F1F2] hover:text-[#111]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          Coleções
        </button>

        <header className="flex flex-col gap-4 rounded-[24px] border border-black/[0.05] bg-white p-5 shadow-[0_16px_42px_rgba(17,17,17,0.045)] sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#A3A3A3]">
              {collection?.category || "Coleção Velo"}
            </p>
            <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.06em] text-[#111111]">
              {collection?.name || "Coleção"}
            </h1>
            <p className="mt-2 text-[14px] font-medium text-[#777]">
              {products.length} produto{products.length === 1 ? "" : "s"} salvo{products.length === 1 ? "" : "s"}.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={addProducts}
              disabled={!collection}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#111111] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Adicionar produtos
            </button>
            <button
              type="button"
              disabled
              title="Em breve"
              className="inline-flex h-10 items-center justify-center rounded-full border border-black/[0.08] bg-[#F1F1F2] px-4 text-[13px] font-semibold text-[#999] disabled:cursor-not-allowed"
            >
              Publicar todos no Mercado Livre
            </button>
          </div>
        </header>

        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <ProductCardSkeleton key={index} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <section className="mt-6 rounded-[24px] border border-black/[0.05] bg-white p-8 text-center shadow-[0_16px_42px_rgba(17,17,17,0.035)]">
            <h2 className="text-[22px] font-semibold tracking-[-0.04em] text-[#111111]">
              Esta coleção ainda está vazia
            </h2>
            <p className="mx-auto mt-2 max-w-[420px] text-[14px] font-medium leading-6 text-[#888]">
              Adicione produtos do catálogo para montar uma vitrine por nicho, oferta ou campanha.
            </p>
            <button
              type="button"
              onClick={addProducts}
              className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[#111111] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              Adicionar produtos
            </button>
          </section>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => (
              <div key={product.id} className="relative">
                <button
                  type="button"
                  aria-label="Remover da coleção"
                  disabled={removingId === product.id}
                  onClick={() => removeProduct(product.id)}
                  className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#111111] text-white shadow-[0_12px_26px_rgba(17,17,17,0.2)] transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
                <ProductCard
                  product={product}
                  categoryLabel={product.categoria}
                  isFavorited
                  onToggleFavorite={() => removeProduct(product.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default CollectionDetailPage;
