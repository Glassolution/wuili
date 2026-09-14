// Catálogo público da loja — estilo AERO STEP (creme #f5f2ea + verde musgo
// #3d4a2a + acento dourado #c8a24a). Rota /loja/:slug/catalogo. Lista todos
// os produtos da loja com filtros de categoria, busca e ordenação, casando
// com o visual do StorefrontLojaTemplate.
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Heart,
  Loader2,
  Plus,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  UserRound,
} from "lucide-react";
import {
  fetchPublicProject,
  fetchPublicStoreProducts,
  getProjectLogoImage,
  getProjectProductIds,
  getProjectStoreName,
  type PublicStoreProduct,
  type UserProject,
} from "@/lib/userProjects";
import { formatPriceBRL as formatBRL } from "@/lib/priceFormat";

const SORTS = [
  { id: "relevancia", label: "Relevância" },
  { id: "menor", label: "Menor preço" },
  { id: "maior", label: "Maior preço" },
  { id: "nome", label: "Nome (A-Z)" },
] as const;

type SortId = (typeof SORTS)[number]["id"];

const PublicStoreCatalogPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [project, setProject] = useState<UserProject | null>(null);
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortId>("relevancia");

  const activeCategory = searchParams.get("categoria") || "";

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const found = await fetchPublicProject(slug);
        if (!active) return;
        setProject(found);
        if (found) {
          const list = await fetchPublicStoreProducts(getProjectProductIds(found));
          if (active) setProducts(list);
        }
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (q && !p.title.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === "menor") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "maior") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "nome") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [products, activeCategory, query, sort]);

  const setCategory = (category: string) => {
    const next = new URLSearchParams(searchParams);
    if (category) next.set("categoria", category);
    else next.delete("categoria");
    setSearchParams(next, { replace: true });
  };

  const storeName = project ? getProjectStoreName(project) || project.nome : "Loja";
  const logoImage = project ? getProjectLogoImage(project) : null;
  const storeHref = slug ? `/loja/${slug}` : "/";
  const cartHref = slug ? `/loja/${slug}/carrinho` : "/carrinho";

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea]">
        <Loader2 className="animate-spin text-[#3d4a2a]" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f2ea] p-6 text-center">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1a1a1a]">Loja não encontrada</h1>
          <p className="mt-2 text-[13px] text-[#1a1a1a]/60">Verifique o link ou tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f2ea] text-[#1a1a1a]">
      {/* NAVBAR */}
      <header className="relative z-30 flex items-center justify-between gap-6 px-6 py-5 md:px-10">
        <Link to={storeHref} className="flex items-center gap-2.5">
          {logoImage ? (
            <img src={logoImage} alt={storeName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3d4a2a] text-[11px] font-semibold text-[#f5f2ea]">
              {storeName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="text-[15px] font-semibold uppercase tracking-[-0.01em]">{storeName}</span>
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <Link to={storeHref} className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#3d4a2a]">
            Início
          </Link>
          <span className="text-[13px] font-semibold text-[#3d4a2a]">Catálogo</span>
          <button
            type="button"
            onClick={() => navigate(storeHref)}
            className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#3d4a2a]"
          >
            Novidades
          </button>
          <button
            type="button"
            onClick={() => navigate(storeHref)}
            className="text-[13px] font-medium text-[#1a1a1a]/75 transition hover:text-[#3d4a2a]"
          >
            Sobre
          </button>
        </nav>
        <div className="flex items-center gap-3">
          <Link
            to={slug ? `/loja/${slug}/conta` : "#"}
            className="hidden items-center gap-2 rounded-full border border-[#1a1a1a]/12 bg-white px-4 py-2 text-[12px] font-semibold text-[#1a1a1a] transition hover:border-[#3d4a2a]/40 md:inline-flex"
          >
            <UserRound size={14} strokeWidth={2} />
            Entrar
          </Link>
          <Link
            to={cartHref}
            className="inline-flex items-center gap-2 rounded-full bg-[#3d4a2a] px-4 py-2 text-[12px] font-semibold text-[#f5f2ea] transition hover:bg-[#2c3620]"
          >
            <ShoppingBag size={14} strokeWidth={2} />
            Carrinho
            <span className="ml-0.5 rounded-full bg-[#c8a24a] px-1.5 text-[10px] font-bold text-[#3d4a2a]">0</span>
          </Link>
        </div>
      </header>

      {/* HEADER DA PÁGINA */}
      <section className="px-6 md:px-10">
        <div className="rounded-[28px] bg-[#e9e5d8] p-8 md:p-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <span className="inline-flex items-center rounded-full bg-white/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#3d4a2a]">
                Catálogo completo
              </span>
              <h1
                className="mt-5 font-semibold uppercase leading-[0.98] tracking-[-0.02em] text-[#1a1a1a]"
                style={{ fontSize: "clamp(30px,3.4vw,52px)" }}
              >
                {activeCategory || "Todos os produtos"}
              </h1>
              <p className="mt-3 max-w-[420px] text-[13px] leading-relaxed text-[#1a1a1a]/60">
                {filteredProducts.length} {filteredProducts.length === 1 ? "produto encontrado" : "produtos encontrados"} para você
                explorar.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#1a1a1a]/55">
              <Link to={storeHref} className="hover:text-[#3d4a2a]">
                Início
              </Link>
              <ArrowRight size={12} strokeWidth={2} />
              <span className="font-semibold text-[#1a1a1a]">Catálogo</span>
              {activeCategory ? (
                <>
                  <ArrowRight size={12} strokeWidth={2} />
                  <span className="font-semibold text-[#3d4a2a]">{activeCategory}</span>
                </>
              ) : null}
            </div>
          </div>

          {/* BUSCA + ORDENAR */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-5 py-3 shadow-[0_2px_8px_rgba(26,26,26,0.04)]">
              <Search size={15} strokeWidth={2} className="text-[#1a1a1a]/45" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="text"
                placeholder="Buscar no catálogo..."
                className="w-full bg-transparent text-[13px] text-[#1a1a1a] outline-none placeholder:text-[#1a1a1a]/40"
              />
            </div>
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-3 shadow-[0_2px_8px_rgba(26,26,26,0.04)]">
              <SlidersHorizontal size={13} strokeWidth={2} className="text-[#3d4a2a]" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortId)}
                className="bg-transparent text-[12px] font-semibold text-[#1a1a1a] outline-none"
              >
                {SORTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* CATEGORIAS PILLS */}
      {categories.length > 0 ? (
        <section className="px-6 pt-8 md:px-10">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition ${
                !activeCategory
                  ? "bg-[#3d4a2a] text-[#f5f2ea]"
                  : "bg-white text-[#1a1a1a] hover:bg-[#e9e5d8]"
              }`}
            >
              Todos
            </button>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setCategory(category)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition ${
                  activeCategory === category
                    ? "bg-[#3d4a2a] text-[#f5f2ea]"
                    : "bg-white text-[#1a1a1a] hover:bg-[#e9e5d8]"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* GRID DE PRODUTOS */}
      <section className="px-6 py-10 md:px-10 md:py-14">
        {filteredProducts.length === 0 ? (
          <div className="grid place-items-center rounded-[24px] bg-white/60 p-16 text-center">
            <div>
              <h2 className="text-[18px] font-semibold text-[#1a1a1a]">Nenhum produto encontrado</h2>
              <p className="mt-2 text-[13px] text-[#1a1a1a]/60">Tente ajustar a busca ou remover os filtros.</p>
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory("");
                }}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#3d4a2a] px-5 py-2.5 text-[12px] font-semibold text-[#f5f2ea]"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product, idx) => {
              const originalPrice = Math.max(product.price * 1.3, product.price + 30);
              const rating = 4.7 + ((idx % 3) * 0.1);
              return (
                <Link
                  key={product.id}
                  to={slug ? `/loja/${slug}/produto/${product.id}` : "#"}
                  className="group flex flex-col overflow-hidden rounded-[20px] bg-white p-3 transition hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(26,26,26,0.08)]"
                >
                  <div className="relative aspect-square overflow-hidden rounded-[14px] bg-[#e9e5d8]">
                    {idx % 5 === 0 ? (
                      <span className="absolute left-3 top-3 z-10 rounded-full bg-[#c8a24a] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#3d4a2a]">
                        Novidade
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label="Favoritar"
                      className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1a1a1a]/70 shadow-sm transition hover:text-[#3d4a2a]"
                    >
                      <Heart size={14} strokeWidth={1.9} />
                    </button>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[10px] uppercase text-[#1a1a1a]/40">
                        Sem imagem
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-1 flex-col px-1 pb-1">
                    {product.category ? (
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#1a1a1a]/45">
                        {product.category}
                      </span>
                    ) : null}
                    <h3 className="mt-1 line-clamp-2 min-h-[36px] text-[13px] font-semibold leading-snug text-[#1a1a1a]">
                      {product.title}
                    </h3>
                    <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-[#1a1a1a]/60">
                      <Star size={11} strokeWidth={2} className="fill-[#c8a24a] text-[#c8a24a]" />
                      <span>{rating.toFixed(1)}</span>
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <div>
                        <strong className="block text-[15px] font-semibold text-[#1a1a1a]">
                          {formatBRL(product.price)}
                        </strong>
                        <span className="text-[10px] text-[#1a1a1a]/40 line-through">{formatBRL(originalPrice)}</span>
                      </div>
                      <button
                        type="button"
                        aria-label="Adicionar ao carrinho"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          navigate(cartHref);
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3d4a2a] text-[#f5f2ea] shadow-sm transition hover:bg-[#2c3620]"
                      >
                        <Plus size={14} strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* FOOTER MINIMAL */}
      <footer className="border-t border-[#1a1a1a]/8 bg-[#eef0e0] px-6 py-10 md:px-10">
        <div className="flex flex-wrap items-center justify-between gap-4 text-[12px] text-[#1a1a1a]/55">
          <span>
            © {new Date().getFullYear()} {storeName}. Todos os direitos reservados.
          </span>
          <Link to={storeHref} className="font-semibold text-[#3d4a2a] hover:underline">
            Voltar para a loja
          </Link>
        </div>
      </footer>
    </div>
  );
};

export default PublicStoreCatalogPage;
