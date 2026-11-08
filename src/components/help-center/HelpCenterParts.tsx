import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { helpArticlePath, type HelpArticle, type HelpCategory } from "@/lib/helpCenter";
import { fadeUp } from "@/components/help-center/helpMotion";

/* Peças usadas pela central e pela página do artigo. */

export function Breadcrumb({ basePath, items }: { basePath: string; items: { label: string; to?: string }[] }) {
  return (
    <motion.nav variants={fadeUp} aria-label="Você está em" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-[#6E6E80]">
      <Link to={basePath} className="hover:text-[#0D0D0D]">
        Todas as coleções
      </Link>
      {items.map((item, index) => (
        <span key={index} className="flex items-center gap-2">
          <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
          {item.to ? (
            <Link to={item.to} className="hover:text-[#0D0D0D]">
              {item.label}
            </Link>
          ) : (
            <span className="text-[#0D0D0D]">{item.label}</span>
          )}
        </span>
      ))}
    </motion.nav>
  );
}

/** Lista de artigos num cartão com borda: título, resumo e seta em cada linha. */
export function ArticleList({
  basePath,
  rows,
  showCategory = false,
  className = "mt-8 sm:mt-10",
}: {
  basePath: string;
  rows: { article: HelpArticle; category: HelpCategory }[];
  showCategory?: boolean;
  className?: string;
}) {
  return (
    <ul className={`overflow-hidden rounded-[12px] border border-[#E5E5E5] ${className}`}>
      {rows.map(({ article, category }) => (
        <li key={article.id} className="border-t border-[#E5E5E5] first:border-t-0">
          <Link
            to={helpArticlePath(basePath, category, article)}
            className="group flex items-center justify-between gap-5 px-5 py-4 transition-colors hover:bg-[#F7F9FE] sm:px-6 sm:py-5"
          >
            <span className="min-w-0">
              {showCategory ? <span className="mb-0.5 block text-[12.5px] text-[#6E6E80]">{category.title}</span> : null}
              <span className="block text-[15.5px] font-medium leading-[1.4] text-[#0D0D0D] group-hover:text-[#2563EB] sm:text-[16px]">{article.title}</span>
              {article.summary ? (
                <span className="mt-1 line-clamp-2 block text-[14px] leading-[1.5] text-[#6E6E80]">{article.summary}</span>
              ) : null}
            </span>
            <ChevronRight
              size={18}
              strokeWidth={1.8}
              aria-hidden="true"
              className="shrink-0 text-[#8E8EA0] transition-[color,transform] duration-200 group-hover:translate-x-1 group-hover:text-[#2563EB]"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
