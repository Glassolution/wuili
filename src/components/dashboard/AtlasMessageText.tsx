import type { AnchorHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";

import { linkifyAtlasRouteTags, resolveAtlasRouteTag } from "@/lib/atlasRouteTags";

/**
 * Texto de uma resposta do Atlas.
 *
 * Resolve as menções de navegação nos dois formatos que o modelo pode produzir:
 *
 *   1. tag solta no meio da frase — "revise no #catalogo"
 *   2. link markdown com âncora — "[Configurações](#configuracoes)"
 *
 * Aceitar os dois evita depender de o modelo acertar um formato específico. Em
 * ambos, slug fora do mapa de rotas vira texto comum em vez de link quebrado.
 */
const AtlasMessageText = ({ content, className = "" }: { content: string; className?: string }) => {
  const navigate = useNavigate();

  const AtlasLink = ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) => {
    // Formato 2: href é uma âncora (#slug) escrita pelo modelo.
    if (typeof href === "string" && href.startsWith("#")) {
      const tag = resolveAtlasRouteTag(href.slice(1));
      // Slug desconhecido não vira link: renderiza só o rótulo, sem âncora morta.
      if (!tag) return <>{children}</>;
      return (
        <a
          href={tag.route}
          onClick={(event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
            event.preventDefault();
            navigate(tag.route);
          }}
          className="rounded-[5px] font-medium text-[#2563EB] decoration-[#2563EB]/35 underline-offset-2 transition-colors hover:bg-[#2563EB]/[0.08] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
          {...props}
        >
          {children}
        </a>
      );
    }

    const isInternal = typeof href === "string" && href.startsWith("/");

    if (!isInternal) {
      return (
        <a href={href} target="_blank" rel="noreferrer" className="text-[#2563EB] underline underline-offset-2" {...props}>
          {children}
        </a>
      );
    }

    return (
      <a
        href={href}
        onClick={(event) => {
          // Navegação interna via router: evita recarregar o app inteiro.
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
          event.preventDefault();
          navigate(href!);
        }}
        className="rounded-[5px] font-medium text-[#2563EB] decoration-[#2563EB]/35 underline-offset-2 transition-colors hover:bg-[#2563EB]/[0.08] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/30"
        {...props}
      >
        {children}
      </a>
    );
  };

  return (
    <div className={className}>
      <ReactMarkdown components={{ a: AtlasLink }}>{linkifyAtlasRouteTags(content)}</ReactMarkdown>
    </div>
  );
};

export default AtlasMessageText;
