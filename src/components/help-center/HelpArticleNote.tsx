import { Fragment, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { type HelpArticle, type HelpCategory } from "@/lib/helpCenter";
import HelpArticleContent from "@/components/help-center/HelpArticleContent";
import { articleOutline } from "@/lib/helpArticleOutline";
import RefundChatLink from "@/components/help-center/RefundChatLink";
import { ArticleList, Breadcrumb } from "@/components/help-center/HelpCenterParts";
import { fadeUp, stagger } from "@/components/help-center/helpMotion";

/*
  Página de leitura de um artigo: trilha de três níveis, título e resumo à
  esquerda, "Atualizado há X", o texto numa coluna larga e, no desktop, um
  sumário fixo à direita montado a partir dos títulos ## e ### do Markdown.
*/

/**
 * Marcadores que o artigo (Markdown no banco) usa para encaixar um bloco
 * interativo, sozinhos numa linha. O admin edita o texto em volta à vontade.
 */
const EMBEDS: Record<string, () => JSX.Element> = {
  "atendimento-reembolso": () => <RefundChatLink />,
  // Marcador antigo (o formulário dentro do artigo virou o atendimento em /ajuda/reembolso).
  "formulario-reembolso": () => <RefundChatLink />,
};
const EMBED_LINE = /^\[\[([a-z0-9-]+)\]\]\s*$/m;

/** Corpo do artigo com os blocos interativos no lugar dos marcadores. */
function ArticleBody({ markdown }: { markdown: string }) {
  const parts = markdown.split(new RegExp(EMBED_LINE.source, "gm"));
  // split com grupo: [texto, nome, texto, nome, texto...]
  return (
    <>
      {parts.map((part, index) => {
        if (index % 2 === 0) {
          return part.trim() ? <HelpArticleContent key={index} markdown={part} variant="note" /> : null;
        }
        const Embed = EMBEDS[part];
        return Embed ? <Fragment key={index}>{Embed()}</Fragment> : null;
      })}
    </>
  );
}

function updatedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Atualizado ${formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}`;
}

/** Título do sumário que está em leitura: o último que já passou do topo da tela. */
function useActiveHeading(ids: string[]): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null);
  useEffect(() => {
    if (!ids.length) return;
    const update = () => {
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 140) current = id;
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [ids]);
  return active;
}

export default function HelpArticleNote({
  basePath,
  category,
  article,
  related,
  supportPath,
}: {
  basePath: string;
  category: HelpCategory;
  article: HelpArticle;
  /** Outros artigos da mesma coleção, na ordem do menu. */
  related: HelpArticle[];
  supportPath: string;
}) {
  const { hash } = useLocation();
  useLayoutEffect(() => {
    // Com âncora (ex.: volta do login direto para o formulário), quem rola é o bloco de destino.
    if (!hash) window.scrollTo(0, 0);
  }, [article.id, hash]);

  const outline = useMemo(() => articleOutline(article.content), [article.content]);
  const outlineIds = useMemo(() => outline.map((item) => item.id), [outline]);
  const active = useActiveHeading(outlineIds);
  const updated = updatedLabel(article.updated_at ?? article.published_at);

  return (
    <motion.div variants={stagger(0.06)} initial="hidden" animate="show" className="mt-8 sm:mt-10">
      <Breadcrumb
        basePath={basePath}
        items={[{ label: category.title, to: `${basePath}/${category.slug}` }, { label: article.title }]}
      />

      <div className="mt-8 grid gap-x-14 sm:mt-10 lg:grid-cols-[minmax(0,1fr)_230px]">
        <article className="min-w-0 max-w-[720px]">
          <motion.header variants={fadeUp}>
            <h2 className="text-[28px] !font-semibold leading-[1.18] tracking-[-0.02em] text-[#0D0D0D] sm:text-[34px]">
              {article.title}
            </h2>
            {article.summary ? (
              <p className="mt-3 text-[16px] leading-[1.55] text-[#6E6E80] sm:text-[17px]">{article.summary}</p>
            ) : null}
            {updated ? <p className="mt-4 text-[13px] text-[#8E8EA0]">{updated}</p> : null}
          </motion.header>

          <motion.div variants={fadeUp} className="mt-8 sm:mt-10">
            <ArticleBody markdown={article.content} />

            <p className="mt-12 border-t border-[#E5E5E5] pt-6 text-[15px] text-[#6E6E80]">
              Ainda com dúvida ou algo não funcionou como descrito?{" "}
              <Link to={supportPath} className="text-[#2563EB] underline underline-offset-4">
                Fale com o suporte
              </Link>
              .
            </p>

            {related.length ? (
              <section className="mt-12">
                <h2 className="text-[20px] !font-semibold tracking-[-0.015em] text-[#0D0D0D] sm:text-[22px]">
                  Mais em {category.title}
                </h2>
                <ArticleList
                  basePath={basePath}
                  rows={related.map((item) => ({ article: item, category }))}
                  className="mt-5"
                />
              </section>
            ) : null}
          </motion.div>
        </article>

        {outline.length ? (
          <motion.aside variants={fadeUp} aria-label="Nesta página" className="hidden lg:block">
            <nav className="sticky top-8">
              <ul className="space-y-3 border-l border-[#E5E5E5] text-[13.5px] leading-[1.4]">
                {outline.map((item) => {
                  const isActive = item.id === active;
                  return (
                    <li key={`${item.id}-${item.text}`} className={item.level === 3 ? "pl-7" : "pl-4"}>
                      <a
                        href={`#${item.id}`}
                        onClick={(event) => {
                          event.preventDefault();
                          document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                        aria-current={isActive ? "location" : undefined}
                        className={`relative block transition-colors hover:text-[#2563EB] before:absolute before:-left-[17px] before:top-0 before:h-full before:w-[2px] before:rounded-full ${
                          item.level === 3 ? "before:-left-[29px]" : ""
                        } ${isActive ? "before:bg-[#2563EB]" : "before:bg-transparent"} ${
                          isActive
                            ? "font-medium text-[#2563EB]"
                            : item.level === 2
                              ? "font-medium text-[#0D0D0D]/80"
                              : "text-[#8E8EA0]"
                        }`}
                      >
                        {item.text}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </motion.aside>
        ) : null}
      </div>
    </motion.div>
  );
}
