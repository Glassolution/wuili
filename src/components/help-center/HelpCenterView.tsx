import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { CornerDownLeft, FileText, Headset, ShieldCheck, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { fetchHelpCenter, helpArticlePath, helpCenterKeys, type HelpArticle, type HelpCategory } from "@/lib/helpCenter";
import HelpArticleContent from "@/components/help-center/HelpArticleContent";
import HelpArticleNote from "@/components/help-center/HelpArticleNote";
import { helpCategoryIcon } from "@/components/help-center/helpCenterIcons";
import { EASE_OUT, fadeIn, fadeUp, stagger } from "@/components/help-center/helpMotion";

/*
  Central de Ajuda: menu lateral por categoria → artigos, cards de acesso rápido
  no topo e o artigo selecionado no centro, sempre fechando com o aviso de
  suporte. Serve tanto a página pública (/ajuda) quanto a versão dentro do
  painel (/dashboard/ajuda) — muda só o `basePath`.

  O desenho segue a referência de propósito: branco, sem moldura, cinzas
  neutros e tipografia contida. O azul da Velo aparece só nos ícones dos cards.
*/

type QuickCard = {
  key: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  to: string;
};

type CategoryWithArticles = HelpCategory & { articles: HelpArticle[] };

const SUPPORT_PATH_LOGGED_IN = "/dashboard/configuracoes?tab=Suporte";

/** Seta triangular cheia do menu (▸ / ▾), como na referência. */
const Caret = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 8 8"
    aria-hidden="true"
    className={cn("mt-[5px] h-2 w-2 shrink-0 fill-[#52525B] transition-transform", open && "rotate-90")}
  >
    <path d="M2 0.8 L6.6 4 L2 7.2 Z" />
  </svg>
);

