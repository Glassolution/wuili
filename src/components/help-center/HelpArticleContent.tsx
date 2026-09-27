import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { revealOnScroll } from "@/components/help-center/helpMotion";

/*
  Corpo do artigo em Markdown. Usado na central, na página de leitura do artigo
  e na prévia do admin, para o que o admin vê ser exatamente o que o usuário lê.

  Duas escalas:
  - "compact": texto pequeno, usado na prévia da página inicial da central;
  - "note": página de leitura, coluna estreita, texto grande, seções separadas
    por linha e tabelas com borda arredondada.
*/

export type HelpArticleVariant = "compact" | "note";

const makeLink = (className: string): Components["a"] =>
  function HelpLink({ href = "", children }) {
    return href.startsWith("/") ? (
      <Link to={href} className={className}>
        {children}
      </Link>
    ) : (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  };

// Tons neutros: a hierarquia vem do peso e do espaçamento, não de cor.
const compact: Components = {
  h2: ({ children }) => <h2 className="mb-2 mt-7 text-[15px] !font-medium text-[#09090B]">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-2 mt-6 text-[14.5px] !font-medium text-[#09090B]">{children}</h3>,
  p: ({ children }) => <p className="my-2.5 text-[13.5px] leading-[1.6] text-[#3F3F46]">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-2.5 list-disc space-y-1.5 pl-5 text-[13.5px] leading-[1.5] text-[#18181B] marker:text-[#18181B]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2.5 list-decimal space-y-1.5 pl-5 text-[13.5px] leading-[1.5] text-[#18181B] marker:text-[#18181B]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-medium text-[#09090B]">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-[#D4D4D8] pl-3.5 [&_p]:my-1 [&_p]:text-[#52525B]">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-[4px] bg-[#F4F4F5] px-1.5 py-0.5 font-mono text-[12.5px] text-[#18181B]">{children}</code>
  ),
  hr: () => <hr className="my-6 border-[#E4E4E7]" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-[8px] border border-[#E4E4E7]">
      <table className="w-full border-collapse text-left text-[13px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="bg-[#F4F4F5] px-3 py-2 font-medium text-[#18181B]">{children}</th>,
  td: ({ children }) => <td className="border-t border-[#E4E4E7] px-3 py-2 text-[#3F3F46]">{children}</td>,
  a: makeLink("text-[#09090B] underline underline-offset-2 decoration-[#A1A1AA] hover:decoration-[#09090B]"),
  // Imagens ficam de fora por enquanto: o conteúdo é texto, e é isso que a IA lê.
  img: () => null,
};

const note: Components = {
  // Cada seção abre com uma linha divisória acima, como num artigo longo.
  h2: ({ children }) => (
    <motion.h2 {...revealOnScroll} className="mb-4 mt-10 border-t border-[#E4E4E7] pt-10 text-[26px] !font-medium leading-[1.25] tracking-[-0.02em] text-[#0F172A] sm:text-[30px]">
      {children}
    </motion.h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-3 mt-8 text-[20px] !font-medium tracking-[-0.015em] text-[#0F172A]">{children}</h3>
  ),
  p: ({ children }) => <p className="my-4 text-[16.5px] leading-[1.7] text-[#3F4652]">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-2 pl-7 text-[16.5px] leading-[1.6] text-[#3F4652] marker:text-[#0F172A]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pl-7 text-[16.5px] leading-[1.6] text-[#3F4652] marker:font-medium marker:text-[#0F172A]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[#0F172A]">{children}</strong>,
  blockquote: ({ children }) => (
    <motion.blockquote {...revealOnScroll} className="my-6 rounded-[10px] border border-[#E4E4E7] bg-[#F8FAFC] px-5 py-1 [&_p]:my-3 [&_p]:text-[15.5px]">
      {children}
    </motion.blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-[5px] bg-[#F1F5F9] px-1.5 py-0.5 font-mono text-[14.5px] text-[#0F172A]">{children}</code>
  ),
  hr: () => <hr className="my-10 border-[#E4E4E7]" />,
  table: ({ children }) => (
    <motion.div {...revealOnScroll} className="my-7 overflow-x-auto rounded-[12px] border border-[#E4E4E7]">
      <table className="w-full border-collapse text-left text-[15px]">{children}</table>
    </motion.div>
  ),
  th: ({ children }) => <th className="bg-[#F8FAFC] px-4 py-3.5 font-medium text-[#0F172A]">{children}</th>,
  td: ({ children }) => <td className="border-t border-[#E4E4E7] px-4 py-3.5 text-[#3F4652]">{children}</td>,
  tr: ({ children }) => <tr className="transition-colors duration-150 hover:bg-[#F8FAFC]">{children}</tr>,
  a: makeLink("text-[#2563EB] underline underline-offset-[3px] decoration-[#2563EB]/40 hover:decoration-[#2563EB]"),
  img: () => null,
};

const HelpArticleContent = ({ markdown, variant = "compact" }: { markdown: string; variant?: HelpArticleVariant }) => (
  <div className={variant === "note" ? "help-article-note [&>*:first-child]:mt-0 [&>h2:first-child]:border-t-0 [&>h2:first-child]:pt-0" : "help-article-content"}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={variant === "note" ? note : compact}>
      {markdown}
    </ReactMarkdown>
  </div>
);

export default HelpArticleContent;
