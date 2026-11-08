import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MotionConfig, motion } from "framer-motion";
import { Search, X } from "lucide-react";
import { fetchHelpCenter, helpCenterKeys, type HelpArticle, type HelpCategory } from "@/lib/helpCenter";
import { searchHelpArticles } from "@/lib/helpCenterSearch";
import HelpArticleNote from "@/components/help-center/HelpArticleNote";
import { ArticleList, Breadcrumb } from "@/components/help-center/HelpCenterParts";
import { helpCategoryIcon } from "@/components/help-center/helpCenterIcons";
import { fadeUp, stagger } from "@/components/help-center/helpMotion";

/*
  Central de Ajuda (/ajuda). Quatro telas, todas pela URL:

  - /ajuda                         início: busca e grade de coleções;
  - /ajuda?busca=termo             resultados da busca;
  - /ajuda/:categoria              lista de artigos da coleção;
  - /ajuda/:categoria/:artigo      leitura do artigo.

  Todas abrem com a mesma busca sublinhada no topo. Visual branco, texto quase
  preto e ícones em quadrados pretos; a central não aparece em nenhum menu do
  app e não é indexada (ver HelpCenterPage).
*/

type CategoryWithArticles = HelpCategory & { articles: HelpArticle[] };

export default function HelpCenterView({ basePath, supportPath }: { basePath: string; supportPath: string }) {
  const { categorySlug, articleSlug } = useParams();
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("busca") ?? "").trim();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: helpCenterKeys.public,
    queryFn: () => fetchHelpCenter(),
  });

  // Só aparecem as coleções com pelo menos um artigo publicado.
  const tree = useMemo<CategoryWithArticles[]>(() => {
    if (!data) return [];
    return data.categories
      .map((category) => ({
        ...category,
        articles: data.articles.filter((article) => article.category_id === category.id),
      }))
      .filter((category) => category.articles.length > 0);
  }, [data]);

  const page = (() => {
    if (isLoading) return <HelpCenterSkeleton />;

    if (isError) {
      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
          <p className="text-[18px] font-medium">Não conseguimos carregar a Central de Ajuda.</p>
          <p className="mt-1 text-[15px] text-[#6E6E80]">Verifique sua conexão e tente de novo.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-5 h-10 rounded-full bg-[#F3F3F3] px-5 text-[15px] transition hover:bg-[#E8E8E8]"
          >
            Tentar novamente
          </button>
        </div>
      );
    }

    if (categorySlug) {
      const category = tree.find((c) => c.slug === categorySlug);
      if (!category) return <NotFound basePath={basePath} />;

      if (!articleSlug) return <CategoryPage basePath={basePath} category={category} />;

      const article = category.articles.find((a) => a.slug === articleSlug);
      if (!article) return <NotFound basePath={basePath} />;
      return (
        <HelpArticleNote
          key={article.id}
          basePath={basePath}
          category={category}
          article={article}
          related={category.articles.filter((a) => a.id !== article.id)}
          supportPath={supportPath}
        />
      );
    }

    if (query) return <SearchResults basePath={basePath} tree={tree} query={query} />;
    return <HomePage basePath={basePath} tree={tree} />;
  })();

  return (
    <MotionConfig reducedMotion="user">
      <h1 className="sr-only">Central de Ajuda da Velo</h1>
      <SearchBox basePath={basePath} initial={query} />
      {page}
    </MotionConfig>
  );
}

/* ── Busca ──────────────────────────────────────────────────────────────────── */

function SearchBox({ basePath, initial }: { basePath: string; initial: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const term = value.trim();
    navigate(term ? `${basePath}?busca=${encodeURIComponent(term)}` : basePath);
  };

  return (
    <form role="search" onSubmit={submit} className="relative">
      <label htmlFor="busca-ajuda" className="sr-only">
        Buscar artigos
      </label>
      <Search
        size={24}
        strokeWidth={1.8}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-[#0D0D0D]"
      />
      <input
        id="busca-ajuda"
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar artigos…"
        className="h-[68px] w-full border-0 border-b border-[#0D0D0D] bg-transparent pl-11 pr-10 text-[19px] text-[#0D0D0D] outline-none placeholder:text-[#8E8EA0] focus:border-b-2 sm:h-[76px] sm:text-[21px] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            navigate(basePath);
          }}
          aria-label="Limpar busca"
          className="absolute right-0 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-[#6E6E80] hover:bg-[#F3F3F3]"
        >
          <X size={18} aria-hidden="true" />
        </button>
      ) : null}
    </form>
  );
}

