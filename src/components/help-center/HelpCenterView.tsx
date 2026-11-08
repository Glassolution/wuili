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
          <p className="text-[16px] font-medium">Não conseguimos carregar a Central de Ajuda.</p>
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
        size={20}
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
        className="h-14 w-full border-0 border-b border-[#0D0D0D] bg-transparent pl-9 pr-10 text-[16px] text-[#0D0D0D] outline-none placeholder:text-[#8E8EA0] focus:border-[#2563EB] sm:h-[60px] sm:text-[17px] [&::-webkit-search-cancel-button]:hidden"
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
    <motion.section variants={stagger(0.05)} initial="hidden" animate="show" aria-live="polite" className="mt-10">
      <Breadcrumb basePath={basePath} items={[{ label: "Resultados da busca" }]} />
      <motion.h2 variants={fadeUp} className="mt-6 text-[24px] !font-medium leading-[1.25] tracking-[-0.02em] sm:text-[28px]">
        {results.length === 0
          ? `Nenhum resultado para “${query}”`
          : `${results.length === 1 ? "1 resultado" : `${results.length} resultados`} para “${query}”`}
      </motion.h2>
      {results.length === 0 ? (
        <motion.p variants={fadeUp} className="mt-3 text-[15px] text-[#6E6E80]">
          Tente outras palavras, como “reembolso”, “publicar” ou “Mercado Livre”, ou{" "}
          <Link to={basePath} className="text-[#2563EB] underline underline-offset-4">
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
    return <p className="mt-16 text-center text-[15px] text-[#6E6E80]">Ainda não há artigos publicados.</p>;
  }

  return (
    <motion.ul
      variants={stagger(0.05, 0.05)}
      initial="hidden"
      animate="show"
      className="mt-12 grid gap-x-10 gap-y-10 sm:mt-16 sm:grid-cols-2 sm:gap-y-16 lg:mt-20 lg:grid-cols-3 lg:gap-y-[72px]"
    >
      {tree.map((category) => {
        const Icon = helpCategoryIcon(category.icon, category.slug);
        return (
          <motion.li key={category.id} variants={fadeUp}>
            <Link
              to={`${basePath}/${category.slug}`}
              className="group flex gap-5 rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-4"
            >
              <span className="grid size-14 shrink-0 place-items-center rounded-[10px] bg-[#2563EB] text-white transition-colors group-hover:bg-[#1D4ED8] sm:size-16">
                <Icon size={30} weight="fill" aria-hidden="true" />
              </span>
              <span className="min-w-0 pr-2 pt-0.5">
                <span className="block text-[18px] font-medium leading-[1.3] tracking-[-0.01em] text-[#0D0D0D] group-hover:text-[#2563EB] sm:text-[20px]">
                  {category.title}
                </span>
                {category.description ? (
                  <span className="mt-1.5 block text-[14px] leading-[1.45] text-[#6E6E80] sm:text-[14.5px]">{category.description}</span>
                ) : null}
              </span>
            </Link>
          </motion.li>
        );
      })}
    </motion.ul>
  );
}

/* ── Coleção ────────────────────────────────────────────────────────────────── */

function CategoryPage({ basePath, category }: { basePath: string; category: CategoryWithArticles }) {
  const Icon = helpCategoryIcon(category.icon, category.slug);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [category.id]);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="mt-8 sm:mt-10">
      <Breadcrumb basePath={basePath} items={[{ label: category.title }]} />

      <motion.header variants={fadeUp} className="mt-8 flex flex-col gap-5 sm:mt-10 sm:flex-row sm:items-center sm:gap-7">
        <span className="grid size-16 shrink-0 place-items-center rounded-[12px] bg-[#2563EB] text-white sm:size-[84px]">
          <Icon size={38} weight="fill" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-[26px] !font-medium leading-[1.2] tracking-[-0.02em] sm:text-[32px]">{category.title}</h2>
          {category.description ? (
            <p className="mt-2 text-[15px] leading-[1.5] text-[#6E6E80] sm:text-[16px]">{category.description}</p>
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
      <h2 className="text-[24px] !font-medium">Artigo não encontrado</h2>
      <p className="mt-2 text-[15px] text-[#6E6E80]">Ele pode ter sido removido ou mudado de endereço.</p>
      <Link to={basePath} className="mt-6 inline-flex h-10 items-center rounded-full bg-[#2563EB] px-5 text-[14px] text-white transition-colors hover:bg-[#1D4ED8]">
        Ver todas as coleções
      </Link>
    </div>
  );
}

/** Esqueleto no lugar do spinner: a página já aparece com a forma final. */
function HelpCenterSkeleton() {
  const bar = "rounded-[6px] bg-[#F3F3F3] animate-pulse";
  return (
    <div
      className="mt-12 grid gap-x-10 gap-y-10 sm:mt-16 sm:grid-cols-2 sm:gap-y-16 lg:mt-20 lg:grid-cols-3 lg:gap-y-[72px]"
      role="status"
      aria-label="Carregando a Central de Ajuda"
    >
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <div key={i} className="flex gap-5">
          <div className={`${bar} size-14 shrink-0 rounded-[10px] sm:size-16`} style={{ animationDelay: `${i * 90}ms` }} />
          <div className="flex-1 pt-1">
            <div className={`${bar} h-6 w-2/3`} />
            <div className={`${bar} mt-3 h-4 w-full`} />
            <div className={`${bar} mt-2 h-4 w-4/5`} />
          </div>
        </div>
      ))}
    </div>
  );
}
