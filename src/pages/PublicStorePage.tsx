import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Heart, Loader2, Search, ShieldCheck, ShoppingBag, Truck, UserCircle } from "lucide-react";
import {
  fetchPublicProject,
  fetchPublicStoreProducts,
  getProjectDescription,
  getProjectProductIds,
  type PublicStoreProduct,
  type UserProject,
} from "@/lib/userProjects";
import PreviewPage from "@/pages/PreviewPage";

const formatBRL = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const PublicStoreView = ({ project }: { project: UserProject }) => {
  const [products, setProducts] = useState<PublicStoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const description = getProjectDescription(project);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const list = await fetchPublicStoreProducts(getProjectProductIds(project));
        if (active) setProducts(list);
      } catch {
        if (active) setProducts([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [project]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => product.title.toLowerCase().includes(term));
  }, [products, search]);

  const brandInitial = project.nome.trim().charAt(0).toUpperCase() || "V";

  return (
    <main className="min-h-screen bg-white text-[#111827]">
      <header className="border-b border-[#eceef2] bg-white">
        <div className="mx-auto flex min-h-[68px] max-w-[1120px] items-center gap-4 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1E3A8A] text-[13px] font-bold text-white">
              {brandInitial}
            </span>
            <span className="min-w-0 leading-none">
              <strong className="block truncate text-[18px] font-semibold tracking-[-0.03em]">{project.nome}</strong>
              <span className="mt-1 block truncate text-[10px] font-medium text-[#6b7280]">Escolhas para você.</span>
            </span>
          </div>

          <form
            onSubmit={(event) => event.preventDefault()}
            className="ml-auto hidden h-10 w-[min(40vw,420px)] items-center overflow-hidden rounded-[10px] border border-[#e2e5ea] bg-[#f8fafc] md:flex"
          >
            <label className="flex min-w-0 flex-1 items-center gap-2 px-3">
              <Search size={15} className="shrink-0 text-[#94a3b8]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produtos, marcas e mais..."
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-[#94a3b8]"
              />
            </label>
            <span className="flex h-full w-11 items-center justify-center bg-[#2563EB] text-white">
              <Search size={16} />
            </span>
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-0">
            <button type="button" className="inline-flex h-9 items-center gap-2 rounded-full bg-[#eef2ff] px-3 text-[12px] font-semibold text-[#2563EB]" title="Favoritos em breve">
              <span className="hidden sm:inline">Favoritos</span>
              <Heart size={15} />
            </button>
            <button type="button" className="inline-flex h-9 items-center gap-2 rounded-full bg-[#eef2ff] px-3 text-[12px] font-semibold text-[#2563EB]" title="Carrinho em breve">
              <span className="hidden sm:inline">Carrinho</span>
              <ShoppingBag size={15} />
            </button>
            <button type="button" aria-label="Perfil" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e2e5ea] text-[#6b7280]">
              <UserCircle size={19} />
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1120px] px-5 pt-6">
        <div className="overflow-hidden rounded-[20px] bg-gradient-to-br from-[#152449] via-[#1E3A8A] to-[#2563EB] px-8 py-12 text-white sm:px-12 sm:py-16">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">Loja oficial</p>
          <h1 className="mt-3 max-w-[560px] text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] sm:text-[40px]">
            {project.nome}
          </h1>
          {description ? (
            <p className="mt-4 max-w-[520px] text-[14px] leading-6 text-white/75">{description}</p>
          ) : (
            <p className="mt-4 max-w-[520px] text-[14px] leading-6 text-white/75">
              Praticidade e qualidade no dia a dia. Confira nossas escolhas.
            </p>
          )}
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] font-medium text-white/70">
            <span className="flex items-center gap-1.5"><Truck size={15} /> Envio para todo o Brasil</span>
            <span className="flex items-center gap-1.5"><ShieldCheck size={15} /> Compra garantida</span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-10">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Produtos em destaque</h2>
          <span className="text-[12px] font-semibold text-[#6b7280]">{filtered.length} itens</span>
        </div>

        {loading ? (
          <div className="flex h-56 items-center justify-center gap-2 text-[13px] font-semibold text-[#6b7280]">
            <Loader2 size={18} className="animate-spin" /> Carregando produtos...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-56 flex-col items-center justify-center rounded-[16px] border border-dashed border-[#e2e5ea] text-center text-[#6b7280]">
            <ShoppingBag size={30} />
            <p className="mt-3 text-[14px] font-semibold">Nenhum produto disponível ainda</p>
            <p className="mt-1 text-[12px]">Os produtos aparecem aqui assim que forem adicionados à loja.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {filtered.map((product) => (
              <article
                key={product.id}
                className="group overflow-hidden rounded-[14px] border border-[#eceef2] bg-white transition hover:shadow-[0_16px_40px_rgba(15,23,42,0.10)]"
              >
                <div className="aspect-square w-full overflow-hidden bg-[#f4f6fa]">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#cbd5e1]">
                      <ShoppingBag size={26} />
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  {product.category ? (
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#94a3b8]">{product.category}</p>
                  ) : null}
                  <h3 className="mt-1 line-clamp-2 text-[13px] font-semibold leading-5 text-[#1f2937]">{product.title}</h3>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-[15px] font-bold text-[#111827]">{formatBRL(product.price)}</span>
                    {product.originalPrice && product.originalPrice > product.price ? (
                      <span className="text-[11px] text-[#9ca3af] line-through">{formatBRL(product.originalPrice)}</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="mt-3 h-9 w-full rounded-[9px] bg-[#1E3A8A] text-[12px] font-semibold text-white transition hover:bg-[#2563EB]"
                  >
                    Comprar agora
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-[#eceef2] bg-[#fafbfc]">
        <div className="mx-auto flex max-w-[1120px] flex-col items-center gap-2 px-5 py-8 text-center">
          <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[#1E3A8A] text-[12px] font-bold text-white">{brandInitial}</span>
          <p className="text-[13px] font-semibold">{project.nome}</p>
          <p className="text-[11px] text-[#94a3b8]">
            Feito com <Link to="/" className="font-semibold text-[#2563EB]">Velo</Link>
          </p>
        </div>
      </footer>
    </main>
  );
};

const PublicStorePage = () => {
  const { slug } = useParams();
  const [project, setProject] = useState<UserProject | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!slug) {
      setResolved(true);
      return;
    }
    let active = true;
    setResolved(false);
    void (async () => {
      try {
        const found = await fetchPublicProject(slug);
        if (active) setProject(found);
      } catch {
        if (active) setProject(null);
      } finally {
        if (active) setResolved(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  if (!resolved) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Loader2 className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (project) {
    return <PublicStoreView project={project} />;
  }

  // Sem projeto publicado com esse slug: cai no renderizador de páginas de venda legado.
  return <PreviewPage />;
};

export default PublicStorePage;