function SearchResults({ basePath, tree, query }: { basePath: string; tree: CategoryWithArticles[]; query: string }) {
  const entries = useMemo(
    () => tree.flatMap((category) => category.articles.map((article) => ({ article, category }))),
    [tree],
  );
  const results = useMemo(() => searchHelpArticles(entries, query), [entries, query]);

  return (
    <motion.section variants={stagger(0.05)} initial="hidden" animate="show" aria-live="polite" className="mx-auto mt-12 max-w-[1100px]">
      <Breadcrumb basePath={basePath} items={[{ label: "Resultados da busca" }]} />
      <motion.h2 variants={fadeUp} className="mt-8 text-[30px] !font-medium leading-[1.2] tracking-[-0.02em] sm:text-[38px]">
        {results.length === 0
          ? `Nenhum resultado para “${query}”`
          : `${results.length === 1 ? "1 resultado" : `${results.length} resultados`} para “${query}”`}
      </motion.h2>
      {results.length === 0 ? (
        <motion.p variants={fadeUp} className="mt-3 text-[18px] text-[#6E6E80]">
          Tente outras palavras, como “reembolso”, “publicar” ou “Mercado Livre”, ou{" "}
          <Link to={basePath} className="text-[#0D0D0D] underline underline-offset-4">
            veja todas as coleções
          </Link>
          .
        </motion.p>
      ) : (
        <motion.div variants={fadeUp}>
          <ArticleList basePath={basePath} rows={results} showCategory />
        </motion.div>
      )}
    </motion.section>
  );
}

/* ── Início ─────────────────────────────────────────────────────────────────── */

function HomePage({ basePath, tree }: { basePath: string; tree: CategoryWithArticles[] }) {
  if (tree.length === 0) {
    return <p className="mt-20 text-center text-[17px] text-[#6E6E80]">Ainda não há artigos publicados.</p>;
  }

  return (
    <motion.ul
      variants={stagger(0.05, 0.05)}
      initial="hidden"
      animate="show"
      className="mt-14 grid gap-x-12 gap-y-14 sm:mt-20 sm:grid-cols-2 sm:gap-y-20 lg:grid-cols-3 lg:gap-y-24"
    >
      {tree.map((category) => {
        const Icon = helpCategoryIcon(category.icon);
        return (
          <motion.li key={category.id} variants={fadeUp}>
            <Link
              to={`${basePath}/${category.slug}`}
              className="group block rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[#0D0D0D] focus-visible:ring-offset-8"
            >
              <span className="grid size-[76px] place-items-center rounded-[10px] bg-[#0D0D0D] text-white sm:size-[88px]">
                <Icon size={36} strokeWidth={1.6} aria-hidden="true" />
              </span>
              <span className="mt-6 block text-[23px] font-medium leading-[1.25] tracking-[-0.015em] text-[#0D0D0D] group-hover:underline group-hover:underline-offset-4 sm:text-[26px]">
                {category.title}
              </span>
              {category.description ? (
                <span className="mt-2 block text-[17px] leading-[1.5] text-[#6E6E80] sm:text-[18px]">{category.description}</span>
              ) : null}
            </Link>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

/* ── Coleção ────────────────────────────────────────────────────────────────── */

function CategoryPage({ basePath, category }: { basePath: string; category: CategoryWithArticles }) {
  const Icon = helpCategoryIcon(category.icon);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [category.id]);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="mx-auto mt-10 max-w-[1100px] sm:mt-12">
      <Breadcrumb basePath={basePath} items={[{ label: category.title }]} />

      <motion.header variants={fadeUp} className="mt-10 flex flex-col gap-6 sm:mt-14 sm:flex-row sm:items-center sm:gap-10">
        <span className="grid size-[96px] shrink-0 place-items-center rounded-[14px] bg-[#0D0D0D] text-white sm:size-[132px]">
          <Icon size={52} strokeWidth={1.5} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[34px] !font-medium leading-[1.15] tracking-[-0.025em] sm:text-[44px]">{category.title}</h2>
          {category.description ? (
            <p className="mt-3 text-[18px] leading-[1.5] text-[#6E6E80] sm:text-[20px]">{category.description}</p>
          ) : null}
        </div>
      </motion.header>

      <motion.div variants={fadeUp}>
        <ArticleList basePath={basePath} rows={category.articles.map((article) => ({ article, category }))} />
      </motion.div>
    </motion.div>
  );
}

/* ── Estados ────────────────────────────────────────────────────────────────── */

function NotFound({ basePath }: { basePath: string }) {
  return (
    <div className="mx-auto max-w-[640px] py-20 text-center">
      <h2 className="text-[28px] !font-medium">Artigo não encontrado</h2>
      <p className="mt-2 text-[17px] text-[#6E6E80]">Ele pode ter sido removido ou mudado de endereço.</p>
      <Link to={basePath} className="mt-6 inline-flex h-11 items-center rounded-full bg-[#0D0D0D] px-6 text-[15px] text-white hover:opacity-85">
        Ver todas as coleções
      </Link>
    </div>
  );
}

/** Esqueleto no lugar do spinner: a página já aparece com a forma final. */
function HelpCenterSkeleton() {
  const bar = "rounded-[6px] bg-[#F3F3F3] animate-pulse";
  return (
    <div className="mt-20 grid gap-x-12 gap-y-20 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Carregando a Central de Ajuda">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={{ animationDelay: `${i * 90}ms` }}>
          <div className={`${bar} size-[88px] rounded-[10px]`} />
          <div className={`${bar} mt-6 h-6 w-2/3`} />
          <div className={`${bar} mt-3 h-4 w-full`} />
          <div className={`${bar} mt-2 h-4 w-4/5`} />
        </div>
      ))}
    </div>
  );
}