export default function HelpCenterView({ basePath }: { basePath: string }) {
  const { categorySlug, articleSlug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: helpCenterKeys.public,
    queryFn: () => fetchHelpCenter(),
  });

  // Só entram no menu as categorias com pelo menos um artigo publicado.
  const tree = useMemo<CategoryWithArticles[]>(() => {
    if (!data) return [];
    return data.categories
      .map((category) => ({
        ...category,
        articles: data.articles.filter((article) => article.category_id === category.id),
      }))
      .filter((category) => category.articles.length > 0);
  }, [data]);

  const sections = useMemo(() => {
    const groups: Array<{ label: string; categories: CategoryWithArticles[] }> = [];
    for (const category of tree) {
      const group = groups.find((g) => g.label === category.section);
      if (group) group.categories.push(category);
      else groups.push({ label: category.section, categories: [category] });
    }
    return groups;
  }, [tree]);

  const flatArticles = useMemo(
    () => tree.flatMap((category) => category.articles.map((article) => ({ category, article }))),
    [tree],
  );

  // Sem artigo na URL, abre o primeiro — como a referência, a página nunca fica vazia.
  // null = nenhum artigo publicado; undefined = endereço que não existe.
  const current = useMemo(() => {
    if (!flatArticles.length) return null;
    if (categorySlug) {
      const inCategory = flatArticles.filter((entry) => entry.category.slug === categorySlug);
      if (!inCategory.length) return undefined;
      if (!articleSlug) return inCategory[0];
      return inCategory.find((entry) => entry.article.slug === articleSlug);
    }
    return flatArticles[0];
  }, [flatArticles, categorySlug, articleSlug]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (current) setExpanded((prev) => ({ ...prev, [current.category.id]: true }));
  }, [current]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [categorySlug, articleSlug]);

  const quickCards = useMemo<QuickCard[]>(() => {
    // Todas as categorias viram card: no celular a lista lateral fica escondida
    // atrás de "Todos os artigos", então os cards são o caminho principal.
    const featured = tree
      .filter((category) => category.articles.length > 0)
      .map((category) => ({
        key: category.id,
        label: category.title,
        hint: category.description || `Artigos sobre ${category.title.toLowerCase()}`,
        icon: helpCategoryIcon(category.icon),
        to: helpArticlePath(basePath, category, category.articles[0]),
      }));
    return featured;
  }, [tree, basePath]);

  // Termos e privacidade não são categorias de ajuda: ficam como links discretos.
  const legalLinks = [
    { key: "termos", label: "Termos de serviço", icon: FileText, to: "/termos-de-servico" },
    { key: "privacidade", label: "Privacidade", icon: ShieldCheck, to: "/politica-de-privacidade" },
  ];

  const supportPath = user ? SUPPORT_PATH_LOGGED_IN : "/login";

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(user ? "/dashboard" : "/");
  };

  const nav = (
    <nav aria-label="Artigos da central de ajuda" className="space-y-7">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#71717A]">{section.label}</p>
          <ul>
            {section.categories.map((category) => {
              const isOpen = expanded[category.id] ?? false;
              return (
                <li key={category.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [category.id]: !isOpen }))}
                    aria-expanded={isOpen}
                    className={cn(
                      "flex w-full items-start gap-2.5 py-[5px] text-left text-[13.5px] transition-colors hover:text-[#18181B]",
                      isOpen ? "text-[#71717A]" : "text-[#27272A]",
                    )}
                  >
                    <Caret open={isOpen} />
                    <span className="min-w-0 leading-[1.35]">{category.title}</span>
                  </button>
                  <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.ul
                      key="artigos"
                      className="overflow-hidden"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: EASE_OUT }}
                    >
                      {category.articles.map((article) => {
                        const active = current?.article.id === article.id;
                        return (
                          <li key={article.id}>
                            <Link
                              to={helpArticlePath(basePath, category, article)}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "block py-[5px] pl-[18px] text-[13.5px] leading-[1.4] transition-[color,transform] duration-200 hover:translate-x-0.5",
                                active ? "text-[#09090B]" : "text-[#8A8A93] hover:text-[#27272A]",
                              )}
                            >
                              {article.title}
                            </Link>
                          </li>
                        );
                      })}
                      <li aria-hidden="true" className="h-1.5" />
                    </motion.ul>
                  ) : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  if (isLoading) {
    return (
      <HelpCenterSkeleton />
    );
  }

  if (isError) {
    return (
      <div className="mx-auto flex min-h-[320px] max-w-md flex-col items-center justify-center text-center">
        <p className="text-[15px] font-medium text-[#18181B]">Não conseguimos carregar a central de ajuda.</p>
        <p className="mt-1 text-[13.5px] text-[#71717A]">Verifique sua conexão e tente de novo.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 h-8 rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-[13px] text-[#18181B] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#FAFAFA]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  // Com um artigo (ou categoria) na URL, abre a página de leitura completa.
  // Sem nada, fica o índice: menu, cards e a prévia do primeiro artigo.
  if (categorySlug) {
    if (!current) {
      return (
        <div className="mx-auto max-w-[760px] py-16 text-center">
          <h1 className="text-[22px] !font-medium text-[#0F172A]">Artigo não encontrado</h1>
          <p className="mt-2 text-[15px] text-[#3F4652]">Ele pode ter sido removido ou mudado de endereço.</p>
          <Link
            to={basePath}
            className="mt-6 inline-flex h-8 items-center gap-2 rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-[13px] text-[#18181B] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-[#FAFAFA]"
          >
            <CornerDownLeft size={14} aria-hidden="true" /> Central de ajuda
          </Link>
        </div>
      );
    }
    const siblings = tree.find((category) => category.id === current.category.id)?.articles ?? [];
    return (
      <HelpArticleNote
        key={current.article.id}
        basePath={basePath}
        category={current.category}
        article={current.article}
        related={siblings.filter((article) => article.id !== current.article.id)}
        supportPath={supportPath}
      />
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex gap-12 xl:gap-14">
      <motion.aside
        className="hidden w-[200px] shrink-0 lg:block"
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT, delay: 0.1 }}
      >
        <div className="sticky top-0 max-h-screen overflow-y-auto pb-8 pt-[26px]">{nav}</div>
      </motion.aside>

      <motion.div className="min-w-0 max-w-[920px] flex-1 text-[#18181B]" variants={stagger(0.07)} initial="hidden" animate="show">
        <motion.div variants={fadeUp} className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-[13px] text-[#18181B] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#FAFAFA]"
          >
            <CornerDownLeft size={14} strokeWidth={2} aria-hidden="true" />
            Voltar
          </button>
          <button
            type="button"
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-expanded={mobileNavOpen}
            className="inline-flex h-8 items-center rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-[13px] text-[#18181B] shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:hidden"
          >
            Todos os artigos
          </button>
        </motion.div>

        <AnimatePresence initial={false}>
          {mobileNavOpen ? (
            <motion.div
              key="menu-celular"
              className="overflow-hidden lg:hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
            >
              <div className="mt-4 border-b border-[#E4E4E7] pb-5">{nav}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.h1 variants={fadeUp} className="mt-5 text-[28px] !font-semibold leading-[1.2] tracking-[-0.02em] text-[#09090B] sm:text-[30px]">
          Central de Ajuda
        </motion.h1>
        <motion.p variants={fadeUp} className="mt-2.5 text-[15px] text-[#3F3F46]">
          Bem-vindo à central de ajuda da Velo — o lugar para{" "}
          <span className="font-medium text-[#09090B]">aprender & tirar dúvidas</span>.
        </motion.p>

        {/* Grade fixa (2 colunas no celular, 3 no desktop) para as 6 categorias fecharem sem buraco.
            A descrição fica no próprio card: no celular não existe tooltip de hover. */}
        <motion.div variants={stagger(0.05)} className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
          {quickCards.map((card) => (
            <motion.div
              key={card.key}
              variants={fadeUp}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
            >
              <Link
                to={card.to}
                className="group flex h-full flex-col gap-2.5 rounded-[8px] border border-[#E4E4E7] bg-[#F4F4F5] px-3.5 py-3 transition-[background-color,border-color,box-shadow] duration-200 hover:border-[#D4D4D8] hover:bg-[#EFEFF1] hover:shadow-[0_6px_16px_-8px_rgba(15,23,42,0.18)] sm:px-4 sm:py-3.5"
              >
                <card.icon
                  size={19}
                  strokeWidth={1.9}
                  aria-hidden="true"
                  className="text-[#2563EB] transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:scale-110"
                />
                <span>
                  <span className="block text-[14px] font-medium leading-[1.25] tracking-[-0.01em] text-[#18181B] sm:text-[14.5px]">
                    {card.label}
                  </span>
                  <span className="mt-1 line-clamp-2 text-[12px] leading-[1.4] text-[#71717A]">{card.hint}</span>
                </span>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={fadeUp} className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-[#71717A]">
          {legalLinks.map((link) => (
            <Link key={link.key} to={link.to} className="inline-flex items-center gap-1.5 transition-colors hover:text-[#18181B]">
              <link.icon size={13} strokeWidth={1.9} aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </motion.div>

        <motion.hr
          variants={{ hidden: { scaleX: 0, opacity: 0 }, show: { scaleX: 1, opacity: 1, transition: { duration: 0.6, ease: EASE_OUT } } }}
          className="my-7 origin-left border-[#E4E4E7]"
        />

        {current ? (
          <motion.article variants={fadeIn}>
            <h2 className="text-[17px] !font-medium tracking-[-0.01em] text-[#09090B]">{current.category.title}</h2>
            {current.category.description ? (
              <p className="mt-2 text-[13.5px] leading-[1.6] text-[#3F3F46]">{current.category.description}</p>
            ) : null}

            <h3 className="mt-7 text-[17px] !font-medium tracking-[-0.01em] text-[#09090B]">{current.article.title}</h3>
            {current.article.summary ? (
              <p className="mt-2 text-[13.5px] leading-[1.6] text-[#3F3F46]">{current.article.summary}</p>
            ) : null}
            <HelpArticleContent markdown={current.article.content} />

            <SupportNotice to={supportPath} />
          </motion.article>
        ) : (
          <motion.section variants={fadeIn}>
            <h2 className="text-[17px] !font-medium text-[#09090B]">
              {current === undefined ? "Artigo não encontrado" : "Ainda não há artigos publicados"}
            </h2>
            <p className="mt-2 text-[13.5px] text-[#3F3F46]">
              {current === undefined ? (
                <>
                  Ele pode ter sido removido ou mudado de endereço.{" "}
                  <Link to={basePath} className="text-[#09090B] underline underline-offset-2">
                    Voltar ao início da central
                  </Link>
                  .
                </>
              ) : (
                "Enquanto isso, nosso time responde pelo suporte."
              )}
            </p>
            <SupportNotice to={supportPath} />
          </motion.section>
        )}
      </motion.div>
    </div>
    </MotionConfig>
  );
}

/** Esqueleto no lugar do spinner: a página já aparece com a forma final. */
function HelpCenterSkeleton() {
  const bar = "rounded-[4px] bg-[#F1F1F3] animate-pulse";
  return (
    <div className="flex gap-12 xl:gap-14" role="status" aria-label="Carregando a central de ajuda">
      <div className="hidden w-[200px] shrink-0 space-y-3 pt-[26px] lg:block">
        <div className={cn(bar, "h-3 w-24")} />
        {[140, 170, 150, 120].map((w) => (
          <div key={w} className={cn(bar, "h-3.5")} style={{ width: w }} />
        ))}
      </div>
      <div className="min-w-0 max-w-[920px] flex-1">
        <div className={cn(bar, "h-8 w-20")} />
        <div className={cn(bar, "mt-5 h-8 w-64")} />
        <div className={cn(bar, "mt-3 h-4 w-96 max-w-full")} />
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={cn(bar, "h-[112px]")} style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
        <div className="my-7 h-px bg-[#E4E4E7]" />
        <div className={cn(bar, "h-5 w-48")} />
        <div className={cn(bar, "mt-3 h-3.5 w-full")} />
        <div className={cn(bar, "mt-2 h-3.5 w-4/5")} />
      </div>
    </div>
  );
}

function SupportNotice({ to }: { to: string }) {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-[6px] border border-[#E4E4E7] bg-[#F4F4F5] px-3.5 py-2.5 text-[13.5px] text-[#3F3F46]">
      <Headset size={17} strokeWidth={1.9} aria-hidden="true" className="shrink-0 text-[#18181B]" />
      <p>
        Ainda com dúvida ou algo não funcionou como descrito? Fale com o nosso{" "}
        <Link to={to} className="font-medium text-[#09090B] hover:underline hover:underline-offset-2">
          Suporte
        </Link>
        .
      </p>
    </div>
  );
}
