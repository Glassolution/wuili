import type { ReactNode } from "react";

/**
 * Converte links do texto de uma mensagem de suporte em âncoras clicáveis.
 *
 * Aceita dois formatos:
 *   1. markdown — "[Onde vejo o dinheiro das vendas](https://...)"
 *   2. URL solta — "https://www.velods.com.br/ajuda/..."
 *
 * Links internos (mesmo domínio ou caminho relativo) abrem na mesma aba;
 * externos abrem em nova aba.
 */
const LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)|(https?:\/\/[^\s<>"']+)/g;

export const renderSupportTextWithLinks = (text: string, linkClassName: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  LINK_PATTERN.lastIndex = 0;

  while ((match = LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const label = match[1] ?? match[3];
    const url = match[2] ?? match[3];
    const external = url.startsWith("http") && !url.includes("velods.com.br") && !url.includes("localhost");
    parts.push(
      <a
        key={`link-${key++}`}
        href={url}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        className={linkClassName}
      >
        {label}
      </a>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
};
