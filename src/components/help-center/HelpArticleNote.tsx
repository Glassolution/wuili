import { useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { MotionConfig, motion } from "framer-motion";
import { ArrowRight, CornerDownLeft, Headset } from "lucide-react";
import { helpArticlePath, type HelpArticle, type HelpCategory } from "@/lib/helpCenter";
import HelpArticleContent from "@/components/help-center/HelpArticleContent";
import { EASE_OUT, fadeUp, revealOnScroll, stagger } from "@/components/help-center/helpMotion";

/*
  Página de leitura de um artigo: o que abre ao clicar num tópico do menu ou
  num card da central. Formato de artigo longo — cabeçalho centralizado (data,
  título, resumo, autoria), linhas-guia nas laterais e uma coluna de texto
  estreita, com seções separadas por linha.
*/

const fmtLongDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" }) : null;

/** Sobe até o contêiner que rola (o <main> do painel ou a janela) e volta ao topo. */
function scrollToTop(from: HTMLElement | null) {
  let node = from?.parentElement ?? null;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      node.scrollTop = 0;
      return;
    }
    node = node.parentElement;
  }
  window.scrollTo(0, 0);
}

/** Losango nos cruzamentos da linha horizontal com as linhas-guia. */
const Diamond = ({ side }: { side: "left" | "right" }) => (
  <motion.span
    aria-hidden="true"
    initial={{ opacity: 0, scale: 0, rotate: 45 }}
    animate={{ opacity: 1, scale: 1, rotate: 45 }}
    transition={{ duration: 0.35, ease: EASE_OUT, delay: 0.75 }}
    className={`absolute -bottom-[4px] z-[1] hidden h-[7px] w-[7px] border border-[#DCE3EA] bg-white md:block ${
      side === "left" ? "-left-[4px]" : "-right-[4px]"
    }`}
  />
);

/** Linhas-guia laterais que se desenham de cima para baixo ao abrir a nota. */
const GuideLines = ({ delay = 0 }: { delay?: number }) => (
  <>
    {(["left-0", "right-0"] as const).map((side) => (
      <motion.span
        key={side}
        aria-hidden="true"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay }}
        className={`pointer-events-none absolute inset-y-0 ${side} hidden w-px origin-top bg-[#E8ECF0] md:block`}
      />
    ))}
  </>
);

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
  /** Outros artigos da mesma categoria, na ordem do menu. */
  related: HelpArticle[];
  supportPath: string;
}) {
  const topRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    scrollToTop(topRef.current);
  }, [article.id]);

  const date = fmtLongDate(article.published_at ?? article.updated_at);

  return (
    <MotionConfig reducedMotion="user">
    <div ref={topRef} className="text-[#0F172A]">
      {/* Cabeçalho: a linha de baixo atravessa a largura toda. */}
      <div className="relative">
        <motion.span
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.2 }}
          className="absolute inset-x-0 bottom-0 h-px bg-[#E8ECF0]"
        />
        <motion.header
          variants={stagger(0.07, 0.05)}
          initial="hidden"
          animate="show"
          className="relative mx-auto max-w-[1180px] px-5 pb-12 pt-6 text-center md:pt-8"
        >
          <GuideLines />
          <motion.div variants={fadeUp} className="flex justify-start">
            <Link
              to={basePath}
              className="inline-flex h-8 items-center gap-2 rounded-[6px] border border-[#E4E4E7] bg-white px-3 text-[13px] text-[#18181B] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:bg-[#FAFAFA]"
            >
              <CornerDownLeft size={14} strokeWidth={2} aria-hidden="true" />
              Central de ajuda
            </Link>
          </motion.div>

          <motion.p variants={fadeUp} className="mt-8 text-[14px] font-medium text-[#3F4652]">
            {category.title}
            {date ? <span className="text-[#8A94A3]"> · {date}</span> : null}
          </motion.p>
          <motion.h1 variants={fadeUp} className="mx-auto mt-2 max-w-[860px] text-[30px] !font-medium leading-[1.15] tracking-[-0.025em] text-[#0F172A] sm:text-[38px]">
            {article.title}
          </motion.h1>
          {article.summary ? (
            <motion.p variants={fadeUp} className="mx-auto mt-4 max-w-[760px] text-[15.5px] leading-[1.6] text-[#3F4652]">
              {article.summary}
            </motion.p>
          ) : null}
          <motion.p variants={fadeUp} className="mt-3 text-[13.5px] text-[#52606D]">
            por Equipe Velo
          </motion.p>

          <Diamond side="left" />
          <Diamond side="right" />
        </motion.header>
      </div>

      {/* Corpo: mesma largura das linhas-guia, texto numa coluna estreita. */}
      <div className="relative mx-auto max-w-[1180px] px-5 pb-16 pt-12 md:pt-16">
        <GuideLines delay={0.55} />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: EASE_OUT, delay: 0.4 }}
          className="mx-auto max-w-[760px]"
        >
          <HelpArticleContent markdown={article.content} variant="note" />

          <motion.div {...revealOnScroll} className="mt-12 flex items-center gap-3 rounded-[10px] border border-[#E4E4E7] bg-[#F4F4F5] px-4 py-3.5 text-[15px] text-[#3F4652]">
            <Headset size={19} strokeWidth={1.9} aria-hidden="true" className="shrink-0 text-[#0F172A]" />
            <p>
              Ainda com dúvida ou algo não funcionou como descrito? Fale com o nosso{" "}
              <Link to={supportPath} className="font-medium text-[#0F172A] hover:underline hover:underline-offset-2">
                Suporte
              </Link>
              .
            </p>
          </motion.div>

          {related.length ? (
            <motion.section {...revealOnScroll} className="mt-14 border-t border-[#E4E4E7] pt-10">
              <h2 className="text-[20px] !font-medium tracking-[-0.015em] text-[#0F172A]">Mais em {category.title}</h2>
              <ul className="mt-4 divide-y divide-[#E4E4E7] border-y border-[#E4E4E7]">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link
                      // Hover: o título ganha cor e desliza, a seta acompanha.
                      to={helpArticlePath(basePath, category, item)}
                      className="group flex items-center justify-between gap-4 py-4 text-[16px] text-[#0F172A]"
                    >
                      <span className="transition-[color,transform] duration-200 group-hover:translate-x-1 group-hover:text-[#2563EB]">
                        {item.title}
                      </span>
                      <ArrowRight
                        size={17}
                        aria-hidden="true"
                        className="shrink-0 text-[#8A94A3] transition-[color,transform] duration-200 group-hover:translate-x-1 group-hover:text-[#2563EB]"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.section>
          ) : null}
        </motion.div>
      </div>
    </div>
    </MotionConfig>
  );
}
