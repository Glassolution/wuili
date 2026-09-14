// Catálogo público — Template 2 (estilo MARKETLY, azul/branco, mobile-first).
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, Heart, Loader2, Search, ShoppingCart, SlidersHorizontal, Star, User } from "lucide-react";
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

const PublicStoreCatalogPage2 = () => {
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
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [slug]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const filtered = useMemo(() => {
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

  const setCategory = (c: string) => {
    const next = new URLSearchParams(searchParams);
    if (c) next.set("categoria", c); else next.delete("categoria");
    setSearchParams(next, { replace: true });
  };

  const storeName = project ? getProjectStoreName(project) || project.nome : "Loja";
  const logoImage = project ? getProjectLogoImage(project) : null;
  const storeHref = slug ? `/loja/${slug}` : "/";
  const cartHref = slug ? `/loja/${slug}/carrinho` : "/carrinho";

  if (loading) {
    return <div className="grid min-h-screen place-items-center bg-white"><Loader2 className="animate-spin text-[#2563EB]" /></div>;
  }
  if (!project) {
    return <div className="grid min-h-screen place-items-center bg-white p-6 text-center"><div><h1 className="text-[20px] font-bold text-[#0F172A]">Loja não encontrada</h1></div></div>;
  }

  return (
    <div className="min-h-screen bg-white text-[#0F172A]" style={{ fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-white">
        <div className="flex items-center gap-3 px-4 py-3 md:px-8">
          <button onClick={() => navigate(storeHref)} aria-label="Voltar" className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F1F5F9]">
            <ChevronLeft size={20} strokeWidth={2} />
          </button>
          <Link to={storeHref} className="flex min-w-0 items-center gap-2">
            {logoImage ? (
              <img src={logoImage} alt={storeName} className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#2563EB] text-white"><ShoppingCart size={17} strokeWidth={2.4} /></span>
            )}
            <span className="truncate text-[16px] font-bold text-[#0F172A]">{storeName}</span>
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <Link to={slug ? `/loja/${slug}/conta` : "#"} aria-label="Conta" className="grid h-10 w-10 place-items-center rounded-full hover:bg-[#F1F5F9]">
              <User size={19} strokeWidth={1.9} />
            </Link>
            <Link to={cartHref} aria-label="Carrinho" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-[#F1F5F9]">
              <ShoppingCart size={19} strokeWidth={1.9} />
              <span className="absolute right-1 top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-[#F97316] px-1 text-[9px] font-bold text-white">3</span>
            </Link>
          </div>
        </div>
        <div className="px-4 pb-3 md:px-8">
          <div className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5 focus-within:border-[#2563EB]">
            <Search size={16} strokeWidth={2} className="text-[#64748B]" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar no catálogo..." className="flex-1 border-none bg-transparent text-[13px] outline-none placeholder:text-[#94A3B8]" />
          </div>
        </div>
      </header>

      {/* PAGE HEADER */}
      <section className="px-4 pt-4 md:px-8">
        <div className="flex items-center gap-2 text-[11px] text-[#64748B]">
          <Link to={storeHref} className="hover:text-[#2563EB]">Início</Link>
          <ChevronRight size={11} />
          <span className="font-semibold text-[#0F172A]">Catálogo</span>
          {activeCategory ? <><ChevronRight size={11} /><span className="font-semibold text-[#2563EB]">{activeCategory}</span></> : null}
        </div>
        <h1 className="mt-2 text-[22px] font-bold tracking-tight text-[#0F172A] md:text-[28px]">
          {activeCategory || "Todos os produtos"}
        </h1>
        <p className="mt-1 text-[12px] text-[#64748B]">{filtered.length} {filtered.length === 1 ? "produto" : "produtos"} encontrados</p>
      </section>

      {/* CATEGORY PILLS */}
      {categories.length > 0 ? (
        <section className="px-4 pt-4 md:px-8">
          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => setCategory("")} className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold transition ${!activeCategory ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#2563EB]"}`}>
              Todos
            </button>
            {categories.map((c) => (
              <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-full px-4 py-2 text-[12px] font-semibold transition ${activeCategory === c ? "bg-[#2563EB] text-white" : "border border-[#E2E8F0] bg-white text-[#0F172A] hover:border-[#2563EB]"}`}>
                {c}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* SORT/FILTER BAR */}
      <section className="sticky top-[112px] z-20 mt-4 flex items-center justify-between gap-3 border-y border-[#E2E8F0] bg-white/95 px-4 py-2.5 backdrop-blur md:px-8">
        <button className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0F172A]">
          <Filter size={12} strokeWidth={2.2} /> Filtros
        </button>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#0F172A]">
          <SlidersHorizontal size={12} strokeWidth={2.2} />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortId)} className="bg-transparent outline-none">
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </section>

      {/* GRID */}
      <section className="px-4 py-6 md:px-8">
        {filtered.length === 0 ? (
          <div className="grid place-items-center rounded-2xl bg-[#F8FAFC] p-12 text-center">
            <div>
              <h2 className="text-[16px] font-bold text-[#0F172A]">Nenhum produto encontrado</h2>
              <p className="mt-1 text-[12px] text-[#64748B]">Ajuste a busca ou remova os filtros.</p>
              <button onClick={() => { setQuery(""); setCategory(""); }} className="mt-4 rounded-full bg-[#2563EB] px-4 py-2 text-[12px] font-semibold text-white">Limpar filtros</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((p, idx) => {
              const oldPrice = p.originalPrice && p.originalPrice > p.price ? p.originalPrice : Math.max(p.price * 1.3, p.price + 30);
              const disc = Math.round((1 - p.price / oldPrice) * 100);
              const rating = 4.3 + ((idx % 4) * 0.15);
              return (
                <Link key={p.id} to={slug ? `/loja/${slug}/produto/${p.id}` : "#"} className="group overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition hover:border-[#2563EB]/30 hover:shadow-lg">
                  <div className="relative aspect-square bg-[#F8FAFC]">
                    {disc > 0 ? <span className="absolute left-2 top-2 z-10 rounded-md bg-[#EF4444] px-1.5 py-0.5 text-[10px] font-bold text-white">-{disc}%</span> : null}
                    <button aria-label="Favoritar" onClick={(e) => e.preventDefault()} className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-white/95 text-[#0F172A] shadow-sm hover:text-[#EF4444]">
                      <Heart size={13} strokeWidth={1.9} />
                    </button>
                    {p.imageUrl ? <img src={p.imageUrl} alt={p.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full w-full place-items-center text-[10px] uppercase text-[#94A3B8]">Sem imagem</div>}
                  </div>
                  <div className="p-3">
                    {p.category ? <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#94A3B8]">{p.category}</span> : null}
                    <h3 className="mt-0.5 line-clamp-2 min-h-[34px] text-[12px] font-semibold leading-snug text-[#0F172A]">{p.title}</h3>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-[#64748B]">
                      <Star size={10} strokeWidth={2} className="fill-[#F59E0B] text-[#F59E0B]" />
                      <span>{rating.toFixed(1)}</span>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-1">
                      <div>
                        <strong className="block text-[14px] font-bold text-[#2563EB]">{formatBRL(p.price)}</strong>
                        <span className="text-[10px] text-[#94A3B8] line-through">{formatBRL(oldPrice)}</span>
                      </div>
                      <button aria-label="Adicionar" onClick={(e) => { e.preventDefault(); navigate(cartHref); }} className="grid h-8 w-8 place-items-center rounded-lg bg-[#2563EB] text-white shadow-sm hover:bg-[#1D4ED8]">
                        <ShoppingCart size={13} strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-4 py-6 text-center text-[11px] text-[#94A3B8] md:px-8">
        © {new Date().getFullYear()} {storeName} · Todos os direitos reservados
      </footer>
    </div>
  );
};

export default PublicStoreCatalogPage2;
