import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import { isValidElement, type ReactNode } from "react";
import { headingId } from "@/lib/helpArticleOutline";

/*
  Corpo do artigo em Markdown. Usado na central, na página de leitura do artigo
  e na prévia do admin, para o que o admin vê ser exatamente o que o usuário lê.

  Duas escalas:
  - "compact": texto pequeno, usado na prévia da página inicial da central;
  - "note": página de leitura, texto grande, títulos com âncora (o sumário
    lateral usa articleOutline/headingId) e tabelas com borda arredondada.
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

/** Texto puro de um título renderizado (os filhos podem ter negrito, código...). */
function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

const note: Components = {
  h2: ({ children }) => (
    <h2
      id={headingId(textOf(children))}
      className="mb-4 mt-11 scroll-mt-8 text-[22px] !font-semibold leading-[1.25] tracking-[-0.015em] text-[#0D0D0D] sm:text-[26px]"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      id={headingId(textOf(children))}
      className="mb-3 mt-8 scroll-mt-8 text-[18px] !font-semibold leading-[1.3] text-[#0D0D0D] sm:text-[19px]"
    >
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-4 text-[15.5px] leading-[1.7] text-[#1F1F24] sm:text-[16px]">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-2 pl-6 text-[15.5px] leading-[1.65] text-[#1F1F24] marker:text-[#6E6E80] sm:text-[16px]">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 text-[15.5px] leading-[1.65] text-[#1F1F24] marker:text-[#6E6E80] sm:text-[16px]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-[#0D0D0D]">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="my-7 rounded-[12px] bg-[#F7F7F8] px-6 py-1 [&_p]:my-3.5 [&_p]:text-[15px]">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded-[5px] bg-[#F3F3F3] px-1.5 py-0.5 font-mono text-[14px] text-[#0D0D0D]">{children}</code>
  ),
  hr: () => <hr className="my-12 border-[#E5E5E5]" />,
  table: ({ children }) => (
    <div className="my-8 overflow-x-auto rounded-[12px] border border-[#E5E5E5]">
      <table className="w-full border-collapse text-left text-[14.5px]">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="bg-[#F7F7F8] px-4 py-3.5 font-semibold text-[#0D0D0D]">{children}</th>,
  td: ({ children }) => <td className="border-t border-[#E5E5E5] px-4 py-3.5 text-[#0D0D0D]">{children}</td>,
  a: makeLink("text-[#2563EB] underline underline-offset-[3px] decoration-[#2563EB]/40 hover:decoration-[#2563EB]"),
  img: () => null,
};

const HelpArticleContent = ({ markdown, variant = "compact" }: { markdown: string; variant?: HelpArticleVariant }) => (
  <div className={variant === "note" ? "help-article-note [&>*:first-child]:mt-0" : "help-article-content"}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={variant === "note" ? note : compact}>
      {markdown}
    </ReactMarkdown>
  </div>
);

export default HelpArticleContent;
